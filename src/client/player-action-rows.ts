import {
  Gate,
  NotifyStyle,
  Text,
  type PluginBoolSetting,
  type PluginPlayerList,
  type VMenuPlugin,
} from '@vespura/vmenu-plugin/client';
import { BucketCommands } from '../shared/commands';
import { Permissions } from '../shared/names';
import type { BucketRow } from '../shared/state';
import { sendCommand } from './bucket-client';
import { clampIndex, worldName } from './names';

export class PlayerActionRows {
  private readonly send: PluginPlayerList;
  private sendIds: number[] = [];

  constructor(
    private readonly plugin: VMenuPlugin,
    enabled: PluginBoolSetting,
    allowSelfJoin: PluginBoolSetting,
  ) {
    const move = Gate.permission(Permissions.Move).and(Gate.setting(enabled));
    const join = Gate.permission(Permissions.Join).and(Gate.setting(enabled)).and(Gate.setting(allowSelfJoin));
    const actions = plugin.playerActions;

    actions.addSeparator(Text.key('rb.pa.header'));

    actions
      .addButton(Text.key('rb.pa.bring'), {
        description: Text.key('rb.pa.bring.desc'),
        gate: move,
        hideWhenLocked: true,
      })
      .onSelected((target) => sendCommand(BucketCommands.Bring, target.serverId));

    this.send = actions.addList(Text.key('rb.pa.send'), [Text.key('rb.players.none')], {
      description: Text.key('rb.pa.send.desc'),
      gate: move,
      hideWhenLocked: true,
    });
    this.send.onSelected((target, index) => this.sendTo(target.serverId, index));

    actions
      .addButton(Text.key('rb.pa.goto'), { description: Text.key('rb.pa.goto.desc'), gate: join, hideWhenLocked: true })
      .onSelected((target) => sendCommand(BucketCommands.Goto, target.serverId));
  }

  setWorlds(buckets: readonly BucketRow[]): void {
    this.sendIds = buckets.map((bucket) => bucket.id);

    this.send.setOptions(buckets.map(worldName), clampIndex(this.send.selectedIndex, this.sendIds.length));
  }

  private sendTo(serverId: number, index: number): void {
    const id = this.sendIds[index];

    if (id === undefined) {
      this.plugin.notify(NotifyStyle.Warning, Text.key('rb.pa.stale'));

      return;
    }

    sendCommand(BucketCommands.Send, serverId, id);
  }
}
