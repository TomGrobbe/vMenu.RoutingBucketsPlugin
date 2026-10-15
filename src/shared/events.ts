const Prefix = 'vMenu.RoutingBucketsPlugin:';

export const BucketEvents = {
  RequestState: `${Prefix}RequestState`,
  Command: `${Prefix}Command`,
  State: `${Prefix}State`,
  Result: `${Prefix}Result`,
  Moved: `${Prefix}Moved`,
  Density: `${Prefix}Density`,
  RequestDensity: `${Prefix}RequestDensity`,
  ServerState: `${Prefix}ServerState`,
  RequestServerState: `${Prefix}RequestServerState`,
  ServerCommand: `${Prefix}ServerCommand`,
  ServerCommandResult: `${Prefix}ServerCommandResult`,
} as const;
