import type { HidTransport } from './transport.js';
import type { Capability, DeviceDescriptor, HidDeviceInfo, TransportMode } from './types.js';

export type Rgb = readonly [number, number, number];

export interface DeviceInfo {
  model?: string;
  firmware?: string;
  serial?: string;
  connection: TransportMode;
  battery?: { percent: number; charging?: boolean };
}

export interface DpiStage {
  x: number;
  y: number;
}

export interface DpiTable {
  stages: DpiStage[];
  activeIndex: number;
}

/** 协议层只认这一帧。效果引擎在应用层，跨品牌才能真同步。 */
export interface LightingFrame {
  /** 与 descriptor.lighting.zones 顺序对齐 */
  zones: Rgb[];
  /** 每键颜色，键为 layout.keys[].id */
  keys?: Record<string, Rgb>;
  brightness?: number;
}

/**
 * 一个已打开的设备会话。
 *
 * 只实现设备真正支持的能力；其余方法缺失，调用方用 supports() 判断。
 */
export interface DeviceSession {
  readonly descriptor: DeviceDescriptor;
  supports(cap: Capability): boolean;
  info(): Promise<DeviceInfo>;
  close(): Promise<void>;

  readDpi?(): Promise<DpiTable>;
  writeDpi?(table: DpiTable): Promise<void>;

  setPollingRate?(hz: number): Promise<void>;
  applyFrame?(frame: LightingFrame): Promise<void>;

  /** 写入板载内存，掉电保存 */
  commit?(): Promise<void>;
}

export interface MatchResult {
  descriptor: DeviceDescriptor;
  /** exact = VID/PID 全中；family = 只命中厂商家族，型号未知 */
  confidence: 'exact' | 'family';
}

export interface OpenContext {
  device: HidDeviceInfo;
  transport: HidTransport;
}

export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly descriptors: readonly DeviceDescriptor[];
  match(device: HidDeviceInfo): MatchResult | null;
  open(ctx: OpenContext): Promise<DeviceSession>;
}
