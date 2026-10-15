import { VMenuServer } from '@vespura/vmenu-plugin/server';
import { densityFractions, fullDensity, isEmpty, packDensity, type Density } from '../shared/density';
import { BucketEvents } from '../shared/events';
import { Permissions } from '../shared/names';
import { packBucket, packOccupant, type BucketRow, type PackedBucket, type PackedOccupant } from '../shared/state';
import { bucketOf, handle, placements, playerExists, snapshot, type Occupant } from './occupancy';
import { allBuckets, bucketExists, displayName, densityOf } from './registry';
import { isEnabled, managesDensity } from './settings';
import type { BucketDefinition } from './store';

const TickMs = 2000;
const RequestGapMs = 1000;

interface State {
  buckets: PackedBucket[];
  occupants: PackedOccupant[];
  everyone: Occupant[];
}

let lastState = '';
let lastWorlds = '';
const lastRequest = new Map<number, number>();
const pendingRequests = new Set<number>();
const sentDensity = new Map<number, string>();

export function registerBroadcast(): void {
  on('playerDropped', () => {
    lastState = '';
    lastRequest.delete(source);
    sentDensity.delete(source);
  });

  onNet(BucketEvents.RequestDensity, () => sendDensity(source, densityOf(bucketOf(source))));

  on(BucketEvents.RequestServerState, () => publishWorlds(allBuckets(), true));

  setInterval(tick, TickMs);

  publishWorlds(allBuckets(), true);
}

export function pushNow(): void {
  const definitions = allBuckets();

  publishWorlds(definitions);
  syncDensity();

  if (!isEnabled()) {
    lastState = '';

    return;
  }

  const state = build(definitions);

  lastState = fingerprint(state);

  sendToEveryone(state);
}

export function requestPush(serverId: number): void {
  if (pendingRequests.has(serverId)) {
    return;
  }

  const wait = (lastRequest.get(serverId) ?? 0) + RequestGapMs - Date.now();

  if (wait <= 0) {
    pushTo(serverId);

    return;
  }

  pendingRequests.add(serverId);

  setTimeout(() => {
    pendingRequests.delete(serverId);

    if (isEnabled() && playerExists(serverId)) {
      pushTo(serverId);
    }
  }, wait);
}

function pushTo(serverId: number): void {
  lastRequest.set(serverId, Date.now());

  sendTo(serverId, bucketOf(serverId), build(allBuckets()));
}

function tick(): void {
  const definitions = allBuckets();

  publishWorlds(definitions);
  syncDensity();

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

// FiveM's own population switch does not always reach a game that rejoins, and it has no in between anyway.
function syncDensity(): void {
  for (const { serverId, bucket } of placements()) {
    const density = densityOf(bucket);

    if (sentDensity.get(serverId) !== densityKey(density)) {
      sendDensity(serverId, density);
    }
  }
}

// Null tells the game to stop setting density, so other scripts are free to.
function sendDensity(serverId: number, density: Density): void {
  const packed = managesDensity() ? packDensity(density) : null;

  sentDensity.set(serverId, densityKey(density));

  emitNet(BucketEvents.Density, serverId, packed);
}

function densityKey(density: Density): string {
  return managesDensity() ? JSON.stringify(packDensity(density)) : 'unmanaged';
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
    density: definition.density,
    lockdown: definition.lockdownMode,
    occupants: counts.get(definition.id) ?? 0,
    name: definition.name,
  }));

  for (const [id, occupants] of counts) {
    if (!bucketExists(id)) {
      buckets.push({ id, managed: false, density: fullDensity(), lockdown: 'inactive', occupants, name: '' });
    }
  }

  const occupants = everyone.map((occupant) =>
    packOccupant({ bucketId: occupant.bucket, serverId: occupant.serverId, name: occupant.name }),
  );

  return { buckets: buckets.map(packBucket), occupants, everyone };
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
      population: !isEmpty(definition.density),
      density: densityFractions(definition.density),
      lockdown: definition.lockdownMode,
    })),
  });

  if (!force && json === lastWorlds) {
    return;
  }

  lastWorlds = json;

  emit(BucketEvents.ServerState, json);
}
