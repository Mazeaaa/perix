import type { HidHandle, HidTransport } from '../core/transport.js';
import { PerixError } from '../core/transport.js';
import type { HidDeviceInfo } from '../core/types.js';

interface NodeHidDevice {
  on(event: 'data', cb: (data: Buffer) => void): void;
  on(event: 'error', cb: (err: Error) => void): void;
  write(values: number[]): number;
  sendFeatureReport(values: number[]): number;
  getFeatureReport(reportId: number, reportLength: number): Buffer;
  close(): void;
}

interface NodeHidModule {
  devices(): Array<{
    vendorId: number;
    productId: number;
    path?: string;
    product?: string;
    manufacturer?: string;
    serialNumber?: string;
    interface?: number;
    usagePage?: number;
    usage?: number;
    release?: number;
  }>;
  HID: new (path: string) => NodeHidDevice;
}

/**
 * 基于 node-hid 的传输实现（Node / Electron 主进程）。
 *
 * 约定：传给 write() 的字节数组首字节就是 report id，与 node-hid 一致。
 * node-hid 是原生模块，这里按需加载，缺失时给出可读错误而不是崩溃。
 */
export class NodeHidTransport implements HidTransport {
  readonly kind = 'node-hid';
  #module?: NodeHidModule;

  async #load(): Promise<NodeHidModule> {
    if (this.#module) return this.#module;
    try {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      this.#module = require('node-hid') as NodeHidModule;
      return this.#module;
    } catch (err) {
      throw new PerixError(
        `无法加载 node-hid（原生模块未编译或平台不支持）：${(err as Error).message}`,
        'TRANSPORT',
      );
    }
  }

  async list(): Promise<HidDeviceInfo[]> {
    const hid = await this.#load();
    return hid
      .devices()
      .filter((d) => Boolean(d.path))
      .map((d) => ({
        path: d.path as string,
        vendorId: d.vendorId,
        productId: d.productId,
        usagePage: d.usagePage,
        usage: d.usage,
        interface: d.interface,
        product: d.product,
        manufacturer: d.manufacturer,
        release: d.release,
      }));
  }

  async open(device: HidDeviceInfo): Promise<HidHandle> {
    const hid = await this.#load();
    let raw: NodeHidDevice;
    try {
      raw = new hid.HID(device.path);
    } catch (err) {
      throw new PerixError(
        `打开设备失败（可能被官方驱动独占）：${(err as Error).message}`,
        'TRANSPORT',
      );
    }
    return new NodeHidHandle(device, raw);
  }
}

class NodeHidHandle implements HidHandle {
  #closed = false;
  #queue: Uint8Array[] = [];
  #waiters: Array<(value: Uint8Array | null) => void> = [];
  #listeners = new Set<(data: Uint8Array) => void>();

  constructor(
    readonly device: HidDeviceInfo,
    private readonly raw: NodeHidDevice,
  ) {
    this.raw.on('data', (buf: Buffer) => this.#dispatch(new Uint8Array(buf)));
    this.raw.on('error', () => {
      /* 断开由 read 超时体现，避免进程崩溃 */
    });
  }

  #dispatch(data: Uint8Array): void {
    for (const listener of this.#listeners) listener(data);
    const waiter = this.#waiters.shift();
    if (waiter) waiter(data);
    else this.#queue.push(data);
  }

  async write(report: Uint8Array): Promise<void> {
    this.#assertOpen();
    this.raw.write(Array.from(report));
  }

  async sendFeatureReport(report: Uint8Array): Promise<void> {
    this.#assertOpen();
    try {
      this.raw.sendFeatureReport(Array.from(report));
    } catch (err) {
      throw new PerixError(
        `设备不接受 feature report（report id ${report[0] ?? 0}）：${(err as Error).message}`,
        'PROTOCOL',
      );
    }
  }

  async getFeatureReport(reportId: number, length: number): Promise<Uint8Array> {
    this.#assertOpen();
    try {
      return new Uint8Array(this.raw.getFeatureReport(reportId, length));
    } catch (err) {
      throw new PerixError(`读取 feature report 失败：${(err as Error).message}`, 'PROTOCOL');
    }
  }

  async read(timeoutMs: number): Promise<Uint8Array | null> {
    this.#assertOpen();
    const queued = this.#queue.shift();
    if (queued) return queued;
    return new Promise<Uint8Array | null>((resolve) => {
      const timer = setTimeout(() => {
        const index = this.#waiters.indexOf(onData);
        if (index >= 0) this.#waiters.splice(index, 1);
        resolve(null);
      }, timeoutMs);
      const onData = (value: Uint8Array | null): void => {
        clearTimeout(timer);
        resolve(value);
      };
      this.#waiters.push(onData);
    });
  }

  onData(listener: (data: Uint8Array) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#listeners.clear();
    try {
      this.raw.close();
    } catch {
      /* 已断开 */
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new PerixError('设备已关闭', 'TRANSPORT');
  }
}
