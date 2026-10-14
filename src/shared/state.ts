import type { LockdownMode } from './rules';

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
