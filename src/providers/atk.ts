import { padTo } from '../core/util.js';

/**
 * ATK / VXE 方案的分帧规则。
 *
 * 已确认（来自社区公开的协议记录，非本仓库猜测）：
 *   - BitMouse 方案：自定义用途页 0xFF05，走 output report 8，定长帧，应答走 input report 8
 *   - Compx 方案：自定义用途页 0xFF04，16 字节帧
 *   - 接收器（dongle）会转发所有"寻址到鼠标"的报文，所以有线与 2.4G 可复用同一套帧
 *
 * 未确认：具体命令字与字段偏移。这些必须在真机上抓包核对后再补，
 * 本仓库不会用猜测值填表——写错字节可能让设备进入异常状态。
 */

/** output report 编号 */
export const ATK_REPORT_ID = 0x08;
/** 单帧载荷长度（不含 report id） */
export const ATK_FRAME_LEN = 63;
/** Compx 方案的帧长 */
export const COMPX_FRAME_LEN = 16;
/** Compx 方案用途页 */
export const COMPX_USAGE_PAGE = 0xff04;
/** BitMouse / ATK 用途页 */
export const ATK_USAGE_PAGE = 0xff05;

/**
 * 构造一帧请求：首字节为 report id，之后是把 payload 补齐到定长。
 * 返回的数组可直接交给 transport.write()。
 */
export function encodeFrame(payload: ArrayLike<number>, frameLen = ATK_FRAME_LEN): Uint8Array {
  const body = padTo(payload, frameLen);
  const out = new Uint8Array(frameLen + 1);
  out[0] = ATK_REPORT_ID;
  out.set(body, 1);
  return out;
}

/** 去掉 report id，返回载荷 */
export function decodeFrame(data: Uint8Array): Uint8Array {
  return data.length > 0 && data[0] === ATK_REPORT_ID ? data.subarray(1) : data;
}
