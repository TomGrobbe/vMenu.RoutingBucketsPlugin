export const Permissions = {
  View: 'View',
  Join: 'Join',
  Manage: 'Manage',
  World: 'World',
  Move: 'Move',
} as const;

export const SettingNames = {
  Enabled: 'Enabled',
  AllowSelfJoin: 'AllowSelfJoin',
  MaxWorlds: 'MaxWorlds',
  DefaultLockdown: 'DefaultLockdown',
  Persist: 'Persist',
  Debug: 'Debug',
} as const;
