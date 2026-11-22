import { describe, expect, it } from 'vitest';
import { Perix } from '../src/core/manager.js';
import { buildProviders } from '../src/providers/index.js';
import { DESCRIPTORS } from '../src/devices/load.js';
import { MockTransport } from '../src/transport/mock.js';
import type { HidDeviceInfo } from '../src/core/types.js';

function device(vendorId: number, productId: number, usagePage: number, index: number): HidDeviceInfo {
  return { path: `mock-${index}`, vendorId, productId, usagePage, interface: index };
}

describe('Perix.scan', () => {
  it('同一设备的多个接口合并成一条记录', async () => {
    const transport = new MockTransport({
      devices: [
        device(0x3554, 0xf58a, 0x01, 0),
        device(0x3554, 0xf58a, 0xff05, 1),
        device(0x3554, 0xf58a, 0xff04, 2),
        device(0x046d, 0xc548, 0x01, 3),
      ],
    });
    const perix = new Perix(transport, buildProviders(DESCRIPTORS));
    const reports = await perix.scan();

    expect(reports).toHaveLength(2);
    const atk = reports.find((r) => r.key === '3554:F58A');
    expect(atk?.interfaces).toHaveLength(3);
    expect(atk?.brand).toBe('ATK / VXE');
    expect(atk?.match?.descriptor.id).toBe('atk-compx-dongle');
  });

  it('未收录品牌仍会列出，只是没有 provider', async () => {
    const transport = new MockTransport({ devices: [device(0x1234, 0x5678, 0x01, 0)] });
    const perix = new Perix(transport, buildProviders(DESCRIPTORS));
    const [report] = await perix.scan();
    expect(report?.provider).toBeUndefined();
    expect(report?.brand).toBe('未知厂商');
  });

  it('识别到的设备可以打开会话，但协议未接入时写入会明确报错', async () => {
    const transport = new MockTransport({
      devices: [device(0x3554, 0xf58a, 0xff05, 0)],
    });
    const perix = new Perix(transport, buildProviders(DESCRIPTORS));
    const [report] = await perix.scan();
    const session = await perix.open(report!);
    expect(session.supports('dpi')).toBe(false);
    await expect(session.info()).rejects.toThrow(/协议尚未接入/);
  });
});
