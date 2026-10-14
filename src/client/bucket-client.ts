import { BucketEvents } from '../shared/events';

export function requestState(): void {
  emitNet(BucketEvents.RequestState);
}

export function sendCommand(command: string, ...args: (string | number)[]): void {
  emitNet(BucketEvents.Command, command, args.map(String));
}
