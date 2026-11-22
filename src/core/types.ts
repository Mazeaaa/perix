/** 设备识别与能力模型：整个项目的词汇表都在这里。 */

/** 一个 HID 接口（一个物理设备通常暴露多个） */
export interface HidDeviceInfo {
  /** 系统路径，唯一标识一个接口 */
  path: string;
  vendorId: number;
  productId: number;
  /** 厂商自定义用途页，例如 0xFF05 = ATK、0xFF04 = Compx */
  usagePage?: number;
  usage?: number;
  interface?: number;
  product?: string;
  manufacturer?: string;
  serialNumber?: number;
  release?: number;
}

/** 设备支持的能力。UI 完全由它驱动，不认品牌。 */
export const CAPABILITIES = [
  'dpi',
  'polling_rate',
  'lift_off_distance',
  'debounce',
  'sensor_settings',
  'sleep_timeout',
  'lighting_zones',
  'lighting_per_key',
  'keymap',
  'macro',
  'actuation',
  'rapid_trigger',
  'onboard_profiles',
  'battery',
  'firmware_info',
  'wireless_pairing',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type DeviceKind = 'mouse' | 'keyboard' | 'headset' | 'other';

/** 连接方式。三种模式的协议往往不同，必须分开描述。 */
export type TransportMode = 'wired' | 'dongle' | 'bluetooth';

export interface TransportSpec {
  supported: boolean;
  /** 该模式下的收发方式，例如 'feature_report:9' / 'output_report:8' */
  codec?: string;
  note?: string;
}

/** 证据等级。诚实标注，避免把猜测当事实。 */
export type Evidence =
  /** 真机验证过 */
  | 'verified'
  /** 有社区公开的逆向文档或开源实现 */
  | 'community'
  /** 仅按厂商家族/VID 推断，未验证 */
  | 'family';

export interface DeviceMatch {
  vendorId: number;
  productIds: number[];
  /** 只在这个用途页上通信 */
  usagePage?: number;
  /** 固件上报的型号 ID，例如 Compx 的 "2,87" */
  cid?: string[];
  productPattern?: string;
}

export interface KeyLayout {
  rows: number;
  cols: number;
  /** 物理键位：id 用 HID usage 命名（如 'KeyA'、'Escape'） */
  keys: Array<{ id: string; row: number; col: number; w?: number; label?: string }>;
}

export interface LightingTopology {
  /** 'per_key' = 每键独立；'zones' = 若干分区；'single' = 整体一色 */
  kind: 'per_key' | 'zones' | 'single';
  zones?: Array<{ id: string; label: string; ledCount: number }>;
  maxBrightness?: number;
}

export interface Quirks {
  /** 两次写入之间的最小间隔，很多国产方案要求 ≥100ms */
  minWriteIntervalMs?: number;
  /** 打开设备前必须关闭这些进程 */
  exclusiveWith?: string[];
  /** 该固件区间之外不建议写入 */
  firmwareRange?: string;
  notes?: string[];
}

export interface DeviceDescriptor {
  /** 稳定 slug，用作配置与存档的键 */
  id: string;
  /** provider id */
  vendor: string;
  brand: string;
  model: string;
  kind: DeviceKind;
  match: DeviceMatch;
  capabilities: Capability[];
  transport: Partial<Record<TransportMode, TransportSpec>>;
  evidence: Evidence;
  /** 本项目的实现进度：只能识别 / 能读 / 能读能写 */
  state: 'probe-only' | 'read' | 'read-write';
  layout?: KeyLayout;
  lighting?: LightingTopology;
  quirks?: Quirks;
  /** 协议文档的相对路径，例如 'docs/protocol/atk.md' */
  protocol?: string;
}

export function supports(descriptor: DeviceDescriptor, cap: Capability): boolean {
  return descriptor.capabilities.includes(cap);
}
