import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Perix } from '../core/manager.js';
import { PerixError } from '../core/transport.js';
import { hex, hexToBytes, bytesToHex, vidPid, clamp } from '../core/util.js';
import { VENDORS } from '../core/vendors.js';
import { DESCRIPTORS } from '../devices/load.js';
import { buildProviders } from '../providers/index.js';
import { readCompxInfo } from '../providers/compxSession.js';
import { NodeHidTransport } from '../transport/nodeHid.js';
import { table } from './table.js';

const HELP = `perix —— 一个软件管所有外设

用法：
  perix list                      列出所有 HID 设备并标注识别结果
  perix info [选项]               读取设备信息（Compx 方案，只读命令）
  perix devices                   查看已收录的设备与实现进度
  perix watch [选项]              被动监听某个接口的输入报告（不发送任何报文）
  perix raw [选项]                发送一帧原始报文（危险，必须加 --yes）
  perix doctor                    环境体检：原生模块、设备数、官方驱动占用

watch / raw 选项：
  --vid <hex>   厂商 ID，例如 0x3554
  --pid <hex>   产品 ID，例如 0xF58A
  --page <hex>  用途页，例如 0xFF05
  --ms <n>      watch 持续时间，默认 5000
  --hex <bytes> raw 要发送的字节，例如 "08 84 00 00"

示例：
  perix list
  perix watch --vid 0x3554 --pid 0xF58A --page 0xFF05 --ms 8000
`;

interface Args {
  command: string;
  flags: Record<string, string>;
  bool: Set<string>;
}

function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string> = {};
  const bool = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token || !token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[name] = next;
      i += 1;
    } else {
      bool.add(name);
    }
  }
  return { command, flags, bool };
}

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value.replace(/^0x/i, ''), 16);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function cmdList(): Promise<void> {
  const perix = new Perix(new NodeHidTransport(), buildProviders(DESCRIPTORS));
  const reports = await perix.scan();
  if (reports.length === 0) {
    console.log('没有发现任何 HID 设备。');
    return;
  }
  const rows = reports.map((r) => {
    const d = r.representative;
    const status = r.match ? (r.match.confidence === 'exact' ? '已识别' : '家族匹配') : '未知';
    const state = r.match
      ? r.match.descriptor.state === 'probe-only'
        ? '仅识别'
        : r.match.descriptor.state === 'read'
          ? '可读'
          : '可读写'
      : '—';
    return [
      vidPid(d),
      hex(d.usagePage),
      String(r.interfaces.length),
      r.brand,
      r.match?.descriptor.model ?? d.product ?? '—',
      state,
      status,
    ];
  });
  console.log(
    table(['VID:PID', '用途页', '接口', '品牌', '型号', '进度', '状态'], rows),
  );
  const recognized = reports.filter((r) => r.match).length;
  console.log(`\n共 ${reports.length} 个设备，其中 ${recognized} 个已收录品牌。`);
}

function cmdDevices(): void {
  const rows = DESCRIPTORS.map((d) => [
    d.brand,
    d.model,
    d.kind === 'mouse' ? '鼠标' : d.kind === 'keyboard' ? '键盘' : '其他',
    `0x${hex(d.match.vendorId)}`,
    d.state === 'probe-only' ? '仅识别' : d.state === 'read' ? '可读' : '可读写',
    d.evidence === 'verified' ? '真机验证' : d.evidence === 'community' ? '社区文档' : '家族推断',
  ]);
  console.log(table(['品牌', '型号', '类型', 'VID', '进度', '证据'], rows));
  console.log('\n进度说明：仅识别 = 能认出来但还不能配置；可读写 = 协议已接入。');
}

async function cmdWatch(args: Args): Promise<void> {
  const vid = num(args.flags.vid);
  const pid = num(args.flags.pid);
  const page = num(args.flags.page);
  const duration = clamp(Number(args.flags.ms ?? 5000) || 5000, 500, 120000);

  const transport = new NodeHidTransport();
  const devices = await transport.list();
  const target = devices.find(
    (d) =>
      (vid === undefined || d.vendorId === vid) &&
      (pid === undefined || d.productId === pid) &&
      (page === undefined || d.usagePage === page),
  );
  if (!target) {
    console.error('没有匹配到设备。先跑 perix list 看看有哪些接口。');
    process.exitCode = 1;
    return;
  }

  console.log(`监听 ${vidPid(target)} 用途页 0x${hex(target.usagePage)}（${duration}ms，只读不发送）`);
  const handle = await transport.open(target);
  const start = Date.now();
  let count = 0;
  const off = handle.onData((data) => {
    count += 1;
    const t = String(Date.now() - start).padStart(5, ' ');
    console.log(`+${t}ms  ${String(data.length).padStart(3, ' ')}B  ${bytesToHex(data)}`);
  });
  await new Promise((resolve) => setTimeout(resolve, duration));
  off();
  await handle.close();
  console.log(`\n共收到 ${count} 帧。把这段输出提 issue 就能帮我们补协议。`);
}

