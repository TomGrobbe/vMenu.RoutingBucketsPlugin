import { BucketEvents } from '../shared/events';
import { moveAllTo, move, playerExists, playerName, type Moved } from './occupancy';
import { displayName } from './registry';

export function moveAndTell(serverId: number, bucket: number, actor: string): number[] {
  const moved = move(serverId, bucket);

  tellAll(moved, bucket, actor, serverId);

  return moved.map((entry) => entry.serverId);
}

export function moveEveryone(from: number, to: number, actor: string): number {
  const moved = moveAllTo(from, to);

  tellAll(moved, to, actor);

  return moved.length;
}

function tellAll(moved: readonly Moved[], to: number, actor: string, driver?: number): void {
  for (const entry of moved) {
    const by = actor.length === 0 && driver !== undefined && entry.serverId !== driver ? playerName(driver) : actor;

    tell(entry.serverId, entry.from, to, by);
  }
}

function tell(serverId: number, from: number, to: number, actor: string): void {
  if (from === to || !playerExists(serverId)) {
    return;
  }

  emitNet(BucketEvents.Moved, serverId, displayName(from), displayName(to), actor);
}
