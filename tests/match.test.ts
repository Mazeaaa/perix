import { describe, expect, it } from 'vitest';
import { buildProviders } from '../src/providers/index.js';
import { DESCRIPTORS } from '../src/devices/load.js';
import type { HidDeviceInfo } from '../src/core/types.js';

const providers = buildProviders(DESCRIPTORS);
const find = (id: string) => providers.find((p) => p.id === id)!;

function device(partial: Partial<HidDeviceInfo>): HidDeviceInfo {
  return {
    path: 'mock',
    vendorId: 0,
    productId: 0,
    ...partial,
  };
}

describe('设备匹配', () => {
  it('VID/PID 全中时给出 exact', () => {
    const hit = find('atk').match(device({ vendorId: 0x3554, productId: 0xf58a, usagePage: 0xff05 }));
    expect(hit?.confidence).toBe('exact');
    expect(hit?.descriptor.id).toBe('atk-compx-dongle');
  });

  it('只命中 VID 时退化为 family', () => {
    const hit = find('atk').match(device({ vendorId: 0x373b, productId: 0x1119, usagePage: 0xff05 }));
    expect(hit?.confidence).toBe('family');
    expect(hit?.descriptor.id).toBe('atk-bitmouse-family');
  });

  it('用途页不符时不匹配', () => {
    const hit = find('atk').match(device({ vendorId: 0x3554, productId: 0xf58a, usagePage: 0x0001 }));
    expect(hit).toBeNull();
  });

  it('别的厂商不会被抢走', () => {
    const logi = device({ vendorId: 0x046d, productId: 0xc548 });
    expect(find('atk').match(logi)).toBeNull();
    expect(find('mchose').match(logi)).toBeNull();
    expect(find('aula').match(logi)).toBeNull();
    expect(find('logitech').match(logi)?.confidence).toBe('family');
  });

  it('未知厂商全部不匹配', () => {
    const unknown = device({ vendorId: 0x1234, productId: 0x5678 });
    for (const p of providers) expect(p.match(unknown)).toBeNull();
  });
});
