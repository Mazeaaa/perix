import { describe, expect, it } from 'vitest';
import { ATK_FRAME_LEN, ATK_REPORT_ID, decodeFrame, encodeFrame } from '../src/providers/atk.js';
import { bytesToHex, hexToBytes, padTo } from '../src/core/util.js';
import { displayWidth, pad, table } from '../src/cli/table.js';

describe('ATK 分帧', () => {
  it('补齐到定长并带上 report id', () => {
    const frame = encodeFrame([0x84, 0x00, 0x01]);
    expect(frame).toHaveLength(ATK_FRAME_LEN + 1);
    expect(frame[0]).toBe(ATK_REPORT_ID);
    expect(Array.from(frame.slice(1, 4))).toEqual([0x84, 0x00, 0x01]);
    expect(frame.slice(4).every((b) => b === 0)).toBe(true);
  });

  it('超长载荷被截断而不是溢出', () => {
    const frame = encodeFrame(new Array(200).fill(0xaa));
    expect(frame).toHaveLength(ATK_FRAME_LEN + 1);
  });

  it('解码会去掉 report id', () => {
    const frame = encodeFrame([0x01, 0x02]);
    expect(Array.from(decodeFrame(frame).slice(0, 2))).toEqual([0x01, 0x02]);
    expect(decodeFrame(new Uint8Array([0x01, 0x02])).length).toBe(2);
  });
});

describe('字节工具', () => {
  it('十六进制字符串与字节互转', () => {
    expect(Array.from(hexToBytes('08 84 00'))).toEqual([0x08, 0x84, 0x00]);
    expect(hexToBytes('0x0884').length).toBe(2);
    expect(bytesToHex(new Uint8Array([0x08, 0x0a]))).toBe('08 0a');
  });

  it('奇数长度会报错而不是静默截断', () => {
    expect(() => hexToBytes('abc')).toThrow(/偶数/);
  });

  it('padTo 保持原值并补零', () => {
    expect(Array.from(padTo([1, 2], 4))).toEqual([1, 2, 0, 0]);
  });
});

describe('终端表格', () => {
  it('中文按双宽计算', () => {
    expect(displayWidth('中文')).toBe(4);
    expect(displayWidth('ab')).toBe(2);
    expect(displayWidth('中a')).toBe(3);
  });

  it('按显示宽度补空格，表格列能对齐', () => {
    expect(pad('中文', 6)).toBe('中文  ');
    expect(pad('ab', 4)).toBe('ab  ');
    const out = table(['名', '值'], [['中文', '1'], ['ab', '22']]);
    expect(out.split('\n')).toHaveLength(4);
    expect(out.split('\n')[1]).toMatch(/^─+  ─+$/);
  });
});
