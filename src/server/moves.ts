import { BucketEvents } from '../shared/events';
import { bucketOf, move, playerExists } from './occupancy';
import { displayName } from './registry';

export function moveAndTell(serverId: number, bucket: number, actor: string): boolean {
  const from = bucketOf(serverId);

  if (!move(serverId, bucket)) {
    return false;
  }

  tell(serverId, from, bucket, actor);

  return true;
}

export function tell(serverId: number, from: number, to: number, actor: string): void {
  if (from === to || !playerExists(serverId)) {
    return;
  }

  emitNet(BucketEvents.Moved, serverId, displayName(from), displayName(to), actor);
}
