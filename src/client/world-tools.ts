const ProbeLength = 100;
const ProbeEverything = -1;
const ProbeOptions = 4;
const SphereMarker = 28;
const SphereAlpha = 60;
const OutlineRed = 90;
const OutlineGreen = 200;
const OutlineBlue = 255;
const OutlineAlpha = 255;

export class WorldTools {
  private selected = 0;
  private sphereRadius = 0;
  private sphereVisible = false;

  selectedNetworkId = 0;

  get hasSelection(): boolean {
    return this.selected !== 0 && DoesEntityExist(this.selected);
  }

  start(): void {
    setTick(() => this.draw());
  }

  selectLookedAt(): boolean {
    const ped = PlayerPedId();
    const [x = 0, y = 0, z = 0] = GetGameplayCamCoord();
    const [dx, dy, dz] = directionFrom(GetGameplayCamRot(2));

    const probe = StartExpensiveSynchronousShapeTestLosProbe(
      x,
      y,
      z,
      x + dx * ProbeLength,
      y + dy * ProbeLength,
      z + dz * ProbeLength,
      ProbeEverything,
      ped,
      ProbeOptions,
    );

    const [, hit, , , entity] = GetShapeTestResult(probe);

    if (!hit || entity === 0 || entity === ped || !DoesEntityExist(entity) || !NetworkGetEntityIsNetworked(entity)) {
      return false;
    }

    this.clear();

    this.selected = entity;
    this.selectedNetworkId = NetworkGetNetworkIdFromEntity(entity);

    SetEntityDrawOutlineColor(OutlineRed, OutlineGreen, OutlineBlue, OutlineAlpha);
    SetEntityDrawOutline(entity, true);

    return true;
  }

  clear(): void {
    if (this.selected !== 0 && DoesEntityExist(this.selected)) {
      SetEntityDrawOutline(this.selected, false);
    }

    this.selected = 0;
    this.selectedNetworkId = 0;
  }

  showSphere(radius: number): void {
    this.sphereRadius = radius;
    this.sphereVisible = true;
  }

  hideSphere(): void {
    this.sphereVisible = false;
  }

  private draw(): void {
    if (this.selected !== 0 && !DoesEntityExist(this.selected)) {
      this.clear();
    }

    if (!this.sphereVisible || this.sphereRadius <= 0) {
      return;
    }

    const ped = PlayerPedId();

    if (ped === 0) {
      return;
    }

    const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, true);
    const size = this.sphereRadius * 2;

    DrawMarker(
      SphereMarker,
      x,
      y,
      z,
      0,
      0,
      0,
      0,
      0,
      0,
      size,
      size,
      size,
      OutlineRed,
      OutlineGreen,
      OutlineBlue,
      SphereAlpha,
      false,
      false,
      2,
      false,
      null!,
      null!,
      false,
    );
  }
}

function directionFrom(rotation: number[]): [number, number, number] {
  const x = ((rotation[0] ?? 0) * Math.PI) / 180;
  const z = ((rotation[2] ?? 0) * Math.PI) / 180;
  const flat = Math.abs(Math.cos(x));

  return [-Math.sin(z) * flat, Math.cos(z) * flat, Math.sin(x)];
}
