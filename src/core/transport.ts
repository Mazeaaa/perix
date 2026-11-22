import type { HidDeviceInfo } from './types.js';

export interface HidTransport {
  readonly kind: string;
  list(): Promise<HidDeviceInfo[]>;
  open(device: HidDeviceInfo): Promise<HidHandle>;
}

export interface HidHandle {
  readonly device: HidDeviceInfo;
  write(report: Uint8Array): Promise<void>;
  sendFeatureReport(report: Uint8Array): Promise<void>;
  getFeatureReport(reportId: number, length: number): Promise<Uint8Array>;
  /** 被动等待一帧输入报告，超时返回 null */
  read(timeoutMs: number): Promise<Uint8Array | null>;
  onData(listener: (data: Uint8Array) => void): () => void;
  close(): Promise<void>;
}

export type PerixErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'UNSUPPORTED_DEVICE'
  | 'TRANSPORT'
  | 'PROTOCOL'
  | 'TIMEOUT'
  | 'ABORTED';

export class PerixError extends Error {
  constructor(
    message: string,
    readonly code: PerixErrorCode,
  ) {
    super(message);
    this.name = 'PerixError';
  }
}

/** 协议还没打通时用它占位：任何写入都明确失败，而不是静默失败。 */
export function unsupported(reason: string): PerixError {
  return new PerixError(reason, 'NOT_IMPLEMENTED');
}
