import type { DeviceSession, MatchResult, OpenContext, Provider } from '../core/session.js';
import { unsupported } from '../core/transport.js';
import type { Capability, DeviceDescriptor, HidDeviceInfo } from '../core/types.js';

/**
 * 描述符驱动的通用 Provider。
 *
 * 大多数品牌的差别只在于"长什么样、支持什么"，协议细节之后由各自的
 * Session 实现补上。在协议打通之前，open() 返回一个只读会话：
 * 能报型号，任何写入都明确抛 NOT_IMPLEMENTED。
 */
export function createDescriptorProvider(
  id: string,
  displayName: string,
  descriptors: DeviceDescriptor[],
  openSession?: (ctx: OpenContext, descriptor: DeviceDescriptor) => Promise<DeviceSession>,
): Provider {
  const own = descriptors.filter((d) => d.vendor === id);

  function match(device: HidDeviceInfo): MatchResult | null {
    let familyHit: MatchResult | null = null;
    for (const descriptor of own) {
      const m = descriptor.match;
      if (m.vendorId !== device.vendorId) continue;
      if (m.usagePage !== undefined && device.usagePage !== undefined && m.usagePage !== device.usagePage) {
        continue;
      }
      if (m.productPattern && device.product && !new RegExp(m.productPattern, 'i').test(device.product)) {
        continue;
      }
      if (m.productIds.length === 0) {
        familyHit ??= { descriptor, confidence: 'family' };
        continue;
      }
      if (m.productIds.includes(device.productId)) {
        return { descriptor, confidence: 'exact' };
      }
    }
    return familyHit;
  }

  return {
    id,
    displayName,
    descriptors: own,
    match,
    async open(ctx: OpenContext): Promise<DeviceSession> {
      const hit = match(ctx.device);
      if (!hit) throw unsupported(`设备 ${ctx.device.path} 不属于 ${displayName}`);
      if (openSession) return openSession(ctx, hit.descriptor);
      return new ProbeSession(hit.descriptor, ctx.device);
    },
  };
}

/** 仅能识别的会话：读不到参数，也写不了。 */
export class ProbeSession implements DeviceSession {
  constructor(
    readonly descriptor: DeviceDescriptor,
    private readonly device: HidDeviceInfo,
  ) {}

  supports(_cap: Capability): boolean {
    return false;
  }

  async info(): Promise<never> {
    throw unsupported(
      `${this.descriptor.brand} ${this.descriptor.model} 的协议尚未接入（${this.device.path}）。` +
        `协议线索见 ${this.descriptor.protocol ?? 'docs/protocol/'}，欢迎提 PR。`,
    );
  }

  async close(): Promise<void> {
    /* 无句柄可关 */
  }
}
