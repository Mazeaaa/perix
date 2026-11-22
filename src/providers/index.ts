import type { Provider } from '../core/session.js';
import type { DeviceDescriptor } from '../core/types.js';
import { createDescriptorProvider } from './descriptorProvider.js';

export const PROVIDER_META: Array<{ id: string; displayName: string }> = [
  { id: 'atk', displayName: 'ATK / VXE' },
  { id: 'mchose', displayName: '迈从 MCHOSE' },
  { id: 'aula', displayName: '狼蛛 AULA' },
  { id: 'logitech', displayName: '罗技 Logitech' },
];

export function buildProviders(descriptors: DeviceDescriptor[]): Provider[] {
  return PROVIDER_META.map((meta) =>
    createDescriptorProvider(meta.id, meta.displayName, descriptors),
  );
}
