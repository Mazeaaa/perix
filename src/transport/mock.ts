import type { HidHandle, HidTransport } from '../core/transport.js';
import { PerixError } from '../core/transport.js';
import type { HidDeviceInfo } from '../core/types.js';

export interface MockOptions {
  devices?: HidDeviceInfo[];
  /** 每次 getFeatureReport 返回的内容，按 reportId 索引 */
  featureReplies?: Record<number, Uint8Array>;
  /** 读取输入报告时依次吐出的帧 */
  incoming?: Uint8Array[];
  /** 记录所有写出的报文，供测试断言 */
  written?: Uint8Array[];
}

/** 无硬件也能跑通全链路的传输实现，测试与 CI 用。 */
export class MockTransport implements HidTransport {
  readonly kind = 'mock';
  readonly written: Uint8Array[] = [];
  #options: MockOptions;

  constructor(options: MockOptions = {}) {
    this.#options = options;
  }

  async list(): Promise<HidDeviceInfo[]> {
    return this.#options.devices ?? [];
  }

  async open(device: HidDeviceInfo): Promise<HidHandle> {
    const known = (this.#options.devices ?? []).some((d) => d.path === device.path);
    if (!known && (this.#options.devices ?? []).length > 0) {
      throw new PerixError(`设备不存在：${device.path}`, 'TRANSPORT');
    }
    return new MockHandle(device, this.#options, this.written);
  }
}

class MockHandle implements HidHandle {
  #closed = false;
  #listeners = new Set<(data: Uint8Array) => void>();
  #cursor = 0;

  constructor(
    readonly device: HidDeviceInfo,
    private readonly options: MockOptions,
    private readonly written: Uint8Array[],
  ) {}

  async write(report: Uint8Array): Promise<void> {
    if (this.#closed) throw new PerixError('设备已关闭', 'TRANSPORT');
    this.written.push(Uint8Array.from(report));
  }

  async sendFeatureReport(report: Uint8Array): Promise<void> {
    await this.write(report);
  }

  async getFeatureReport(reportId: number): Promise<Uint8Array> {
    const reply = this.options.featureReplies?.[reportId];
    if (!reply) throw new PerixError(`没有预设 report 0x${reportId.toString(16)} 的应答`, 'TIMEOUT');
    return Uint8Array.from(reply);
  }

  async read(): Promise<Uint8Array | null> {
    const frames = this.options.incoming ?? [];
    const next = frames[this.#cursor];
    if (!next) return null;
    this.#cursor += 1;
    return Uint8Array.from(next);
  }

  onData(listener: (data: Uint8Array) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#listeners.clear();
  }
}
