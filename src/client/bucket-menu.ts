import {
  Gate,
  NotifyStyle,
  Text,
  type PluginBoolSetting,
  type PluginButton,
  type PluginCheckbox,
  type PluginConfirmButton,
  type PluginList,
  type PluginMenu,
  type PluginSeparator,
  type PluginSubmenu,
  type TextLike,
  type VMenuPlugin,
} from '@vespura/vmenu-plugin/client';
import { BucketCommands } from '../shared/commands';
import { Permissions } from '../shared/names';
import { DefaultBucket, lockdownFromIndex, lockdownToIndex, MaxNameLength, Radii } from '../shared/rules';
import type { BucketRow, OccupantRow } from '../shared/state';
import { sendCommand } from './bucket-client';
import { clampIndex, worldName } from './names';
import type { WorldTools } from './world-tools';

// vMenu skips rows past its own limit, so the worlds list stays under it with room for the other rows.
const RowBudget = 1800;
const RowsPerWorld = 11;
const MaxOccupantRows = 20;

interface WorldRows {
  link: PluginSubmenu;
  occupants: PluginSubmenu;
  goto: PluginButton;
  population: PluginCheckbox;
  lockdown: PluginList;
  reset: PluginButton;
  evict: PluginConfirmButton;
  rename: PluginButton;
  delete: PluginConfirmButton;
  occupantLines: PluginButton[];
}

interface Layout {
  current: PluginButton;
  leave: PluginButton;
  worldsHeader: PluginSeparator;
  overflow: PluginButton;
  entityDestination: PluginList;
  nearbyDestination: PluginList;
  radius: PluginList;
  includeSelf: PluginCheckbox;
}

export class BucketMenu {
  private readonly worlds = new Map<number, WorldRows>();
  private readonly order: number[] = [];
  private readonly viewGate: Gate;
  private readonly joinGate: Gate;
  private readonly manageGate: Gate;
  private readonly worldGate: Gate;
  private readonly moveGate: Gate;

  private layout?: Layout;
  private destinationIds: number[] = [];
  private viewerBucket = DefaultBucket;
  private reopenRoot = false;

  constructor(
    private readonly plugin: VMenuPlugin,
    enabled: PluginBoolSetting,
    allowSelfJoin: PluginBoolSetting,
    private readonly tools: WorldTools,
  ) {
    const on = Gate.setting(enabled);

    this.viewGate = Gate.permission(Permissions.View).and(on);
    this.joinGate = Gate.permission(Permissions.Join).and(on).and(Gate.setting(allowSelfJoin));
    this.manageGate = Gate.permission(Permissions.Manage).and(on);
    this.worldGate = Gate.permission(Permissions.World).and(on);
    this.moveGate = Gate.permission(Permissions.Move).and(on);
  }

  apply(viewerBucket: number, buckets: readonly BucketRow[], occupants: readonly OccupantRow[]): void {
    this.viewerBucket = viewerBucket;

    const layout = (this.layout ??= this.build());

    this.syncWorlds(layout, buckets);
    this.refresh(layout, buckets, occupants);
  }

  cancelReopen(): void {
    this.reopenRoot = false;
  }

  private build(): Layout {
    const root = this.plugin.rootMenu;

    root.addSeparator(Text.key('rb.section.you'));

    const current = root.addButton('', {
      description: Text.key('rb.current.desc', { id: String(this.viewerBucket) }),
      gate: this.viewGate,
      hideWhenLocked: true,
    });

    const leave = root.addButton(Text.key('rb.leave'), {
      description: Text.key('rb.leave.desc'),
      gate: this.joinGate,
      hideWhenLocked: true,
    });
    leave.onSelected(() => sendCommand(BucketCommands.Leave));

    const worldsHeader = root.addSeparator(Text.key('rb.section.worlds'));

    const overflow = root.addButton('', {
      description: 'There are more worlds than this menu can hold. Lower MaxWorlds or delete some.',
      enabled: false,
      visible: false,
    });

    const tools = this.buildTools(root);

    root.addSeparator(Text.key('rb.section.manage'));

    root
      .addButton(Text.key('rb.create'), {
        description: Text.key('rb.create.desc'),
        gate: this.manageGate,
        hideWhenLocked: true,
      })
      .onSelected(() => void this.create());

    return { current, leave, worldsHeader, overflow, ...tools };
  }

