export {
  CAPABILITIES,
  supports,
  type Capability,
  type DeviceDescriptor,
  type DeviceKind,
  type DeviceMatch,
  type Evidence,
  type HidDeviceInfo,
  type KeyLayout,
  type LightingTopology,
  type Quirks,
  type TransportMode,
  type TransportSpec,
} from './core/types.js';

export type {
  DeviceInfo,
  DeviceSession,
  DpiStage,
  DpiTable,
  LightingFrame,
  MatchResult,
  OpenContext,
  Provider,
  Rgb,
} from './core/session.js';

export { PerixError, type HidHandle, type HidTransport, type PerixErrorCode } from './core/transport.js';
export { Perix, type DeviceReport } from './core/manager.js';
export { VENDORS, brandOf, findVendorByVid, type VendorInfo } from './core/vendors.js';

export { DESCRIPTORS, loadDescriptors } from './devices/load.js';
export { buildProviders, PROVIDER_META } from './providers/index.js';
export { NodeHidTransport } from './transport/nodeHid.js';
export { MockTransport, type MockOptions } from './transport/mock.js';
export { encodeFrame, decodeFrame, ATK_FRAME_LEN, ATK_REPORT_ID } from './providers/atk.js';
