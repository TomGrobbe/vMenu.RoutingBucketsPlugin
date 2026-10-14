import { VMenuServer } from '@vespura/vmenu-plugin/server';
import { BucketEvents } from '../shared/events';
import { Permissions } from '../shared/names';
import type { BucketRow, OccupantRow } from '../shared/state';
import { bucketOf, handle, playerExists, snapshot, type Occupant } from './occupancy';
import { allBuckets, bucketExists, displayName } from './registry';
import { isEnabled } from './settings';
import type { BucketDefinition } from './store';

const TickMs = 2000;

interface State {
  buckets: BucketRow[];
  occupants: OccupantRow[];
  everyone: Occupant[];
}

let lastState = '';
let lastWorlds = '';

export function registerBroadcast(): void {
  on('playerDropped', () => {
    lastState = '';
  });

  on(BucketEvents.RequestServerState, () => publishWorlds(allBuckets(), true));

  setInterval(tick, TickMs);

  publishWorlds(allBuckets(), true);
}

export function pushNow(): void {
  const definitions = allBuckets();

  publishWorlds(definitions);

  if (!isEnabled()) {
    lastState = '';

    return;
  }

  const state = build(definitions);

  lastState = fingerprint(state);

  sendToEveryone(state);
}

export function pushTo(serverId: number): void {
  sendTo(serverId, bucketOf(serverId), build(allBuckets()));
}

function tick(): void {
  const definitions = allBuckets();

  publishWorlds(definitions);

  if (!isEnabled()) {
    lastState = '';

    return;
  }

  const state = build(definitions);
  const current = fingerprint(state);

  if (current === lastState) {
    return;
  }

  lastState = current;

  sendToEveryone(state);
}

function build(definitions: readonly BucketDefinition[]): State {
  const everyone = snapshot();
  const counts = new Map<number, number>();

  for (const occupant of everyone) {
    counts.set(occupant.bucket, (counts.get(occupant.bucket) ?? 0) + 1);
  }

  const buckets: BucketRow[] = definitions.map((definition) => ({
    id: definition.id,
    managed: true,
    populationEnabled: definition.populationEnabled,
    lockdown: definition.lockdownMode,
    occupants: counts.get(definition.id) ?? 0,
    name: definition.name,
  }));

  for (const [id, occupants] of counts) {
    if (!bucketExists(id)) {
      buckets.push({ id, managed: false, populationEnabled: true, lockdown: 'inactive', occupants, name: '' });
    }
  }

  const occupants = everyone.map((occupant) => ({
    bucketId: occupant.bucket,
    serverId: occupant.serverId,
    name: occupant.name,
  }));

  return { buckets, occupants, everyone };
}

function fingerprint(state: State): string {
  return JSON.stringify([state.buckets, state.occupants]);
}

function sendToEveryone(state: State): void {
  for (const occupant of state.everyone) {
    sendTo(occupant.serverId, occupant.bucket, state);
  }
}

function sendTo(serverId: number, viewerBucket: number, state: State): void {
  if (!playerExists(serverId) || !VMenuServer.isPlayerAllowed(handle(serverId), Permissions.View)) {
    return;
  }

  emitNet(BucketEvents.State, serverId, viewerBucket, state.buckets, state.occupants);
}

function publishWorlds(definitions: readonly BucketDefinition[], force = false): void {
  const json = JSON.stringify({
    buckets: definitions.map((definition) => ({
      id: definition.id,
      name: displayName(definition.id),
      population: definition.populationEnabled,
      lockdown: definition.lockdownMode,
    })),
  });

  if (!force && json === lastWorlds) {
    return;
  }

  lastWorlds = json;

  emit(BucketEvents.ServerState, json);
}
