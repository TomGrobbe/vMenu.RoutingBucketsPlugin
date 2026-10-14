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

export interface Moved {
  serverId: number;
  from: number;
}

export function moveAllTo(fromBucket: number, toBucket: number): Moved[] {
  const moved: Moved[] = [];
  const done = new Set<number>();

  for (const placement of placements()) {
    if (placement.bucket !== fromBucket || done.has(placement.serverId)) {
      continue;
    }

    for (const entry of move(placement.serverId, toBucket)) {
      done.add(entry.serverId);
      moved.push(entry);
    }
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

export function move(serverId: number, bucket: number): Moved[] {
  if (!isValidId(bucket) || !playerExists(serverId)) {
    return [];
  }

  const vehicle = drivenVehicle(serverId);
  const riders = vehicle === 0 ? [] : ridersOf(vehicle, serverId);
  const moved = [{ serverId, from: bucketOf(serverId) }, ...riders];

  for (const entry of moved) {
    SetPlayerRoutingBucket(handle(entry.serverId), bucket);
  }

  if (vehicle !== 0) {
    SetEntityRoutingBucket(vehicle, bucket);
  }

  return moved;
}

function drivenVehicle(serverId: number): number {
  const ped = GetPlayerPed(handle(serverId));

  if (ped === 0 || !DoesEntityExist(ped)) {
    return 0;
  }

  const vehicle = GetVehiclePedIsIn(ped, false);

  if (vehicle === 0 || !DoesEntityExist(vehicle) || GetPedInVehicleSeat(vehicle, DriverSeat) !== ped) {
    return 0;
  }

  return vehicle;
}

function ridersOf(vehicle: number, driver: number): Moved[] {
  return placements()
    .filter((placement) => placement.serverId !== driver)
    .filter((placement) => {
      const ped = GetPlayerPed(handle(placement.serverId));

      return ped !== 0 && GetVehiclePedIsIn(ped, false) === vehicle;
    })
    .map((placement) => ({ serverId: placement.serverId, from: placement.bucket }));
}

export function handle(serverId: number): string {
  return String(serverId);
}
