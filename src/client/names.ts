import { Text, type TextLike } from '@vespura/vmenu-plugin/client';
import type { BucketRow } from '../shared/state';

export function worldName(bucket: BucketRow): TextLike {
  return bucket.managed && bucket.name.length > 0
    ? bucket.name
    : Text.key('rb.world.unmanaged', { id: String(bucket.id) });
}

export function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}
