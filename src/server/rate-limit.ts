interface Window {
  startedMs: number;
  used: number;
}

export type RateLimit = (serverId: number) => boolean;

export function createRateLimit(allowance: number, windowMs: number): RateLimit {
  const windows = new Map<number, Window>();

  on('playerDropped', () => windows.delete(source));

  return (serverId) => {
    const now = Date.now();
    const window = windows.get(serverId);

    if (!window || now - window.startedMs >= windowMs) {
      windows.set(serverId, { startedMs: now, used: 1 });

      return true;
    }

    if (window.used >= allowance) {
      return false;
    }

    window.used++;

    return true;
  };
}
