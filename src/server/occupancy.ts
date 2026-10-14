import { cleanText, DefaultBucket, isValidId } from '../shared/rules';
import { bucketExists } from './registry';

export interface Placement {
  serverId: number;
  bucket: number;
}

export interface Occupant extends Placement {
  name: string;
}

const DriverSeat = -1;

export function placements(): Placement[] {
  const result: Placement[] = [];
  const count = GetNumPlayerIndices();

  for (let index = 0; index < count; index++) {
    const handle = GetPlayerFromIndex(index);
    const serverId = Number(handle);

    if (handle && Number.isInteger(serverId)) {
      result.push({ serverId, bucket: GetPlayerRoutingBucket(handle) });
    }
  }

  return result;
}

export function snapshot(): Occupant[] {
  return placements().map((placement) => ({ ...placement, name: playerName(placement.serverId) }));
}

export function playerName(serverId: number): string {
  const name = cleanText(GetPlayerName(handle(serverId)) ?? '');

  return name.trim().length > 0 ? name : `#${serverId}`;
}

export function countIn(bucketId: number): number {
  return placements().filter((placement) => placement.bucket === bucketId).length;
}

export function moveAllTo(fromBucket: number, toBucket: number): number[] {
  const moved: number[] = [];

  for (const placement of placements()) {
    if (placement.bucket !== fromBucket) {
      continue;
    }

    SetPlayerRoutingBucket(handle(placement.serverId), toBucket);
    takeVehicleAlong(placement.serverId, toBucket);
    moved.push(placement.serverId);
  }

  return moved;
}

export function isReachable(bucket: number): boolean {
  return bucket === DefaultBucket || bucketExists(bucket) || (isValidId(bucket) && countIn(bucket) > 0);
}

export function bucketOf(serverId: number): number {
  return GetPlayerRoutingBucket(handle(serverId));
}

export function playerExists(serverId: number): boolean {
  return DoesPlayerExist(handle(serverId));
}

export function move(serverId: number, bucket: number): boolean {
  if (!isValidId(bucket) || !playerExists(serverId)) {
    return false;
  }

  SetPlayerRoutingBucket(handle(serverId), bucket);

  takeVehicleAlong(serverId, bucket);

  return true;
}

function takeVehicleAlong(serverId: number, bucket: number): void {
  const ped = GetPlayerPed(handle(serverId));

  if (ped === 0 || !DoesEntityExist(ped)) {
    return;
  }

  const vehicle = GetVehiclePedIsIn(ped, false);

  if (vehicle === 0 || !DoesEntityExist(vehicle)) {
    return;
  }

  if (GetPedInVehicleSeat(vehicle, DriverSeat) !== ped) {
    return;
  }

  SetEntityRoutingBucket(vehicle, bucket);
}

export function handle(serverId: number): string {
  return String(serverId);
}
