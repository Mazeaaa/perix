import type { Capability, DeviceDescriptor, DeviceMatch, DeviceKind, Evidence, TransportMode, TransportSpec } from '../core/types.js';
import raw from './devices.json' with { type: 'json' };

type Hexish = string | number;

interface RawDescriptor {
  id: string;
  vendor: string;
  brand: string;
  model: string;
  kind: DeviceKind;
  match: {
    vendorId: Hexish;
    productIds: Hexish[];
    usagePage?: Hexish;
    cid?: string[];
    productPattern?: string;
  };
  capabilities: Capability[];
  transport: Partial<Record<TransportMode, TransportSpec>>;
  evidence: Evidence;
  state: 'probe-only' | 'read' | 'read-write';
  protocol?: string;
  layout?: DeviceDescriptor['layout'];
  lighting?: DeviceDescriptor['lighting'];
  quirks?: DeviceDescriptor['quirks'];
}

function toNumber(value: Hexish | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  return Number.parseInt(value.replace(/^0x/i, ''), 16);
}

function normalizeMatch(match: RawDescriptor['match']): DeviceMatch {
  const vendorId = toNumber(match.vendorId);
  if (vendorId === undefined || Number.isNaN(vendorId)) {
    throw new Error('descriptor.match.vendorId 无法解析');
  }
  const productIds = match.productIds.map((p) => toNumber(p) ?? Number.NaN);
  if (productIds.some(Number.isNaN)) {
    throw new Error('descriptor.match.productIds 含非法值');
  }
  const usagePage = toNumber(match.usagePage);
  return {
    vendorId,
    productIds,
    ...(usagePage === undefined ? {} : { usagePage }),
    ...(match.cid ? { cid: match.cid } : {}),
    ...(match.productPattern ? { productPattern: match.productPattern } : {}),
  };
}

/** 把 devices.json 转成强类型描述符，顺便做一致性校验。 */
export function loadDescriptors(source: RawDescriptor[] = raw as RawDescriptor[]): DeviceDescriptor[] {
  const seen = new Set<string>();
  return source.map((item) => {
    if (seen.has(item.id)) throw new Error(`descriptor id 重复：${item.id}`);
    seen.add(item.id);
    return {
      id: item.id,
      vendor: item.vendor,
      brand: item.brand,
      model: item.model,
      kind: item.kind,
      match: normalizeMatch(item.match),
      capabilities: item.capabilities,
      transport: item.transport,
      evidence: item.evidence,
      state: item.state,
      ...(item.protocol ? { protocol: item.protocol } : {}),
      ...(item.layout ? { layout: item.layout } : {}),
      ...(item.lighting ? { lighting: item.lighting } : {}),
      ...(item.quirks ? { quirks: item.quirks } : {}),
    };
  });
}

export const DESCRIPTORS: DeviceDescriptor[] = loadDescriptors();
