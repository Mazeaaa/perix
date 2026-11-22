import type { HidHandle } from '../core/transport.js';
import { sleep } from '../core/util.js';
import {
  COMPX_READ_COMMANDS,
  decodeBattery,
  decodeCompxReply,
  encodeCompxRequest,
  formatVersion,
  parseCid,
  type CompxFrame,
} from './compx.js';

export interface CompxInfo {
  online?: boolean;
  battery?: number;
  firmware?: string;
  receiverFirmware?: string;
  cid?: { company: number; model: number };
}

export interface CompxReadResult {
  info: CompxInfo;
  /** 原始报文，出问题时能直接贴进 issue */
  trace: Array<{ command: number; request: Uint8Array; reply: Uint8Array | null }>;
}

const REPLY_TIMEOUT_MS = 700;

/**
 * 一口气读完所有只读字段。
 *
 * 只调用 0x03 / 0x04 / 0x10 / 0x12 / 0x1d 这几个读命令，
 * 不碰写命令（0x07 未验证，写错字段可能让设备配置错乱）。
 */
export async function readCompxInfo(handle: HidHandle): Promise<CompxReadResult> {
  const trace: CompxReadResult['trace'] = [];

  const ask = async (command: number): Promise<CompxFrame | null> => {
    const request = encodeCompxRequest(command);
    await handle.sendFeatureReport(request);
    const deadline = Date.now() + REPLY_TIMEOUT_MS;
    let raw: Uint8Array | null = null;
    while (Date.now() < deadline) {
      const frame = await handle.read(150);
      if (!frame) continue;
      raw = frame;
      const decoded = decodeCompxReply(frame);
      if (decoded) {
        trace.push({ command, request, reply: frame });
        return decoded;
      }
    }
    trace.push({ command, request, reply: raw });
    return null;
  };

  const info: CompxInfo = {};

  const online = await ask(COMPX_READ_COMMANDS.online);
  if (online) info.online = (online.data[0] ?? 0) === 1;

  await sleep(30);
  const battery = await ask(COMPX_READ_COMMANDS.battery);
  if (battery) info.battery = decodeBattery(battery);

  await sleep(30);
  const cid = await ask(COMPX_READ_COMMANDS.cid);
  if (cid) info.cid = parseCid(cid.data);

  await sleep(30);
  const firmware = await ask(COMPX_READ_COMMANDS.mouseFirmware);
  if (firmware) info.firmware = formatVersion(firmware.data);

  await sleep(30);
  const receiver = await ask(COMPX_READ_COMMANDS.receiverFirmware);
  if (receiver) info.receiverFirmware = formatVersion(receiver.data);

  return { info, trace };
}
