import { DensityKinds, densityFractions, emptyDensity, fullDensity, stepFromFraction, type Density } from '../shared/density';
import { cleanText, isValidLockdown, LockdownInactive, type LockdownMode } from '../shared/rules';
import { log } from './log';
import { persistsToDisk } from './settings';

export interface BucketDefinition {
  id: number;
  name: string;
  density: Density;
  lockdownMode: LockdownMode;
}

const FileName = 'buckets.json';
const Bom = /^\uFEFF/;

export function loadDefinitions(): BucketDefinition[] {
  const contents = LoadResourceFile(GetCurrentResourceName(), FileName);

  if (!contents || contents.trim().length === 0) {
    return [];
  }

  try {
    const file = lowerKeys(JSON.parse(stripCommentsAndTrailingCommas(contents.replace(Bom, ''))), 'the file');
    const buckets = file['buckets'] ?? [];

    if (!Array.isArray(buckets)) {
      throw new Error('"buckets" is not a list');
    }

    return buckets.map((raw, index) => readDefinition(lowerKeys(raw, `bucket ${index + 1}`), index + 1));
  } catch (error) {
    log.error(
      `${FileName} did not read (${(error as Error).message}). Starting with no saved worlds. The next ` +
        'change you make will overwrite the file, so move it aside now if you want to keep it.',
    );

    return [];
  }
}

export function saveDefinitions(buckets: readonly BucketDefinition[]): boolean {
  if (!persistsToDisk()) {
    return true;
  }

  const resource = GetCurrentResourceName();
  const json = JSON.stringify({ buckets: buckets.map(toFile) }, null, 2);

  if (SaveResourceFile(resource, FileName, json, -1)) {
    return true;
  }

  log.warn(
    `Could not write ${FileName}. Add 'add_filesystem_permission ${resource} write ${resource}' to your ` +
      'server.cfg, above the line that starts the resource. World names and settings will not survive a ' +
      'restart until you do.',
  );

  return false;
}

// Owners edit this file by hand, and the C# version of this plugin accepted comments and trailing commas.
function stripCommentsAndTrailingCommas(json: string): string {
  let out = '';
  let index = 0;
  let openComma = -1;

  while (index < json.length) {
    const character = json[index]!;
    const next = json[index + 1];

    if (character === '"') {
      const end = endOfString(json, index);

      out += json.slice(index, end);
      index = end;
      openComma = -1;
    } else if (character === '/' && next === '/') {
      const end = json.indexOf('\n', index);

      index = end < 0 ? json.length : end;
    } else if (character === '/' && next === '*') {
      const end = json.indexOf('*/', index + 2);

      index = end < 0 ? json.length : end + 2;
    } else {
      if ((character === '}' || character === ']') && openComma >= 0) {
        out = out.slice(0, openComma) + out.slice(openComma + 1);
      }

      if (character === ',') {
        openComma = out.length;
      } else if (!/\s/.test(character)) {
        openComma = -1;
      }

      out += character;
      index++;
    }
  }

  return out;
}

function endOfString(json: string, start: number): number {
  let index = start + 1;

  while (index < json.length && json[index] !== '"') {
    index += json[index] === '\\' ? 2 : 1;
  }

  return Math.min(index + 1, json.length);
}

// The C# version of this plugin read the file case-insensitively, so hand edited files may use any casing.
function lowerKeys(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`);
  }

  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key.toLowerCase(), inner]));
}

function readDefinition(raw: Record<string, unknown>, position: number): BucketDefinition {
  const { id, name = '', density, populationenabled = true, lockdownmode = LockdownInactive } = raw;

  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error(`bucket ${position} has no whole number "id"`);
  }

  if (
    (name !== null && typeof name !== 'string') ||
    typeof populationenabled !== 'boolean' ||
    typeof lockdownmode !== 'string'
  ) {
    throw new Error(`bucket ${position} has a "name", "populationEnabled" or "lockdownMode" of the wrong type`);
  }

  return {
    id,
    name: cleanText(name ?? ''),
    // Files from before the density sliders only have the old on or off switch.
    density:
      density === undefined
        ? populationenabled
          ? fullDensity()
          : emptyDensity()
        : readDensity(lowerKeys(density, `the "density" of bucket ${position}`), position),
    lockdownMode: isValidLockdown(lockdownmode) ? lockdownmode : LockdownInactive,
  };
}

function readDensity(raw: Record<string, unknown>, position: number): Density {
  const density = fullDensity();

  for (const kind of DensityKinds) {
    const value = raw[kind];

    if (value === undefined) {
      continue;
    }

    const step = stepFromFraction(value);

    if (step === undefined) {
      throw new Error(`bucket ${position} has a "${kind}" density that is not a number from 0 to 1`);
    }

    density[kind] = step;
  }

  return density;
}

function toFile(definition: BucketDefinition): Record<string, unknown> {
  return {
    id: definition.id,
    name: definition.name,
    density: densityFractions(definition.density),
    lockdownMode: definition.lockdownMode,
  };
}
