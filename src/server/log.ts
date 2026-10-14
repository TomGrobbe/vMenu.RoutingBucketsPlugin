import { logsDebug } from './settings';

const Prefix = '[RoutingBuckets]';

export const log = {
  debug: (message: () => string) => {
    if (logsDebug()) {
      console.log(`${Prefix} ${message()}`);
    }
  },
  info: (message: string) => console.log(`${Prefix} ${message}`),
  warn: (message: string) => console.warn(`${Prefix} ${message}`),
  error: (message: string) => console.error(`${Prefix} ${message}`),
};
