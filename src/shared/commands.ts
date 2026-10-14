export const BucketCommands = {
  Create: 'create',
  Rename: 'rename',
  Delete: 'delete',
  Join: 'join',
  Leave: 'leave',
  Population: 'population',
  Lockdown: 'lockdown',
  Reset: 'reset',
  Evict: 'evict',
  Bring: 'bring',
  Send: 'send',
  Goto: 'goto',
  MoveEntity: 'moveentity',
  MoveNearby: 'movenearby',
} as const;

export const ResultDetails = {
  Created: 'created',
  Renamed: 'renamed',
  Evicted: 'evicted',
  MovedNearby: 'movednearby',
  MovedEntity: 'movedentity',
} as const;

export const BucketOutcome = {
  Ok: 0,
  Denied: 1,
  UnknownBucket: 2,
  NameTaken: 3,
  BadName: 4,
  TooManyBuckets: 5,
  CannotModifyDefault: 6,
  BucketNotEmpty: 7,
  UnknownPlayer: 8,
  SaveFailed: 9,
  RateLimited: 10,
  UnknownEntity: 11,
  Failed: 12,
  Count: 13,
} as const;

export type BucketOutcome = (typeof BucketOutcome)[Exclude<keyof typeof BucketOutcome, 'Count'>];
