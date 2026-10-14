import { DefaultBucket, isValidId, LockdownInactive, MaxId, type LockdownMode } from '../shared/rules';
import { log } from './log';
import { placements } from './occupancy';
import { newWorldLockdown } from './settings';
import { loadDefinitions, saveDefinitions, type BucketDefinition } from './store';

export const DefaultName = 'Main World';

const buckets = new Map<number, BucketDefinition>();

export function bucketCount(): number {
  return buckets.size;
}

export function loadBuckets(): void {
  buckets.clear();

  for (const definition of loadDefinitions()) {
    if (!isValidId(definition.id) || buckets.has(definition.id)) {
      continue;
    }

    buckets.set(definition.id, definition);
  }

  ensureDefault();

  for (const definition of buckets.values()) {
    apply(definition);
  }
}

export function allBuckets(): BucketDefinition[] {
  return [...buckets.values()].sort((left, right) => left.id - right.id);
}

export function bucketExists(id: number): boolean {
  return buckets.has(id);
}

export function displayName(id: number): string {
  const name = buckets.get(id)?.name;

  return name ? name : `World ${id}`;
}

export function nameTaken(name: string, exceptId: number): boolean {
  const lowered = name.toLowerCase();

  for (const definition of buckets.values()) {
    if (definition.id !== exceptId && definition.name.toLowerCase() === lowered) {
      return true;
    }
  }

  return false;
}

function nextFreeId(): number {
  const occupied = new Set(placements().map((placement) => placement.bucket));

  for (let id = DefaultBucket + 1; id <= MaxId; id++) {
    if (!buckets.has(id) && !occupied.has(id)) {
      return id;
    }
  }

  return -1;
}

export function createBucket(normalizedName: string): BucketDefinition | undefined {
  const id = nextFreeId();

  if (id < 0) {
    return undefined;
  }

  const definition: BucketDefinition = {
    id,
    name: normalizedName,
    populationEnabled: true,
    lockdownMode: newWorldLockdown(),
  };

  buckets.set(id, definition);

  apply(definition);

  return definition;
}

export function renameBucket(id: number, normalizedName: string): boolean {
  const definition = buckets.get(id);

  if (!definition) {
    return false;
  }

  definition.name = normalizedName;

  return true;
}

export function deleteBucket(id: number): boolean {
  if (id === DefaultBucket || !buckets.delete(id)) {
    return false;
  }

  apply({ id, name: '', populationEnabled: true, lockdownMode: LockdownInactive });

  return true;
}

export function setPopulation(id: number, enabled: boolean): boolean {
  const definition = buckets.get(id);

  if (!definition) {
    return false;
  }

  definition.populationEnabled = enabled;

  apply(definition);

  return true;
}

export function setLockdown(id: number, mode: LockdownMode): boolean {
  const definition = buckets.get(id);

  if (!definition) {
    return false;
  }

  definition.lockdownMode = mode;

  apply(definition);

  return true;
}

export function saveBuckets(): boolean {
  return saveDefinitions(allBuckets());
}

function ensureDefault(): void {
  const existing = buckets.get(DefaultBucket);

  if (existing) {
    existing.name = DefaultName;

    return;
  }

  buckets.set(DefaultBucket, {
    id: DefaultBucket,
    name: DefaultName,
    populationEnabled: true,
    lockdownMode: LockdownInactive,
  });
}

function apply(definition: BucketDefinition): void {
  try {
    SetRoutingBucketPopulationEnabled(definition.id, definition.populationEnabled);
    SetRoutingBucketEntityLockdownMode(definition.id, definition.lockdownMode);
  } catch (error) {
    log.error(`Could not apply settings to world ${definition.id}: ${(error as Error).message}`);
  }
}
