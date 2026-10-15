export const DensityKinds = ['peds', 'scenarios', 'traffic', 'parked'] as const;

export type DensityKind = (typeof DensityKinds)[number];

// Stored in tenths so 0.1 steps never pick up floating point noise on the way through JSON and the menu.
export type Density = Record<DensityKind, number>;

export type PackedDensity = [peds: number, scenarios: number, traffic: number, parked: number];

export const DensitySteps = 10;

export function fullDensity(): Density {
  return { peds: DensitySteps, scenarios: DensitySteps, traffic: DensitySteps, parked: DensitySteps };
}

export function emptyDensity(): Density {
  return { peds: 0, scenarios: 0, traffic: 0, parked: 0 };
}

export function isDensityKind(kind: unknown): kind is DensityKind {
  return DensityKinds.includes(kind as DensityKind);
}

export function isValidStep(step: unknown): step is number {
  return typeof step === 'number' && Number.isInteger(step) && step >= 0 && step <= DensitySteps;
}

export function stepFromFraction(fraction: unknown): number | undefined {
  if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    return undefined;
  }

  return Math.round(fraction * DensitySteps);
}

export function toFraction(step: number): number {
  return step / DensitySteps;
}

export function isFull(density: Density): boolean {
  return DensityKinds.every((kind) => density[kind] === DensitySteps);
}

export function isEmpty(density: Density): boolean {
  return DensityKinds.every((kind) => density[kind] === 0);
}

export function packDensity(density: Density): PackedDensity {
  return [density.peds, density.scenarios, density.traffic, density.parked];
}

export function unpackDensity([peds, scenarios, traffic, parked]: PackedDensity): Density {
  return { peds, scenarios, traffic, parked };
}

export function densityFractions(density: Density): Record<DensityKind, number> {
  return {
    peds: toFraction(density.peds),
    scenarios: toFraction(density.scenarios),
    traffic: toFraction(density.traffic),
    parked: toFraction(density.parked),
  };
}
