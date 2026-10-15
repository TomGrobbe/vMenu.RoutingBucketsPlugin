import { ServerPluginDeclaration, VMenuServer } from '@vespura/vmenu-plugin/server';
import { Permissions, SettingNames } from '../shared/names';
import { registerBroadcast } from './broadcast';
import { registerCommandRouter } from './command-router';
import { log } from './log';
import { bucketCount, loadBuckets } from './registry';
import { registerServerCommandRouter } from './server-command-router';

loadBuckets();

registerCommandRouter();
registerServerCommandRouter();
registerBroadcast();

const declaration = new ServerPluginDeclaration('Routing Buckets')
  .addPermission(
    Permissions.View,
    'Lets someone open the Routing Buckets menu and see which worlds exist and who is in them.',
    false,
  )
  .addPermission(
    Permissions.Join,
    'Lets someone move themselves between worlds, including to whichever world another player is in.',
    false,
  )
  .addPermission(Permissions.Manage, 'Lets someone create, rename and delete worlds.', true)
  .addPermission(
    Permissions.World,
    "Lets someone change how many pedestrians and cars a world has, and change its entity lockdown.",
    true,
  )
  .addPermission(
    Permissions.Move,
    'Lets someone move other players between worlds, and empty a world back into the main one.',
    true,
  )
  .addBoolSetting(
    SettingNames.Enabled,
    true,
    'Turns the Routing Buckets plugin on or off. Off hides every row and refuses every action.',
  )
  .addBoolSetting(
    SettingNames.AllowSelfJoin,
    true,
    'Lets staff move themselves between worlds. Off leaves them able to move other players only.',
  )
  .addIntSetting(
    SettingNames.MaxWorlds,
    32,
    'How many worlds may exist at once, not counting the main world. Raising this a long way ' +
      'can make the menu big enough that vMenu starts skipping rows.',
  )
  .addStringSetting(
    SettingNames.DefaultLockdown,
    'inactive',
    'The entity lockdown a newly created world starts with: strict, relaxed or inactive.',
  )
  .addBoolSetting(
    SettingNames.Persist,
    true,
    'Saves world names and settings to buckets.json so they survive a restart. Needs ' +
      'add_filesystem_permission in your server.cfg.',
  )
  .addBoolSetting(
    SettingNames.ManageDensity,
    true,
    'Lets the plugin control how many pedestrians and cars each world has. Off leaves that alone ' +
      'completely, so another script can control it instead.',
  )
  .addBoolSetting(
    SettingNames.Debug,
    false,
    'Prints a line to the console for every world change and every player moved between worlds.',
  );

VMenuServer.register(declaration).then((result) =>
  log.info(`Registered with vMenu: ${result.accepted}. ${bucketCount()} world(s) loaded.`),
);