  private buildTools(
    root: PluginMenu,
  ): Pick<Layout, 'entityDestination' | 'nearbyDestination' | 'radius' | 'includeSelf'> {
    root.addSeparator(Text.key('rb.section.tools'));

    const entity = root.addSubmenu(Text.key('rb.entity'), {
      subtitle: Text.key('rb.subtitle'),
      description: Text.key('rb.entity.desc'),
      gate: this.moveGate,
      hideWhenLocked: true,
    });

    entity.menu
      .addButton(Text.key('rb.entity.select'), { description: Text.key('rb.entity.select.desc') })
      .onSelected(() => {
        const found = this.tools.selectLookedAt();

        this.plugin.notify(
          found ? NotifyStyle.Success : NotifyStyle.Warning,
          Text.key(found ? 'rb.entity.selected' : 'rb.entity.none'),
        );
      });

    entity.menu
      .addButton(Text.key('rb.entity.clear'), { description: Text.key('rb.entity.clear.desc') })
      .onSelected(() => {
        this.tools.clear();
        this.plugin.notify(NotifyStyle.Info, Text.key('rb.entity.cleared'));
      });

    const entityDestination = entity.menu.addList(Text.key('rb.entity.move'), [Text.key('rb.players.none')], {
      description: Text.key('rb.entity.move.desc'),
    });
    entityDestination.onSelected((index) => this.moveSelection(index));

    const nearby = root.addSubmenu(Text.key('rb.nearby'), {
      subtitle: Text.key('rb.subtitle'),
      description: Text.key('rb.nearby.desc'),
      gate: this.moveGate,
      hideWhenLocked: true,
    });

    const radius = nearby.menu.addList(
      Text.key('rb.nearby.radius'),
      Radii.map((metres) => Text.key('rb.nearby.metres', { metres: String(metres) })),
      { description: Text.key('rb.nearby.radius.desc') },
    );

    const nearbyDestination = nearby.menu.addList(Text.key('rb.nearby.destination'), [Text.key('rb.players.none')], {
      description: Text.key('rb.nearby.destination.desc'),
    });

    const includeSelf = nearby.menu.addCheckbox(Text.key('rb.nearby.self'), {
      id: 'nearby.includeSelf',
      checked: false,
      persist: true,
      description: Text.key('rb.nearby.self.desc'),
    });

    const bring = nearby.menu.addConfirmButton(Text.key('rb.nearby.bring'), {
      description: Text.key('rb.nearby.bring.desc'),
      confirmationDescription: Text.key('rb.nearby.bring.confirm'),
    });

    const showSphere = () => this.tools.showSphere(Radii[radius.selectedIndex] ?? Radii[0] ?? 0);
    const hideSphere = () => this.tools.hideSphere();

    bring.onConfirmed(() => this.moveNearby());
    radius.onHighlighted(showSphere);
    radius.onIndexChanged(showSphere);
    nearbyDestination.onHighlighted(hideSphere);
    includeSelf.onHighlighted(showSphere);
    bring.onHighlighted(showSphere);
    nearby.menu.onClosed(hideSphere);

    return { entityDestination, nearbyDestination, radius, includeSelf };
  }

  private moveSelection(index: number): void {
    if (!this.tools.hasSelection) {
      this.plugin.notify(NotifyStyle.Warning, Text.key('rb.entity.nothing'));

      return;
    }

    const id = this.destinationIds[index];

    if (id === undefined) {
      this.plugin.notify(NotifyStyle.Warning, Text.key('rb.pa.stale'));

      return;
    }

    sendCommand(BucketCommands.MoveEntity, this.tools.selectedNetworkId, id);
  }

  private moveNearby(): void {
    const layout = this.layout;
    const id = layout ? this.destinationIds[layout.nearbyDestination.selectedIndex] : undefined;

    if (!layout || id === undefined) {
      this.plugin.notify(NotifyStyle.Warning, Text.key('rb.pa.stale'));

      return;
    }

    const radius = Radii[layout.radius.selectedIndex] ?? Radii[0] ?? 0;

    sendCommand(BucketCommands.MoveNearby, radius, id, layout.includeSelf.checked ? '1' : '0');
  }

