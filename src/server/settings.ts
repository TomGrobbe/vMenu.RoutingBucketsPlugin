import { SettingNames } from '../shared/names';
import { isValidLockdown, LockdownInactive, type LockdownMode } from '../shared/rules';

const Prefix = 'vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.';
const MinWorldCap = 1;
const MaxWorldCap = 512;

export function isEnabled(): boolean {
  return GetConvarBool(Prefix + SettingNames.Enabled, true);
}

export function allowsSelfJoin(): boolean {
  return GetConvarBool(Prefix + SettingNames.AllowSelfJoin, true);
}

export function persistsToDisk(): boolean {
  return GetConvarBool(Prefix + SettingNames.Persist, true);
}

export function logsDebug(): boolean {
  return GetConvarBool(Prefix + SettingNames.Debug, false);
}

export function maxWorldCount(): number {
  const configured = GetConvarInt(Prefix + SettingNames.MaxWorlds, 32);

  return Math.min(Math.max(configured, MinWorldCap), MaxWorldCap);
}

export function newWorldLockdown(): LockdownMode {
  const configured = GetConvar(Prefix + SettingNames.DefaultLockdown, LockdownInactive);

  return isValidLockdown(configured) ? configured : LockdownInactive;
}
