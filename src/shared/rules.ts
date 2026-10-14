export const MinId = 0;
export const MaxId = 65535;
export const DefaultBucket = 0;
export const MinNameLength = 1;
export const MaxNameLength = 32;
export const MaxRadius = 100;

export const Radii: readonly number[] = [5, 10, 25, 50, 100];

export const LockdownModes = ['inactive', 'relaxed', 'strict'] as const;

export type LockdownMode = (typeof LockdownModes)[number];

export const LockdownInactive: LockdownMode = 'inactive';

const Whitespace = /\s/u;
const Control = /\p{Cc}/u;
const Controls = /\p{Cc}/gu;
const LetterOrDigit = /[\p{L}\p{Nd}]/u;

export function isValidId(id: number): boolean {
  return Number.isInteger(id) && id >= MinId && id <= MaxId;
}

export function isValidRadius(metres: number): boolean {
  return Number.isInteger(metres) && metres > 0 && metres <= MaxRadius;
}

export function isValidLockdown(mode: unknown): mode is LockdownMode {
  return LockdownModes.includes(mode as LockdownMode);
}

export function lockdownToIndex(mode: LockdownMode): number {
  return Math.max(LockdownModes.indexOf(mode), 0);
}

export function lockdownFromIndex(index: number): LockdownMode {
  return LockdownModes[index] ?? LockdownInactive;
}

export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  let name = '';
  let pendingSpace = false;
  let hasContent = false;

  for (const character of raw) {
    if (Whitespace.test(character)) {
      pendingSpace = name.length > 0;

      continue;
    }

    if (Control.test(character)) {
      continue;
    }

    if (pendingSpace) {
      name += ' ';
      pendingSpace = false;
    }

    name += character;

    hasContent ||= LetterOrDigit.test(character);
  }

  if (!hasContent || name.length < MinNameLength || name.length > MaxNameLength) {
    return null;
  }

  return name;
}

export function cleanText(text: string): string {
  return text.replace(Controls, '');
}
