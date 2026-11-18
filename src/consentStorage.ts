import { CONSENT_KEY, readConsent, saveConsent, type Consent } from "./analytics";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local: StorageAccess = () => localStorage;
const session: StorageAccess = () => sessionStorage;

export function loadConsent(primary = local, fallback = session): Consent | undefined {
  // A fallback records a newer choice whose primary write failed. In particular,
  // an old local "granted" must never override a session-only withdrawal.
  try { const value = readConsent(fallback()); if (value) return value; } catch { /* Blocked getter. */ }
  try { return readConsent(primary()); } catch { return undefined; }
}
export function saveSessionConsent(value: Consent | undefined, access = session) {
  try {
    if (value) saveConsent(access(), value);
    else access().removeItem(CONSENT_KEY);
  } catch { /* The mounted component still keeps the session choice in memory. */ }
}
export function persistConsent(value: Consent, primary = local, fallback = session) {
  try {
    if (saveConsent(primary(), value)) {
      saveSessionConsent(undefined, fallback);
      return "local";
    }
  } catch { /* Blocked getter. */ }
  try { if (saveConsent(fallback(), value)) return "session"; } catch { /* Memory only. */ }
  return "memory";
}
export function syncSessionConsent(value: Consent, primary = local, fallback = session) {
  try {
    // A normal broadcast duplicates a successful localStorage write. Do not
    // leave a stale session copy that could survive an explicit primary reset.
    if (readConsent(primary()) === value) {
      saveSessionConsent(undefined, fallback);
      return;
    }
  } catch { /* Use the session fallback when primary storage is unavailable. */ }
  saveSessionConsent(value, fallback);
}
export function storageConsent(event: Pick<StorageEvent, "key" | "newValue">): { value: Consent | undefined } | undefined {
  if (event.key !== CONSENT_KEY && event.key !== null) return;
  return { value: event.newValue === "granted" || event.newValue === "denied" ? event.newValue : undefined };
}
