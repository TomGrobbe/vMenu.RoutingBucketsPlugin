import { VMenuServer } from '@vespura/vmenu-plugin/server';
import { BucketCommands, BucketOutcome, ResultDetails } from '../shared/commands';
import { fullDensity } from '../shared/density';
import { BucketEvents } from '../shared/events';
import { Permissions } from '../shared/names';
import { DefaultBucket, isValidId, isValidRadius, LockdownInactive } from '../shared/rules';
import { pushNow, requestPush } from './broadcast';
import { log } from './log';
import { bucketOf, handle, isReachable, placements, playerExists, playerName } from './occupancy';
import { moveAndTell } from './moves';
import { createRateLimit } from './rate-limit';
import { displayName } from './registry';
import { allowsSelfJoin, isEnabled, managesDensity } from './settings';
import { changeWorld, createWorld, deleteWorld, emptyWorld, renameWorld } from './worlds';

interface Handled {
  outcome: BucketOutcome;
  detail?: string[];
}

type Handler = (source: number, args: string[]) => Handled;

const Integer = /^\s*[+-]?\d+\s*$/;

const commandLimit = createRateLimit(15, 10000);

const handlers = new Map<string, Handler>([
  [BucketCommands.Create, create],
  [BucketCommands.Rename, rename],
  [BucketCommands.Delete, remove],
  [BucketCommands.Evict, evict],
  [BucketCommands.Join, join],
  [BucketCommands.Leave, leave],
  [BucketCommands.Density, density],
  [BucketCommands.Lockdown, lockdown],
  [BucketCommands.Reset, reset],
  [BucketCommands.Bring, bring],
  [BucketCommands.Send, send],
  [BucketCommands.Goto, goto],
  [BucketCommands.MoveEntity, moveEntity],
  [BucketCommands.MoveNearby, moveNearby],
]);

export function registerCommandRouter(): void {
  onNet(BucketEvents.RequestState, () => {
    const player = source;

    if (isEnabled() && allowed(player, Permissions.View)) {
      requestPush(player);
    }
  });

  onNet(BucketEvents.Command, (command: unknown, rawArgs: unknown) => {
    const player = source;

    if (!isEnabled()) {
      reply(player, { outcome: BucketOutcome.Denied });

      return;
    }

    if (!commandLimit(player)) {
      reply(player, { outcome: BucketOutcome.RateLimited });

      return;
    }

    const args = Array.isArray(rawArgs) ? rawArgs.map((arg) => (typeof arg === 'string' ? arg : '')) : [];
    const handler = typeof command === 'string' ? handlers.get(command) : undefined;
    const handled = handler ? handler(player, args) : { outcome: BucketOutcome.Failed };

    reply(player, handled);

    if (handled.outcome === BucketOutcome.Ok || handled.outcome === BucketOutcome.SaveFailed) {
      pushNow();
    }
  });
}

function create(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Manage)) {
    return { outcome: BucketOutcome.Denied };
  }

  const { outcome, world } = createWorld(args[0], playerName(source));

  return { outcome, detail: world ? [ResultDetails.Created, world.name, String(world.id)] : undefined };
}

function rename(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Manage)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  const { outcome, name } = renameWorld(id, args[1], playerName(source));

  return { outcome, detail: name !== undefined ? [ResultDetails.Renamed, name] : undefined };
}

function remove(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Manage)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  return { outcome: id === undefined ? BucketOutcome.Failed : deleteWorld(id, playerName(source)) };
}

function evict(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Move)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  const { outcome, moved } = emptyWorld(id, playerName(source));

  return { outcome, detail: outcome === BucketOutcome.Ok ? [ResultDetails.Evicted, String(moved)] : undefined };
}

function join(source: number, args: string[]): Handled {
  if (!mayMoveSelf(source)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(id)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  moveAndTell(source, id, '');

  log.debug(() => `${playerName(source)} moved themselves into world ${id}.`);

  return { outcome: BucketOutcome.Ok };
}

function leave(source: number): Handled {
  if (!mayMoveSelf(source)) {
    return { outcome: BucketOutcome.Denied };
  }

  moveAndTell(source, DefaultBucket, '');

  log.debug(() => `${playerName(source)} moved themselves back to the main world.`);

  return { outcome: BucketOutcome.Ok };
}

function density(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.World)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);
  const kind = args[1];
  const step = readInteger(args, 2);

  if (id === undefined || kind === undefined || step === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  return { outcome: changeWorld(id, { density: { [kind]: step } }, playerName(source)) };
}

function lockdown(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.World)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  return { outcome: changeWorld(id, { lockdown: args[1] }, playerName(source)) };
}

function reset(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.World)) {
    return { outcome: BucketOutcome.Denied };
  }

  const id = readId(args, 0);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  return { outcome: changeWorld(
      id,
      { density: managesDensity() ? fullDensity() : undefined, lockdown: LockdownInactive },
      playerName(source),
    ) };
}

