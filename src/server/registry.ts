import { fullDensity, isEmpty, type Density } from '../shared/density';
import { DefaultBucket, isValidId, LockdownInactive, MaxId, type LockdownMode } from '../shared/rules';
import { log } from './log';
import { placements } from './occupancy';
import { managesDensity, newWorldLockdown } from './settings';
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

export function densityOf(id: number): Density {
  return buckets.get(id)?.density ?? fullDensity();
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
    density: fullDensity(),
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

  apply({ id, name: '', density: fullDensity(), lockdownMode: LockdownInactive });

  return true;
}

export function setDensity(id: number, changes: Partial<Density>): boolean {
  const definition = buckets.get(id);

  if (!definition) {
    return false;
  }

  definition.density = { ...definition.density, ...changes };

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
    density: fullDensity(),
    lockdownMode: LockdownInactive,
  });
}

function apply(definition: BucketDefinition): void {
  try {
    if (managesDensity()) {
      SetRoutingBucketPopulationEnabled(definition.id, !isEmpty(definition.density));
    }

    SetRoutingBucketEntityLockdownMode(definition.id, definition.lockdownMode);
  } catch (error) {
    log.error(`Could not apply settings to world ${definition.id}: ${(error as Error).message}`);
  }
}
