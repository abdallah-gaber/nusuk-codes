import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsClient, sendGoogleCommand } from "./analytics";

afterEach(() => vi.unstubAllGlobals());

// Protocol-aware consumer, not a replacement for real-property network testing.
// Google dispatches Arguments as gtag commands; arrays take its method-call path.
function fixture({ delayed = false, id = "G-TEST123456" } = {}) {
  const scope: { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: string]: unknown } = {};
  vi.stubGlobal("window", scope);
  const collected: { event: string; parameters: unknown }[] = [];
  let cursor = 0, granted = false, configured = false;
  function drain() {
    const queue = scope.dataLayer!;
    while (cursor < queue.length) {
      const message = queue[cursor++];
      if (Object.prototype.toString.call(message) !== "[object Arguments]") continue;
      const command = message as IArguments;
      if (command[0] === "consent") granted = command[2].analytics_storage === "granted";
      if (command[0] === "config") {
        expect(command[1]).toBe(id);
        expect(command[2]).toMatchObject({ send_page_view: false, cookie_domain: "none", cookie_expires: 0,
          allow_google_signals: false, allow_ad_personalization_signals: false });
        configured = true;
      }
      if (command[0] === "event" && granted && configured && !scope["ga-disable-" + id])
        collected.push({ event: command[1], parameters: command[2] });
    }
  }
  function installTag() {
    const queue = scope.dataLayer!;
    queue.push = (...messages: unknown[]) => {
      const length = Array.prototype.push.apply(queue, messages);
      drain();
      return length;
    };
    drain();
  }
  const runtime = {
    send: sendGoogleCommand,
    load: vi.fn(() => { if (!delayed) installTag(); }),
    disable: vi.fn((tag: string, disabled: boolean) => { scope["ga-disable-" + tag] = disabled; }),
    clearCookies: vi.fn(),
    search: () => "?code=must-not-send&email=must-not-send",
    referrer: () => "",
  };
  const client = new AnalyticsClient(id, { production: true, hostname: "nusuk.abdallahgaber.dev",
    deployment: "production", manualEventsOnly: true }, runtime);
  return { client, scope, runtime, collected, installTag };
}

describe("real gtag command transport and collection contract", () => {
  it("queues Arguments, with consent/config before script load, then collects sanitized events", () => {
    const { client, scope, runtime, collected } = fixture();
    client.setPage("en");
    client.track("next_code", { locale: "en" });
    expect(scope.dataLayer).toBeUndefined();
    expect(collected).toEqual([]);
    expect(runtime.load).not.toHaveBeenCalled();
    client.setConsent("granted");
    client.track("copy_code", { locale: "en", source: "browser", code: "must-not-send" } as never);
    expect(scope.dataLayer!.every(message => Object.prototype.toString.call(message) === "[object Arguments]")).toBe(true);
    expect(scope.dataLayer!.map(message => (message as IArguments)[0]).slice(0, 4))
      .toEqual(["consent", "consent", "js", "config"]);
    expect(collected).toEqual([
      { event: "page_view", parameters: { locale: "en", page_location: "https://nusuk.abdallahgaber.dev/en/",
        page_title: expect.any(String), page_referrer: "" } },
      { event: "copy_code", parameters: { locale: "en", source: "browser" } },
    ]);
    expect(JSON.stringify(collected)).not.toContain("must-not-send");
  });
  it("demonstrates why the former array-based shim never reached the command dispatcher", () => {
    const { client, scope, collected } = fixture();
    scope.gtag = (...args) => { scope.dataLayer!.push(args); };
    client.setConsent("granted");
    client.track("next_code", { locale: "en" });
    expect(collected).toEqual([]);
  });
  it("never collects before consent or after withdrawal, and regrant does not duplicate initialization", () => {
    const { client, runtime, collected, scope } = fixture();
    client.setConsent("denied");
    client.track("next_code", { locale: "en" });
    expect(scope.dataLayer).toBeUndefined();
    client.setConsent("granted");
    const count = collected.length;
    client.setConsent("denied");
    client.track("next_code", { locale: "en" });
    client.setPage("ur");
    client.setConsent("denied");
    expect(collected).toHaveLength(count);
    expect(scope["ga-disable-G-TEST123456"]).toBe(true);
    client.setConsent("granted");
    client.setConsent("granted");
    expect(collected).toHaveLength(count + 1);
    expect(runtime.load).toHaveBeenCalledTimes(1);
    expect(scope.dataLayer!.filter(message => (message as IArguments)[0] === "config")).toHaveLength(1);
  });
  it("honors withdrawal before the delayed tag processes its queued commands", () => {
    const { client, installTag, collected, scope } = fixture({ delayed: true });
    client.setConsent("granted");
    client.track("next_code", { locale: "en" });
    client.setConsent("denied");
    installTag();
    expect(scope["ga-disable-G-TEST123456"]).toBe(true);
    expect(collected).toEqual([]);
    client.track("next_code", { locale: "en" });
    expect(collected).toEqual([]);
  });
  it("preserves an existing data layer and existing Google-compatible shim", () => {
    const scope = { dataLayer: [{ event: "existing" }] as unknown[], gtag: vi.fn() };
    vi.stubGlobal("window", scope);
    const queue = scope.dataLayer;
    sendGoogleCommand("event", "next_code", { locale: "en" });
    expect(scope.dataLayer).toBe(queue);
    expect(scope.dataLayer).toEqual([{ event: "existing" }]);
    expect(scope.gtag).toHaveBeenCalledWith("event", "next_code", { locale: "en" });
  });
});
