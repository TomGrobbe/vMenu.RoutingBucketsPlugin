import { NotifyStyle, Text, VMenuPlugin } from '@vespura/vmenu-plugin/client';
import { BucketOutcome, ResultDetails } from '../shared/commands';
import { BucketEvents } from '../shared/events';
import { SettingNames } from '../shared/names';
import { unpackBucket, unpackOccupant, type PackedBucket, type PackedOccupant } from '../shared/state';
import { requestState } from './bucket-client';
import { BucketMenu } from './bucket-menu';
import { DensityGuard } from './density-guard';
import { PlayerActionRows } from './player-action-rows';
import { addTranslations } from './translations';
import { WorldTools } from './world-tools';

const plugin = VMenuPlugin.create(Text.key('rb.name'));

plugin.descriptionKey = 'rb.description';

addTranslations(plugin);

plugin.rootMenu.subtitle = Text.key('rb.subtitle');

const enabled = plugin.settings.bool(SettingNames.Enabled, true, 'Turns the Routing Buckets plugin on or off.');

const allowSelfJoin = plugin.settings.bool(
  SettingNames.AllowSelfJoin,
  true,
  'Lets staff move themselves between worlds.',
);

const manageDensity = plugin.settings.bool(
  SettingNames.ManageDensity,
  true,
  'Lets the plugin control how many pedestrians and cars each world has.',
);

const debug = plugin.settings.bool(
  SettingNames.Debug,
  false,
  'Prints a line to the console for every world change and every player moved between worlds.',
);

new DensityGuard().start();

const tools = new WorldTools();
tools.start();

const menu = new BucketMenu(plugin, enabled, allowSelfJoin, manageDensity, tools);
const actions = new PlayerActionRows(plugin, enabled, allowSelfJoin);

onNet(BucketEvents.State, (viewerBucket: number, packedBuckets: PackedBucket[], packedOccupants: PackedOccupant[]) => {
  const buckets = packedBuckets.map(unpackBucket);

  plugin.batch(() => {
    menu.apply(viewerBucket, buckets, packedOccupants.map(unpackOccupant));
    actions.setWorlds(buckets);
  });
});

onNet(BucketEvents.Moved, (fromName: string, toName: string, actor: string) => {
  const message =
    actor.length === 0
      ? Text.key('rb.moved.self', { from: fromName, to: toName })
      : Text.key('rb.moved.other', { actor, from: fromName, to: toName });

  plugin.notify(NotifyStyle.Info, message);
});

onNet(BucketEvents.Result, (outcome: number, detail: string[]) => {
  if (outcome === BucketOutcome.Ok) {
    const message = announcement(detail);

    if (message) {
      plugin.notify(NotifyStyle.Success, message);
    }

    return;
  }

  menu.cancelReopen();

  const style =
    outcome === BucketOutcome.SaveFailed || outcome === BucketOutcome.RateLimited
      ? NotifyStyle.Warning
      : NotifyStyle.Error;

  plugin.notify(style, Text.key(resultKey(outcome)));
});

plugin.rootMenu.onOpened(requestState);

plugin.connect().then((result) => {
  if (debug.value) {
    console.log(`[RoutingBuckets] Registered with vMenu: ${result.accepted}.`);
  }

  requestState();
});

function announcement(detail: readonly string[]): Text | undefined {
  const [tag, first = '', second = ''] = detail;

  switch (tag) {
    case ResultDetails.Created:
      return Text.key('rb.created', { name: first, id: second });
    case ResultDetails.Renamed:
      return Text.key('rb.renamed', { name: first });
    case ResultDetails.Evicted:
      return Text.key('rb.evicted', { count: first });
    case ResultDetails.MovedEntity:
      return Text.key('rb.movedentity', { world: first });
    case ResultDetails.MovedNearby:
      return Text.key('rb.movednearby', { count: first, world: second });
    default:
      return undefined;
  }
}

function resultKey(outcome: number): string {
  const known = Number.isInteger(outcome) && outcome >= 0 && outcome < BucketOutcome.Count;

  return `rb.result.${known ? outcome : BucketOutcome.Failed}`;
}