function bring(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Move)) {
    return { outcome: BucketOutcome.Denied };
  }

  const target = readTarget(args, 0);

  if (target === undefined) {
    return { outcome: BucketOutcome.UnknownPlayer };
  }

  const bucket = bucketOf(source);

  moveAndTell(target, bucket, playerName(source));

  log.debug(() => `${playerName(source)} brought ${playerName(target)} into world ${bucket}.`);

  return { outcome: BucketOutcome.Ok };
}

function send(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Move)) {
    return { outcome: BucketOutcome.Denied };
  }

  const target = readTarget(args, 0);

  if (target === undefined) {
    return { outcome: BucketOutcome.UnknownPlayer };
  }

  const id = readId(args, 1);

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(id)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  moveAndTell(target, id, playerName(source));

  log.debug(() => `${playerName(source)} sent ${playerName(target)} to world ${id}.`);

  return { outcome: BucketOutcome.Ok };
}

function goto(source: number, args: string[]): Handled {
  if (!mayMoveSelf(source)) {
    return { outcome: BucketOutcome.Denied };
  }

  const target = readTarget(args, 0);

  if (target === undefined) {
    return { outcome: BucketOutcome.UnknownPlayer };
  }

  const bucket = bucketOf(target);

  moveAndTell(source, bucket, '');

  log.debug(() => `${playerName(source)} moved themselves into world ${bucket}.`);

  return { outcome: BucketOutcome.Ok };
}

function moveEntity(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Move)) {
    return { outcome: BucketOutcome.Denied };
  }

  const networkId = readInteger(args, 0);
  const bucket = readId(args, 1);

  if (networkId === undefined || bucket === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(bucket)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const entity = NetworkGetEntityFromNetworkId(networkId);

  if (entity === 0 || !DoesEntityExist(entity)) {
    return { outcome: BucketOutcome.UnknownEntity };
  }

  if (IsPedAPlayer(entity)) {
    return { outcome: BucketOutcome.Failed };
  }

  SetEntityRoutingBucket(entity, bucket);

  log.debug(() => `${playerName(source)} moved entity ${entity} to world ${bucket}.`);

  return { outcome: BucketOutcome.Ok, detail: [ResultDetails.MovedEntity, displayName(bucket)] };
}

function moveNearby(source: number, args: string[]): Handled {
  if (!allowed(source, Permissions.Move)) {
    return { outcome: BucketOutcome.Denied };
  }

  const radius = readInteger(args, 0);
  const bucket = readId(args, 1);

  if (radius === undefined || !isValidRadius(radius) || bucket === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(bucket)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const ped = GetPlayerPed(handle(source));

  if (ped === 0 || !DoesEntityExist(ped)) {
    return { outcome: BucketOutcome.Failed };
  }

  const includeSelf = args[2] === '1';
  const actor = playerName(source);
  const centre = GetEntityCoords(ped);
  const moved = new Set<number>();

  for (const placement of placements()) {
    const isSelf = placement.serverId === source;

    if ((isSelf && !includeSelf) || placement.bucket === bucket || moved.has(placement.serverId)) {
      continue;
    }

    const theirPed = GetPlayerPed(handle(placement.serverId));

    if (theirPed === 0 || !DoesEntityExist(theirPed) || distance(centre, GetEntityCoords(theirPed)) > radius) {
      continue;
    }

    for (const serverId of moveAndTell(placement.serverId, bucket, isSelf ? '' : actor)) {
      moved.add(serverId);
    }
  }

  log.debug(() => `${actor} moved ${moved.size} player(s) within ${radius}m to world ${bucket}.`);

  return { outcome: BucketOutcome.Ok, detail: [ResultDetails.MovedNearby, String(moved.size), displayName(bucket)] };
}

function allowed(source: number, permission: string): boolean {
  return VMenuServer.isPlayerAllowed(handle(source), permission);
}

function mayMoveSelf(source: number): boolean {
  return allowed(source, Permissions.Join) && allowsSelfJoin();
}

function distance(left: number[], right: number[]): number {
  return Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0),
  );
}

function readInteger(args: string[], index: number): number | undefined {
  const value = args[index];

  return value !== undefined && Integer.test(value) ? Number(value) : undefined;
}

function readId(args: string[], index: number): number | undefined {
  const id = readInteger(args, index);

  return id !== undefined && isValidId(id) ? id : undefined;
}

function readTarget(args: string[], index: number): number | undefined {
  const serverId = readInteger(args, index);

  return serverId !== undefined && playerExists(serverId) ? serverId : undefined;
}

function reply(source: number, handled: Handled): void {
  if (playerExists(source)) {
    emitNet(BucketEvents.Result, source, handled.outcome, handled.detail ?? []);
  }
}
