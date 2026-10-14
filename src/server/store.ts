import { cleanText, isValidLockdown, LockdownInactive, type LockdownMode } from '../shared/rules';
import { log } from './log';
import { persistsToDisk } from './settings';

export interface BucketDefinition {
  id: number;
  name: string;
  populationEnabled: boolean;
  lockdownMode: LockdownMode;
}

const FileName = 'buckets.json';

export function loadDefinitions(): BucketDefinition[] {
  const contents = LoadResourceFile(GetCurrentResourceName(), FileName);

  if (!contents || contents.trim().length === 0) {
    return [];
  }

  try {
    const file = lowerKeys(JSON.parse(stripCommentsAndTrailingCommas(contents)));
    const buckets = file?.['buckets'];

    return Array.isArray(buckets) ? buckets.map(lowerKeys).flatMap(readDefinition) : [];
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
  const json = JSON.stringify({ buckets }, null, 2);

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

  while (index < json.length) {
    const character = json[index]!;
    const next = json[index + 1];

    if (character === '"') {
      const end = endOfString(json, index);

      out += json.slice(index, end);
      index = end;
    } else if (character === '/' && next === '/') {
      index = json.indexOf('\n', index);
      index = index < 0 ? json.length : index;
    } else if (character === '/' && next === '*') {
      index = json.indexOf('*/', index + 2);
      index = index < 0 ? json.length : index + 2;
    } else {
      out += character;
      index++;
    }
  }

  return out.replace(/,(\s*[}\]])|"(?:[^"\\]|\\.)*"/g, (match, closer?: string) => closer ?? match);
}

function endOfString(json: string, start: number): number {
  let index = start + 1;

  while (index < json.length && json[index] !== '"') {
    index += json[index] === '\\' ? 2 : 1;
  }

  return Math.min(index + 1, json.length);
}

// The C# version of this plugin read the file case-insensitively, so hand edited files may use any casing.
function lowerKeys(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key.toLowerCase(), inner]));
}

function readDefinition(raw: Record<string, unknown> | undefined): BucketDefinition[] {
  if (raw === undefined || typeof raw['id'] !== 'number') {
    return [];
  }

  const name = raw['name'];
  const population = raw['populationenabled'];
  const lockdown = raw['lockdownmode'];

  return [
    {
      id: raw['id'],
      name: typeof name === 'string' ? cleanText(name) : '',
      populationEnabled: typeof population === 'boolean' ? population : true,
      lockdownMode: isValidLockdown(lockdown) ? lockdown : LockdownInactive,
    },
  ];
}
