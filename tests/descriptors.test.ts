import { describe, expect, it } from 'vitest';
import { loadDescriptors } from '../src/devices/load.js';
import { DESCRIPTORS } from '../src/devices/load.js';

describe('设备描述符', () => {
  it('全部能被解析，且 id 唯一', () => {
    const ids = DESCRIPTORS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DESCRIPTORS.length).toBeGreaterThan(0);
  });

  it('十六进制字符串被正确转换成数字', () => {
    const atk = DESCRIPTORS.find((d) => d.id === 'atk-compx-dongle');
    expect(atk?.match.vendorId).toBe(0x3554);
    expect(atk?.match.productIds).toEqual([0xf58a]);
    expect(atk?.match.usagePage).toBe(0xff05);
  });

  it('每个描述符都声明了连接方式与证据等级', () => {
    for (const d of DESCRIPTORS) {
      expect(Object.keys(d.transport).length).toBeGreaterThan(0);
      expect(['verified', 'community', 'family']).toContain(d.evidence);
    }
  });

  it('重复 id 会抛错', () => {
    const raw = [
      {
        id: 'dup',
        vendor: 'atk',
        brand: 'x',
        model: 'y',
        kind: 'mouse' as const,
        match: { vendorId: '0x1', productIds: [] },
        capabilities: [],
        transport: { wired: { supported: true } },
        evidence: 'family' as const,
        state: 'probe-only' as const,
      },
    ];
    expect(() => loadDescriptors([...raw, ...raw])).toThrow(/重复/);
  });
});
