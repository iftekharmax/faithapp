const KEY = "faith.undoDurationMs";
export const UNDO_MIN_MS = 3000;
export const UNDO_MAX_MS = 30000;
export const UNDO_DEFAULT_MS = 6000;

export function getUndoDurationMs(): number {
  if (typeof window === "undefined") return UNDO_DEFAULT_MS;
  const raw = Number(localStorage.getItem(KEY));
  if (!Number.isFinite(raw) || raw <= 0) return UNDO_DEFAULT_MS;
  return Math.min(UNDO_MAX_MS, Math.max(UNDO_MIN_MS, Math.round(raw)));
}

export function setUndoDurationMs(ms: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.min(UNDO_MAX_MS, Math.max(UNDO_MIN_MS, Math.round(ms)));
  localStorage.setItem(KEY, String(clamped));
}
