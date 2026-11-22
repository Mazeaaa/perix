/** 十六进制与展示用的零碎工具。 */

export function hex(value: number | undefined, pad = 4): string {
  if (value === undefined || !Number.isFinite(value)) return '----';
  return value.toString(16).toUpperCase().padStart(pad, '0');
}

export function vidPid(device: { vendorId: number; productId: number }): string {
  return `${hex(device.vendorId)}:${hex(device.productId)}`;
}

export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function hexToBytes(text: string): Uint8Array {
  const clean = text.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('十六进制字符串长度必须为偶数');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** 把 payload 补齐到固定长度，用于构造固定帧长的 HID 报告 */
export function padTo(payload: ArrayLike<number>, length: number, fill = 0): Uint8Array {
  const out = new Uint8Array(length).fill(fill);
  const n = Math.min(payload.length, length);
  for (let i = 0; i < n; i++) out[i] = payload[i] ?? 0;
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
