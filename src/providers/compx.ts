/**
 * Compx 方案（ATK / VXE 部分型号及其接收器）。
 *
 * 依据公开协议记录（见 docs/protocol/atk.md 的参考链接）：
 *   - 用途页 0xFF04，请求走 Feature report 8，应答走 Input report 8
 *   - 每帧 16 字节（不含 report id）：命令、状态、2 字节大端 EEPROM 地址、
 *     数据长度、10 字节数据、校验和
 *   - 校验：含 report id 与校验和在内，全部字节之和 mod 256 == 0x55
 *
 * 本文件只实现**读命令**。写命令（0x07）未在真机验证，故意不实现。
 */

export const COMPX_USAGE_PAGE = 0xff04;
export const COMPX_REPORT_ID = 0x08;
export const COMPX_BODY_LEN = 16;
const CHECKSUM_TARGET = 0x55;

export const COMPX_READ_COMMANDS = {
  online: 0x03,
  battery: 0x04,
  eeprom: 0x08,
  profile: 0x0e,
  cid: 0x10,
  mouseFirmware: 0x12,
  receiverFirmware: 0x1d,
} as const;

export interface CompxFrame {
  command: number;
  status: number;
  address: number;
  dataLength: number;
  data: Uint8Array;
  checksum: number;
}

function checksumFor(body: ArrayLike<number>): number {
  let sum = COMPX_REPORT_ID;
  for (let i = 0; i < COMPX_BODY_LEN - 1; i++) sum += body[i] ?? 0;
  return (((CHECKSUM_TARGET - sum) % 256) + 256) % 256;
}

/** 构造一帧请求，返回可直接交给 sendFeatureReport 的完整报文（含 report id） */
export function encodeCompxRequest(
  command: number,
  options: { address?: number; dataLength?: number; data?: ArrayLike<number> } = {},
): Uint8Array {
  const { address = 0, dataLength = 0, data } = options;
  const body = new Uint8Array(COMPX_BODY_LEN);
  body[0] = command & 0xff;
  body[1] = 0x00;
  body[2] = (address >> 8) & 0xff;
  body[3] = address & 0xff;
  body[4] = dataLength & 0xff;
  if (data) {
    for (let i = 0; i < Math.min(data.length, 10); i++) body[5 + i] = data[i] ?? 0;
  }
  body[COMPX_BODY_LEN - 1] = checksumFor(body);
  const out = new Uint8Array(COMPX_BODY_LEN + 1);
  out[0] = COMPX_REPORT_ID;
  out.set(body, 1);
  return out;
}

/** 解析应答并验校验和；帧不合法时返回 null，绝不做"猜着用" */
export function decodeCompxReply(raw: Uint8Array): CompxFrame | null {
  const data = raw.length === COMPX_BODY_LEN + 1 && raw[0] === COMPX_REPORT_ID ? raw.subarray(1) : raw;
  if (data.length < COMPX_BODY_LEN) return null;
  let sum = COMPX_REPORT_ID;
  for (let i = 0; i < COMPX_BODY_LEN; i++) sum += data[i] ?? 0;
  if ((sum & 0xff) !== CHECKSUM_TARGET) return null;
  return {
    command: data[0] ?? 0,
    status: data[1] ?? 0,
    address: ((data[2] ?? 0) << 8) | (data[3] ?? 0),
    dataLength: data[4] ?? 0,
    data: data.subarray(5, 15),
    checksum: data[15] ?? 0,
  };
}

/** 版本字段是两位十六进制，例如 03 01 表示 3.01 */
export function formatVersion(data: Uint8Array): string {
  const major = data[0] ?? 0;
  const minor = data[1] ?? 0;
  return `${major}.${minor.toString().padStart(2, '0')}`;
}

/** CID / MID：前两字节是公司号，后四字节是型号号（大端） */
export function parseCid(data: Uint8Array): { company: number; model: number } {
  const company = data[0] ?? 0;
  const model =
    ((data[1] ?? 0) * 0x1000000 + (data[2] ?? 0) * 0x10000 + (data[3] ?? 0) * 0x100 + (data[4] ?? 0)) >>> 0;
  return { company, model };
}

export function decodeBattery(frame: CompxFrame): number {
  const percent = frame.data[0] ?? 0;
  return percent > 100 ? 100 : percent;
}