  private refreshDestinations(layout: Layout, buckets: readonly BucketRow[]): void {
    const options = buckets.map(worldName);

    this.destinationIds = buckets.map((bucket) => bucket.id);

    for (const list of [layout.entityDestination, layout.nearbyDestination]) {
      list.setOptions(options, clampIndex(list.selectedIndex, options.length));
    }
  }

  private syncWorlds(layout: Layout, buckets: readonly BucketRow[]): void {
    const shown: BucketRow[] = [];
    let budget = RowBudget;
    let skipped = 0;

    for (const bucket of buckets) {
      const cost = RowsPerWorld + Math.min(bucket.occupants, MaxOccupantRows);

      if (budget - cost < 0) {
        skipped++;

        continue;
      }

      budget -= cost;

      shown.push(bucket);
    }

    const root = this.plugin.rootMenu;
    const shownIds = new Set(shown.map((bucket) => bucket.id));

    for (let index = this.order.length - 1; index >= 0; index--) {
      const id = this.order[index]!;

      if (shownIds.has(id)) {
        continue;
      }

      root.remove(this.worlds.get(id)!.link);

      this.worlds.delete(id);
      this.order.splice(index, 1);
    }

    const start = root.items.indexOf(layout.worldsHeader) + 1;

    shown.forEach((bucket, index) => {
      const rows = this.worlds.get(bucket.id);

      if (rows) {
        if (this.order[index] !== bucket.id) {
          root.move(rows.link, start + index);

          this.order.splice(this.order.indexOf(bucket.id), 1);
          this.order.splice(index, 0, bucket.id);
        }

        return;
      }

      root.insertAt(start + index, () => this.worlds.set(bucket.id, this.buildWorld(bucket)));

      this.order.splice(index, 0, bucket.id);
    });

    layout.overflow.text = `${skipped} more world(s) not shown`;
    layout.overflow.visible = skipped > 0;
  }

  private buildWorld(bucket: BucketRow): WorldRows {
    const id = bucket.id;
    const subtitle = Text.key('rb.world.subtitle', { id: String(id) });

    const link = this.plugin.rootMenu.addSubmenu(bucket.name, {
      subtitle,
      gate: this.viewGate,
      hideWhenLocked: true,
    });

    const menu = link.menu;

    const occupants = menu.addSubmenu(Text.key('rb.occupants'), {
      subtitle,
      description: Text.key('rb.occupants.desc'),
      gate: this.viewGate,
    });

    const goto = menu.addButton(Text.key('rb.goto'), {
      description: Text.key('rb.goto.desc'),
      gate: this.joinGate,
      hideWhenLocked: true,
    });
    goto.onSelected(() => sendCommand(BucketCommands.Join, id));

    const population = menu.addCheckbox(Text.key('rb.population'), {
      checked: bucket.populationEnabled,
      description: Text.key('rb.population.desc'),
      gate: this.worldGate,
      hideWhenLocked: true,
    });
    population.onChanged((checked) => sendCommand(BucketCommands.Population, id, checked ? '1' : '0'));

    const lockdown = menu.addList(
      Text.key('rb.lockdown'),
      [Text.key('rb.lockdown.inactive'), Text.key('rb.lockdown.relaxed'), Text.key('rb.lockdown.strict')],
      {
        selectedIndex: lockdownToIndex(bucket.lockdown),
        description: Text.key('rb.lockdown.desc'),
        gate: this.worldGate,
        hideWhenLocked: true,
      },
    );
    lockdown.onSelected((index) => sendCommand(BucketCommands.Lockdown, id, lockdownFromIndex(index)));

    const reset = menu.addButton(Text.key('rb.reset'), {
      description: Text.key('rb.reset.desc'),
      gate: this.worldGate,
      hideWhenLocked: true,
    });
    reset.onSelected(() => sendCommand(BucketCommands.Reset, id));

    const evict = menu.addConfirmButton(Text.key('rb.evict'), {
      description: Text.key('rb.evict.desc'),
      confirmationDescription: Text.key('rb.evict.confirm'),
      gate: this.moveGate,
      hideWhenLocked: true,
      visible: id !== DefaultBucket,
    });
    evict.onConfirmed(() => sendCommand(BucketCommands.Evict, id));

    const rename = menu.addButton(Text.key('rb.rename'), {
      description: Text.key('rb.rename.desc'),
      gate: this.manageGate,
      hideWhenLocked: true,
    });
    rename.onSelected(() => void this.rename(id));

    const remove = menu.addConfirmButton(Text.key('rb.delete'), {
      confirmationDescription: Text.key('rb.delete.confirm'),
      gate: this.manageGate,
      hideWhenLocked: true,
    });
    remove.onConfirmed(() => {
      sendCommand(BucketCommands.Delete, id);

      this.reopenRoot = true;
    });

    return { link, occupants, goto, population, lockdown, reset, evict, rename, delete: remove, occupantLines: [] };
  }

