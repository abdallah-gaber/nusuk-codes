import { describe, expect, it, vi } from "vitest";
import { CONSENT_KEY } from "./analytics";
import { loadConsent, persistConsent, saveSessionConsent, storageConsent, syncSessionConsent } from "./consentStorage";

function storage(initial?: string) {
  const values = new Map(initial ? [[CONSENT_KEY, initial]] : []);
  return { getItem: vi.fn((key: string) => values.get(key) || null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
const blocked = () => { throw new Error("SecurityError"); };
describe("existing consent key with session fallback", () => {
  it.each(["granted", "denied"] as const)("persists %s and survives reload without a second format", (value) => {
    const local = storage(), session = storage();
    expect(persistConsent(value, () => local, () => session)).toBe("local");
    expect(loadConsent(() => local, () => session)).toBe(value);
    expect(local.setItem).toHaveBeenCalledWith(CONSENT_KEY, value);
    expect(session.removeItem).toHaveBeenCalledWith(CONSENT_KEY);
  });
  it("uses session storage for a blocked localStorage getter and preserves withdrawal over reload", () => {
    const session = storage();
    expect(persistConsent("granted", blocked, () => session)).toBe("session");
    expect(loadConsent(blocked, () => session)).toBe("granted");
    persistConsent("denied", blocked, () => session);
    expect(loadConsent(blocked, () => session)).toBe("denied");
  });
  it("uses session storage when local writes fail and tolerates both stores being unavailable", () => {
    const local = storage(), session = storage();
    local.setItem.mockImplementation(blocked);
    expect(persistConsent("denied", () => local, () => session)).toBe("session");
    expect(loadConsent(() => local, () => session)).toBe("denied");
    expect(persistConsent("denied", blocked, blocked)).toBe("memory");
    expect(loadConsent(blocked, blocked)).toBeUndefined();
  });
  it("never restores an old accepted choice over a newer session withdrawal after failed writes", () => {
    const local = storage("granted"), session = storage();
    local.setItem.mockImplementation(blocked);
    expect(persistConsent("denied", () => local, () => session)).toBe("session");
    expect(loadConsent(() => local, () => session)).toBe("denied");
  });
  it("ignores corrupt values and resets stale session choices", () => {
    const session = storage("granted");
    expect(loadConsent(() => storage("corrupt"), () => session)).toBe("granted");
    saveSessionConsent(undefined, () => session);
    expect(loadConsent(() => storage("corrupt"), () => session)).toBeUndefined();
  });
  it("synchronizes fallback choices without leaving normal tabs a stale preference after reset", () => {
    const local = storage("granted"), session = storage();
    syncSessionConsent("granted", () => local, () => session);
    local.removeItem(CONSENT_KEY);
    expect(loadConsent(() => local, () => session)).toBeUndefined();
    syncSessionConsent("denied", blocked, () => session);
    expect(loadConsent(blocked, () => session)).toBe("denied");
  });
  it("interprets cross-tab choices and resets without processing unrelated history events", () => {
    expect(storageConsent({ key: CONSENT_KEY, newValue: "granted" })).toEqual({ value: "granted" });
    expect(storageConsent({ key: CONSENT_KEY, newValue: "denied" })).toEqual({ value: "denied" });
    expect(storageConsent({ key: CONSENT_KEY, newValue: null })).toEqual({ value: undefined });
    expect(storageConsent({ key: null, newValue: null })).toEqual({ value: undefined });
    expect(storageConsent({ key: "nusuk:history", newValue: "granted" })).toBeUndefined();
  });
});