async function cmdRaw(args: Args): Promise<void> {
  if (!args.bool.has('yes')) {
    console.error(
      '拒绝发送：原始报文可能让设备进入异常状态。\n' +
        '确认你知道这些字节的含义，再加 --yes。',
    );
    process.exitCode = 2;
    return;
  }
  const payload = args.flags.hex;
  if (!payload) {
    console.error('缺少 --hex');
    process.exitCode = 2;
    return;
  }
  const vid = num(args.flags.vid);
  const pid = num(args.flags.pid);
  const page = num(args.flags.page);
  const transport = new NodeHidTransport();
  const target = (await transport.list()).find(
    (d) =>
      (vid === undefined || d.vendorId === vid) &&
      (pid === undefined || d.productId === pid) &&
      (page === undefined || d.usagePage === page),
  );
  if (!target) {
    console.error('没有匹配到设备。');
    process.exitCode = 1;
    return;
  }
  const bytes = hexToBytes(payload);
  const handle = await transport.open(target);
  if (args.bool.has('feature')) await handle.sendFeatureReport(bytes);
  else await handle.write(bytes);
  const reply = await handle.read(1500);
  await handle.close();
  console.log(`已发送 ${bytes.length}B：${bytesToHex(bytes)}`);
  console.log(reply ? `应答：${bytesToHex(reply)}` : '无应答（超时）');
}

function cmdDoctor(): void {
  console.log('perix doctor\n');
  const checks: Array<[string, boolean, string]> = [];

  try {
    const require = createRequire(import.meta.url);
    require('node-hid');
    checks.push(['node-hid 原生模块', true, '可用']);
  } catch (err) {
    checks.push(['node-hid 原生模块', false, (err as Error).message]);
  }

  const running = runningProcesses();
  for (const vendor of VENDORS) {
    const hit = (vendor.processes ?? []).filter((p) => running.includes(p.toLowerCase()));
    checks.push([
      `${vendor.brand} 官方软件`,
      hit.length === 0,
      hit.length === 0 ? '未运行（不冲突）' : `正在运行：${hit.join(', ')} —— 会独占设备`,
    ]);
  }

  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? '✓' : '!'} ${name}：${detail}`);
  }
}

function runningProcesses(): string[] {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return out
      .split(/\r?\n/)
      .map((line) => line.split('","')[0]?.replace(/^"/, '').trim().toLowerCase() ?? '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function cmdInfo(args: Args): Promise<void> {
  const page = num(args.flags.page) ?? 0xff04;
  const vid = num(args.flags.vid);
  const pid = num(args.flags.pid);
  const transport = new NodeHidTransport();
  const target = (await transport.list()).find(
    (d) =>
      (vid === undefined || d.vendorId === vid) &&
      (pid === undefined || d.productId === pid) &&
      d.usagePage === page,
  );
  if (!target) {
    console.error(`没有匹配到用途页 0x${hex(page)} 的接口。先跑 perix list。`);
    process.exitCode = 1;
    return;
  }
  console.log(`读取 ${vidPid(target)}（用途页 0x${hex(page)}，仅只读命令）\n`);
  const handle = await transport.open(target);
  const { info, trace } = await readCompxInfo(handle);
  await handle.close();

  const rows: string[][] = [];
  if (info.online !== undefined) rows.push(['在线状态', info.online ? '已连接' : '未连接']);
  if (info.battery !== undefined) rows.push(['电量', `${info.battery}%`]);
  if (info.cid) rows.push(['CID / MID', `${info.cid.company}, ${info.cid.model}`]);
  if (info.firmware) rows.push(['鼠标固件', info.firmware]);
  if (info.receiverFirmware) rows.push(['接收器固件', info.receiverFirmware]);

  if (rows.length === 0) {
    console.log('没有读到任何字段。原始报文如下，可直接贴到 issue：');
  } else {
    console.log(table(['字段', '值'], rows));
    console.log('');
  }
  for (const item of trace) {
    const req = bytesToHex(item.request);
    const rep = item.reply ? bytesToHex(item.reply) : '（无应答）';
    console.log(`  0x${hex(item.command, 2)}  发 ${req}\n        收 ${rep}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'list':
    case 'ls':
      await cmdList();
      break;
    case 'devices':
      cmdDevices();
      break;
    case 'info':
      await cmdInfo(args);
      break;
    case 'watch':
      await cmdWatch(args);
      break;
    case 'raw':
      await cmdRaw(args);
      break;
    case 'doctor':
      cmdDoctor();
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    default:
      console.error(`未知命令：${args.command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  if (err instanceof PerixError) {
    console.error(`[${err.code}] ${err.message}`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
