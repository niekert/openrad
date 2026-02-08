const PREFIX = "openrad:compare-offset:";

function key(primaryUID: string, compareUID: string): string {
  return `${PREFIX}${primaryUID}:${compareUID}`;
}

export function loadCompareOffset(primaryUID: string, compareUID: string): number {
  try {
    const raw = localStorage.getItem(key(primaryUID, compareUID));
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveCompareOffset(primaryUID: string, compareUID: string, offset: number): void {
  try {
    if (offset === 0) {
      localStorage.removeItem(key(primaryUID, compareUID));
    } else {
      localStorage.setItem(key(primaryUID, compareUID), String(offset));
    }
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearCompareOffset(primaryUID: string, compareUID: string): void {
  try {
    localStorage.removeItem(key(primaryUID, compareUID));
  } catch {
    // silently ignore
  }
}
