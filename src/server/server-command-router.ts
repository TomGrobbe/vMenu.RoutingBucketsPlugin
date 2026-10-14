import { BucketOutcome } from '../shared/commands';
import { BucketEvents } from '../shared/events';
import { cleanText, isValidId } from '../shared/rules';
import { pushNow } from './broadcast';
import { log } from './log';
import { isReachable, moveAllTo, placements, playerExists } from './occupancy';
import { moveAndTell, tell } from './moves';
import { isEnabled } from './settings';
import { changeWorld, createWorld, deleteWorld, emptyWorld, renameWorld, who } from './worlds';

type Params = Record<string, unknown>;

interface Handled {
  outcome: BucketOutcome;
  detail?: string;
}

const MinInt32 = -2147483648;
const MaxInt32 = 2147483647;

const handlers = new Map<string, (p: Params) => Handled>([
  ['world-create', create],
  ['world-rename', rename],
  ['world-settings', worldSettings],
  ['world-delete', remove],
  ['world-move-one', moveOne],
  ['world-move-all', moveAll],
  ['world-move-ids', moveIds],
  ['world-empty', empty],
  ['world-transfer', transfer],
]);

export function registerServerCommandRouter(): void {
  on(BucketEvents.ServerCommand, (id: string, action: unknown, paramsJson: unknown) => {
    if (!isEnabled()) {
      reply(id, { outcome: BucketOutcome.Denied });

      return;
    }

    const params = parse(paramsJson);
    const handler = typeof action === 'string' ? handlers.get(action) : undefined;
    const handled = params && handler ? handler(params) : { outcome: BucketOutcome.Failed };

    reply(id, handled);

    if (handled.outcome === BucketOutcome.Ok || handled.outcome === BucketOutcome.SaveFailed) {
      pushNow();
    }
  });
}

function create(p: Params): Handled {
  const { outcome, world } = createWorld(p['name'], operator(p));

  return { outcome, detail: world ? String(world.id) : undefined };
}

function rename(p: Params): Handled {
  const id = readId(p, 'id');

  return { outcome: id === undefined ? BucketOutcome.Failed : renameWorld(id, p['name'], operator(p)).outcome };
}

function worldSettings(p: Params): Handled {
  const id = readId(p, 'id');

  if (id === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  const lockdown = readString(p, 'lockdown');
  const changes = {
    population: typeof p['population'] === 'boolean' ? p['population'] : undefined,
    lockdown: lockdown.length > 0 ? lockdown : undefined,
  };

  return { outcome: changeWorld(id, changes, operator(p)) };
}

function remove(p: Params): Handled {
  const id = readId(p, 'id');

  return { outcome: id === undefined ? BucketOutcome.Failed : deleteWorld(id, operator(p)) };
}

function moveOne(p: Params): Handled {
  const serverId = readInt(p, 'serverId');
  const world = readId(p, 'world');

  if (serverId === undefined || world === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(world)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  if (!playerExists(serverId)) {
    return { outcome: BucketOutcome.UnknownPlayer };
  }

  moveAndTell(serverId, world, operator(p));

  log.debug(`${who(operator(p))} moved player ${serverId} to world ${world}.`);

  return { outcome: BucketOutcome.Ok };
}

function moveAll(p: Params): Handled {
  const world = readId(p, 'world');

  if (world === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(world)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const others = placements().filter((placement) => placement.bucket !== world);
  const moved = others.filter((placement) => moveAndTell(placement.serverId, world, operator(p))).length;

  log.debug(`${who(operator(p))} moved ${moved} player(s) to world ${world}.`);

  return { outcome: BucketOutcome.Ok };
}

function moveIds(p: Params): Handled {
  const world = readId(p, 'world');
  const ids = p['serverIds'];

  if (world === undefined || !Array.isArray(ids)) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(world)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const moved = ids.filter((serverId) => isInt32(serverId) && moveAndTell(serverId, world, operator(p))).length;

  log.debug(`${who(operator(p))} moved ${moved} listed player(s) to world ${world}.`);

  return { outcome: BucketOutcome.Ok };
}

function empty(p: Params): Handled {
  const id = readId(p, 'id');

  return { outcome: id === undefined ? BucketOutcome.Failed : emptyWorld(id, operator(p)).outcome };
}

function transfer(p: Params): Handled {
  const from = readId(p, 'from');
  const to = readId(p, 'to');

  if (from === undefined || to === undefined) {
    return { outcome: BucketOutcome.Failed };
  }

  if (!isReachable(to)) {
    return { outcome: BucketOutcome.UnknownBucket };
  }

  const moved = moveAllTo(from, to);

  for (const serverId of moved) {
    tell(serverId, from, to, operator(p));
  }

  log.debug(`${who(operator(p))} transferred ${moved.length} player(s) from world ${from} to ${to}.`);

  return { outcome: BucketOutcome.Ok };
}

function parse(json: unknown): Params | undefined {
  if (typeof json !== 'string') {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(json.length > 0 ? json : '{}');

    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Params) : undefined;
  } catch {
    return undefined;
  }
}

function operator(p: Params): string {
  return cleanText(readString(p, 'operator'));
}

function readString(p: Params, name: string): string {
  const value = p[name];

  return typeof value === 'string' ? value : '';
}

function isInt32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MinInt32 && value <= MaxInt32;
}

function readInt(p: Params, name: string): number | undefined {
  const value = p[name];

  return isInt32(value) ? value : undefined;
}

function readId(p: Params, name: string): number | undefined {
  const id = readInt(p, name);

  return id !== undefined && isValidId(id) ? id : undefined;
}

function reply(id: string, handled: Handled): void {
  emit(BucketEvents.ServerCommandResult, id, handled.outcome, handled.detail ?? '');
}
