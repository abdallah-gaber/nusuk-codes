import { describe, expect, it, vi } from "vitest";
import { campaigns, campaignParameters, shareUrl, shareWebsite, whatsappUrl, type Campaign } from "./sharing";
import { languages } from "./i18n";

describe("canonical localized sharing", () => {
  it.each(languages)("%s always shares the production locale URL", (locale) => {
    expect(shareUrl(locale)).toBe("https://nusuk.abdallahgaber.dev/" + locale + "/");
    const url = new URL(whatsappUrl(locale, "Community codes · غیر تصدیق شدہ"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toContain(shareUrl(locale, "whatsapp_community"));
  });
  it("uses native share when supported and otherwise copies a clean canonical URL", async () => {
    const copy = vi.fn(), share = vi.fn();
    expect(await shareWebsite("ur", "Title", "Text", { copy, share })).toBe("native");
    expect(share).toHaveBeenCalledWith({ title: "Title", text: "Text", url: shareUrl("ur") });
    expect(copy).not.toHaveBeenCalled();
    expect(await shareWebsite("id", "Title", "Text", { copy })).toBe("clipboard");
    expect(copy).toHaveBeenCalledWith(shareUrl("id"));
  });
  it("falls back for broken in-app sharing but respects explicit cancellation", async () => {
    const copy = vi.fn();
    expect(await shareWebsite("en", "T", "X", { copy, share: vi.fn().mockRejectedValue(new Error("unsupported")) })).toBe("clipboard");
    copy.mockClear();
    await expect(shareWebsite("en", "T", "X", { copy,
      share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) })).rejects.toThrow();
    expect(copy).not.toHaveBeenCalled();
    await expect(shareWebsite("en", "T", "X", { copy: vi.fn().mockRejectedValue(new Error("clipboard denied")) })).rejects.toThrow();
  });
  it("only accepts the documented non-personal campaign triples", () => {
    for (const campaign of Object.keys(campaigns) as Campaign[]) {
      const url = new URL(shareUrl("ur", campaign));
      expect(campaignParameters(url.search)).toEqual({ campaign_name: campaign,
        campaign_source: campaigns[campaign].source, campaign_medium: campaigns[campaign].medium });
    }
    expect(campaignParameters("?utm_campaign=someone@example.com")).toEqual({});
    expect(campaignParameters("?utm_campaign=urdu_launch&utm_source=private@example.com&utm_medium=social")).toEqual({});
  });
  it("accepts exactly the Instagram triple and rejects source/medium/case mismatches", () => {
    expect(campaignParameters("?utm_source=instagram&utm_medium=social&utm_campaign=instagram_community"))
      .toEqual({ campaign_name: "instagram_community", campaign_source: "instagram", campaign_medium: "social" });
    for (const query of [
      "?utm_source=facebook&utm_medium=social&utm_campaign=instagram_community",
      "?utm_source=instagram&utm_medium=private@example.com&utm_campaign=instagram_community",
      "?utm_source=Instagram&utm_medium=social&utm_campaign=instagram_community",
      "?utm_source=instagram&utm_campaign=instagram_community",
    ]) expect(campaignParameters(query)).toEqual({});
  });
});
