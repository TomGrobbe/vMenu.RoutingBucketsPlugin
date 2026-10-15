import {
  fullDensity,
  isFull,
  toFraction,
  unpackDensity,
  type Density,
  type PackedDensity,
} from "../shared/density";
import { BucketEvents } from "../shared/events";

const MapEdge = 8192;
const MapHeight = 1024;

export class DensityGuard {
  private density = fullDensity();
  private tick = -1;
  private blockingArea = -1;

  start(): void {
    onNet(BucketEvents.Density, (packed: PackedDensity | null) =>
      this.apply(packed ? unpackDensity(packed) : fullDensity()),
    );

    on("onResourceStop", (resource: string) => {
      if (resource === GetCurrentResourceName()) {
        this.apply(fullDensity());
      }
    });

    emitNet(BucketEvents.RequestDensity);
  }

  private apply(density: Density): void {
    this.density = density;

    this.setScenariosBlocked(density.scenarios === 0);

    if (isFull(density)) {
      if (this.tick !== -1) {
        clearTick(this.tick);

        this.tick = -1;
      }
    } else if (this.tick === -1) {
      this.tick = setTick(() => this.suppress());
    }
  }

  // FiveM's own population switch blocks scenarios with the same area, on top of the multiplier.
  private setScenariosBlocked(blocked: boolean): void {
    if (blocked === (this.blockingArea !== -1)) {
      return;
    }

    if (blocked) {
      this.blockingArea = AddScenarioBlockingArea(
        -MapEdge,
        -MapEdge,
        -MapHeight,
        MapEdge,
        MapEdge,
        MapHeight,
        false,
        true,
        true,
        true,
      );

      return;
    }

    RemoveScenarioBlockingArea(this.blockingArea, false);

    this.blockingArea = -1;
  }

  private suppress(): void {
    const { peds, scenarios, traffic, parked } = this.density;

    SetPedDensityMultiplierThisFrame(toFraction(peds));
    SetScenarioPedDensityMultiplierThisFrame(
      toFraction(scenarios),
      toFraction(scenarios),
    );
    SetRandomVehicleDensityMultiplierThisFrame(toFraction(traffic));
    SetParkedVehicleDensityMultiplierThisFrame(toFraction(parked));

    if (traffic === 0) {
      SetAmbientVehicleRangeMultiplierThisFrame(0);
    }
  }
}
