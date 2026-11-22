import type { DeviceSession, MatchResult, Provider } from './session.js';
import type { HidTransport } from './transport.js';
import type { HidDeviceInfo } from './types.js';
import { brandOf } from './vendors.js';
import { vidPid } from './util.js';

/** 同一个物理设备的多个 HID 接口会被合并成一条记录 */
export interface DeviceReport {
  key: string;
  /** 优先取命中描述符的那个接口 */
  representative: HidDeviceInfo;
  interfaces: HidDeviceInfo[];
  brand: string;
  provider?: Provider;
  match?: MatchResult;
}

function rank(confidence: 'exact' | 'family'): number {
  return confidence === 'exact' ? 2 : 1;
}

/**
 * 门面：枚举 → 识别 → 打开会话。
 * UI 只需要跟它打交道，不需要知道具体品牌。
 */
export class Perix {
  constructor(
    private readonly transport: HidTransport,
    private readonly providers: Provider[],
  ) {}

  async scan(): Promise<DeviceReport[]> {
    const all = await this.transport.list();
    const groups = new Map<string, HidDeviceInfo[]>();
    for (const device of all) {
      const key = vidPid(device);
      const bucket = groups.get(key);
      if (bucket) bucket.push(device);
      else groups.set(key, [device]);
    }

    const reports: DeviceReport[] = [];
    for (const [key, interfaces] of groups) {
      let best: { device: HidDeviceInfo; provider: Provider; match: MatchResult } | undefined;
      for (const device of interfaces) {
        for (const provider of this.providers) {
          const match = provider.match(device);
          if (!match) continue;
          if (!best || rank(match.confidence) > rank(best.match.confidence)) {
            best = { device, provider, match };
          }
        }
      }
      const representative = best?.device ?? interfaces[0];
      if (!representative) continue;
      reports.push({
        key,
        representative,
        interfaces,
        brand: best?.match.descriptor.brand ?? brandOf(representative),
        ...(best ? { provider: best.provider, match: best.match } : {}),
      });
    }
    return reports.sort((a, b) => a.key.localeCompare(b.key));
  }

  async open(report: DeviceReport): Promise<DeviceSession> {
    if (!report.provider) {
      throw new Error(`${report.key} 没有可用的 Provider，尚未识别该设备`);
    }
    return report.provider.open({ device: report.representative, transport: this.transport });
  }
}
