import type { HidDeviceInfo } from './types.js';

export interface VendorInfo {
  id: string;
  brand: string;
  /** 该厂商常用的 USB VID */
  vids: number[];
  /** 该厂商常用的自定义用途页 */
  usagePages?: number[];
  /** 与官方软件互斥的进程名 */
  processes?: string[];
  note?: string;
}

/**
 * 厂商字典。
 *
 * 只放能确认的信息：VID 来自实际枚举或公开资料。
 * 型号级匹配放在 src/devices/*.json，证据等级由 descriptor.evidence 标注。
 */
export const VENDORS: VendorInfo[] = [
  {
    id: 'atk',
    brand: 'ATK / VXE',
    vids: [0x373b, 0x3554, 0x372d],
    usagePages: [0xff05, 0xff04],
    processes: ['ATK HUB.exe', 'ATK V HUB.exe', 'VXE HUB.exe'],
    note: '0x373B = BitMouse 方案；0x3554 = Compx 方案（接收器常见）',
  },
  {
    id: 'mchose',
    brand: '迈从 MCHOSE',
    vids: [0x41e4, 0x3837],
    processes: ['M HUB.exe', 'MCHOSE HUB.exe'],
    note: '0x41E4 = Sinowealth；0x3837 = 磁轴键盘系列',
  },
  {
    id: 'aula',
    brand: '狼蛛 AULA',
    vids: [0x0c45, 0x258a],
    processes: ['神光同步.exe', 'AULA.exe'],
    note: '0x0C45 = Sonix 方案，狼蛛多数键盘走这条线',
  },
  {
    id: 'logitech',
    brand: '罗技 Logitech',
    vids: [0x046d],
    processes: ['lghub.exe', 'lghub_agent.exe'],
    note: 'HID++ 2.0，另有本地 API ws://localhost:9010',
  },
];

export function findVendorByVid(vid: number): VendorInfo | undefined {
  return VENDORS.find((v) => v.vids.includes(vid));
}

export function brandOf(device: HidDeviceInfo): string {
  return findVendorByVid(device.vendorId)?.brand ?? '未知厂商';
}
