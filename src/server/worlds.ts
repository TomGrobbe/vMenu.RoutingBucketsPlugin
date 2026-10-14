import { BucketOutcome } from '../shared/commands';
import { DefaultBucket, isValidLockdown, normalizeName } from '../shared/rules';
import { log } from './log';
import { countIn, isReachable } from './occupancy';
import { moveEveryone } from './moves';
import {
  bucketCount,
  bucketExists,
  createBucket,
  deleteBucket,
  nameTaken,
  renameBucket,
  saveBuckets,
  setLockdown,
  setPopulation,
} from './registry';
import type { BucketDefinition } from './store';
import { maxWorldCount } from './settings';

export interface WorldChanges {
  population?: unknown;
  lockdown?: unknown;
}

export function createWorld(rawName: unknown, by: string): { outcome: BucketOutcome; world?: BucketDefinition } {
  const name = normalizeName(rawName);

  if (name === null) {
    return { outcome: BucketOutcome.BadName };
  }

  if (nameTaken(name, -1)) {
    return { outcome: BucketOutcome.NameTaken };
  }

  const world = bucketCount() - 1 < maxWorldCount() ? createBucket(name) : undefined;

  if (!world) {
    return { outcome: BucketOutcome.TooManyBuckets };
  }

  log.debug(() => `${who(by)} created world '${world.name}' (bucket ${world.id}).`);

  return { outcome: saved(), world };
}

export function renameWorld(id: number, rawName: unknown, by: string): { outcome: BucketOutcome; name?: string } {
  if (id === DefaultBucket) {
    return { outcome: BucketOutcome.CannotModifyDefault };
  }

  if (!bucketExists(id)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const name = normalizeName(rawName);

  if (name === null) {
    return { outcome: BucketOutcome.BadName };
  }

  if (nameTaken(name, id)) {
    return { outcome: BucketOutcome.NameTaken };
  }

  renameBucket(id, name);

  log.debug(() => `${who(by)} renamed world ${id} to '${name}'.`);

  return { outcome: saved(), name };
}

export function deleteWorld(id: number, by: string): BucketOutcome {
  if (id === DefaultBucket) {
    return BucketOutcome.CannotModifyDefault;
  }

  if (!bucketExists(id)) {
    return BucketOutcome.UnknownBucket;
  }

  if (countIn(id) > 0) {
    return BucketOutcome.BucketNotEmpty;
  }

  deleteBucket(id);

  log.debug(() => `${who(by)} deleted world ${id}.`);

  return saved();
}

export function changeWorld(id: number, changes: WorldChanges, by: string): BucketOutcome {
  const { population, lockdown } = changes;

  if (!bucketExists(id)) {
    return BucketOutcome.UnknownBucket;
  }

  if (
    (population !== undefined && typeof population !== 'boolean') ||
    (lockdown !== undefined && !isValidLockdown(lockdown))
  ) {
    return BucketOutcome.Failed;
  }

  if (population !== undefined) {
    setPopulation(id, population);
  }

  if (lockdown !== undefined) {
    setLockdown(id, lockdown);
  }

  log.debug(() => `${who(by)} changed world ${id}: ${JSON.stringify(changes)}.`);

  return saved();
}

export function emptyWorld(id: number, by: string): { outcome: BucketOutcome; moved: number } {
  if (id === DefaultBucket) {
    return { outcome: BucketOutcome.CannotModifyDefault, moved: 0 };
  }

  const moved = moveEveryone(id, DefaultBucket, by);

  log.debug(() => `${who(by)} moved ${moved} player(s) out of world ${id}.`);

  return { outcome: BucketOutcome.Ok, moved };
}

export function transferWorld(from: number, to: number, by: string): BucketOutcome {
  if (!isReachable(to)) {
    return BucketOutcome.UnknownBucket;
  }

  const moved = moveEveryone(from, to, by);

  log.debug(() => `${who(by)} transferred ${moved} player(s) from world ${from} to ${to}.`);

  return BucketOutcome.Ok;
}

export function who(by: string): string {
  return by.length > 0 ? by : 'Another resource';
}

function saved(): BucketOutcome {
  return saveBuckets() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
}
