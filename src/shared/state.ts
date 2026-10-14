import { lockdownFromIndex, lockdownToIndex, type LockdownMode } from './rules';

export interface BucketRow {
  id: number;
  managed: boolean;
  populationEnabled: boolean;
  lockdown: LockdownMode;
  occupants: number;
  name: string;
}

export interface OccupantRow {
  bucketId: number;
  serverId: number;
  name: string;
}

// Rows go to every viewer on every change, so they travel as plain arrays without repeating the field names.
export type PackedBucket = [
  id: number,
  managed: 0 | 1,
  population: 0 | 1,
  lockdown: number,
  occupants: number,
  name: string,
];

export type PackedOccupant = [bucketId: number, serverId: number, name: string];

export function packBucket(row: BucketRow): PackedBucket {
  return [
    row.id,
    row.managed ? 1 : 0,
    row.populationEnabled ? 1 : 0,
    lockdownToIndex(row.lockdown),
    row.occupants,
    row.name,
  ];
}

export function unpackBucket([id, managed, population, lockdown, occupants, name]: PackedBucket): BucketRow {
  return {
    id,
    managed: managed === 1,
    populationEnabled: population === 1,
    lockdown: lockdownFromIndex(lockdown),
    occupants,
    name,
  };
}

export function packOccupant(row: OccupantRow): PackedOccupant {
  return [row.bucketId, row.serverId, row.name];
}

export function unpackOccupant([bucketId, serverId, name]: PackedOccupant): OccupantRow {
  return { bucketId, serverId, name };
}
