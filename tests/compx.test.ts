import { describe, expect, it } from 'vitest';
import {
  COMPX_BODY_LEN,
  COMPX_REPORT_ID,
  decodeBattery,
  decodeCompxReply,
  encodeCompxRequest,
  formatVersion,
  parseCid,
} from '../src/providers/compx.js';

/** 按协议自己造一帧合法应答：含 report id 在内总和 mod 256 == 0x55 */
function buildReply(command: number, status: number, data: number[], address = 0): Uint8Array {
  const body = new Uint8Array(COMPX_BODY_LEN);
  body[0] = command;
  body[1] = status;
  body[2] = (address >> 8) & 0xff;
  body[3] = address & 0xff;
  body[4] = data.length;
  data.forEach((v, i) => {
    body[5 + i] = v;
  });
  let sum = COMPX_REPORT_ID;
  for (let i = 0; i < COMPX_BODY_LEN - 1; i++) sum += body[i] ?? 0;
  body[COMPX_BODY_LEN - 1] = (((0x55 - sum) % 256) + 256) % 256;
  return Uint8Array.from([COMPX_REPORT_ID, ...body]);
}

describe('Compx 帧', () => {
  it('请求帧带上 report id，长度固定，校验和自洽', () => {
    const frame = encodeCompxRequest(0x04);
    expect(frame).toHaveLength(COMPX_BODY_LEN + 1);
    expect(frame[0]).toBe(COMPX_REPORT_ID);
    expect(frame[1]).toBe(0x04);
    const sum = frame.reduce((acc, b) => acc + b, 0) % 256;
    expect(sum).toBe(0x55);
  });

  it('带地址和长度的 EEPROM 读请求字段位置正确', () => {
    const frame = encodeCompxRequest(0x08, { address: 0x0102, dataLength: 10 });
    expect(frame[3]).toBe(0x01);
    expect(frame[4]).toBe(0x02);
    expect(frame[5]).toBe(10);
    expect(frame.reduce((acc, b) => acc + b, 0) % 256).toBe(0x55);
  });

  it('能解析合法应答', () => {
    const reply = buildReply(0x04, 0, [87]);
    const frame = decodeCompxReply(reply);
    expect(frame?.command).toBe(0x04);
    expect(frame?.dataLength).toBe(1);
    expect(decodeBattery(frame!)).toBe(87);
  });

  it('校验和不对的帧一律拒绝，不猜着用', () => {
    const reply = buildReply(0x04, 0, [87]);
    reply[reply.length - 1] = (reply[reply.length - 1]! + 1) & 0xff;
    expect(decodeCompxReply(reply)).toBeNull();
  });

  it('太短的帧返回 null', () => {
    expect(decodeCompxReply(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('版本与 CID 解析符合文档', () => {
    expect(formatVersion(new Uint8Array([3, 1]))).toBe('3.01');
    expect(formatVersion(new Uint8Array([1, 75]))).toBe('1.75');
    const cid = parseCid(new Uint8Array([2, 0, 0, 0, 87]));
    expect(cid).toEqual({ company: 2, model: 87 });
  });

  it('电量超过 100 会被夹住', () => {
    const frame = decodeCompxReply(buildReply(0x04, 0, [200]))!;
    expect(decodeBattery(frame)).toBe(100);
  });
});