  private refresh(layout: Layout, buckets: readonly BucketRow[], occupants: readonly OccupantRow[]): void {
    const byBucket = new Map<number, OccupantRow[]>();

    for (const occupant of occupants) {
      const list = byBucket.get(occupant.bucketId);

      if (list) {
        list.push(occupant);
      } else {
        byBucket.set(occupant.bucketId, [occupant]);
      }
    }

    for (const bucket of buckets) {
      const id = String(bucket.id);
      const name = worldName(bucket);
      const isHere = bucket.id === this.viewerBucket;

      if (isHere) {
        layout.current.text = Text.key('rb.current', { world: name });
        layout.current.label = Text.key('rb.bucket.label', { id });
        layout.current.description = Text.key('rb.current.desc', { id });
      }

      const rows = this.worlds.get(bucket.id);

      if (!rows) {
        continue;
      }

      const editable = bucket.managed && bucket.id !== DefaultBucket;

      rows.link.text = name;
      rows.link.label = headcount(bucket.occupants);
      rows.link.menu.title = name;
      rows.link.description = Text.key(bucket.managed ? 'rb.world.desc' : 'rb.world.unmanaged.desc', { id });

      rows.population.visible = bucket.managed;
      rows.lockdown.visible = bucket.managed;
      rows.reset.visible = bucket.managed;
      rows.rename.visible = editable;
      rows.delete.visible = editable;

      rows.goto.enabled = !isHere;
      rows.goto.description = Text.key(isHere ? 'rb.goto.here' : 'rb.goto.desc');

      rows.population.checked = bucket.populationEnabled;
      rows.lockdown.selectedIndex = lockdownToIndex(bucket.lockdown);

      rows.evict.enabled = bucket.occupants > 0;

      rows.delete.enabled = bucket.occupants === 0;
      rows.delete.description = Text.key(bucket.occupants === 0 ? 'rb.delete.desc' : 'rb.delete.occupied');

      fillOccupants(rows, byBucket.get(bucket.id) ?? []);
    }

    layout.leave.visible = this.viewerBucket !== DefaultBucket;

    this.refreshDestinations(layout, buckets);

    if (this.reopenRoot) {
      this.reopenRoot = false;

      this.plugin.rootMenu.open();
    }
  }

  private async create(): Promise<void> {
    const typed = await this.plugin.getText(Text.key('rb.create.prompt'), { maxLength: MaxNameLength });

    if (typed === null) {
      return;
    }

    sendCommand(BucketCommands.Create, typed);

    this.reopenRoot = true;
  }

  private async rename(id: number): Promise<void> {
    const typed = await this.plugin.getText(Text.key('rb.rename.prompt'), { maxLength: MaxNameLength });

    if (typed !== null) {
      sendCommand(BucketCommands.Rename, id, typed);
    }
  }
}

function fillOccupants(rows: WorldRows, occupants: readonly OccupantRow[]): void {
  const lines: TextLike[] = occupants
    .slice(0, MaxOccupantRows)
    .map((occupant) => Text.key('rb.occupant', { name: occupant.name, id: String(occupant.serverId) }));

  if (occupants.length > MaxOccupantRows) {
    lines.push(`and ${occupants.length - MaxOccupantRows} more`);
  }

  if (lines.length === 0) {
    lines.push(Text.key('rb.occupants.none'));
  }

  const menu = rows.occupants.menu;

  lines.forEach((line, index) => {
    const existing = rows.occupantLines[index];

    if (existing) {
      existing.text = line;
    } else {
      rows.occupantLines.push(menu.addButton(line, { enabled: false }));
    }
  });

  for (const extra of rows.occupantLines.splice(lines.length)) {
    menu.remove(extra);
  }
}

function headcount(occupants: number): Text {
  if (occupants === 0) {
    return Text.key('rb.players.none');
  }

  return occupants === 1 ? Text.key('rb.players.one') : Text.key('rb.players.many', { count: String(occupants) });
}
