import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  detectLanguage, dictionaries, direction, LANGUAGE_KEY, languagePath, languages, locales,
  pathLanguage, readLanguage, saveLanguage, translate, type TranslationKey,
} from "./i18n";
import { localeMetadata, localizedHtml } from "./localeMetadata";
import { LocaleProvider } from "./LocaleProvider";
import { CreatorSupport, OfficialAppIntro } from "./CommunityLinks";
import { HISTORY_KEY, newHistory, restoreCurrent, type Entry } from "./core";
import { formatDate, formatSeason } from "./presentation";

describe("translation coverage", () => {
  const keys = Object.keys(dictionaries.ar) as TranslationKey[];
  it.each(languages)("%s has every key and the same interpolation fields", (language) => {
    expect(Object.keys(dictionaries[language]).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const text = dictionaries[language][key];
      expect(text.trim(), key).not.toBe("");
      const fields = (value: string) => value.match(/\{\w+\}/g)?.sort() || [];
      expect(fields(text), key).toEqual(fields(dictionaries.ar[key]));
      expect(translate(language, key, { date: "DATE", seen: "2", total: "3",
        percent: "66.7%", matches: "2", shown: "2", code: "NG-dX626jFL", count: "24", current: "1" }))
        .not.toMatch(/\{\w+\}/);
    }
  });
  it("keeps all Arabic UI text in the dictionaries", () => {
    for (const file of ["main.tsx", "CodeList.tsx", "TipsTicker.tsx", "CommunityLinks.tsx", "presentation.ts", "core.ts"]) {
      expect(readFileSync("src/" + file, "utf8"), file).not.toMatch(/[\u0600-\u06ff]/);
    }
  });
  it.each(["en", "id"] as const)("%s retains critical independence, verification and reward disclaimers", (language) => {
    expect(translate(language, "unverified")).toBe(language === "en" ? "Unverified" : "Belum diverifikasi");
    expect(translate(language, "faq3Answer")).toContain(language === "en" ? "unaffiliated" : "tidak berafiliasi");
    expect(translate(language, "faq4Answer")).toContain(language === "en" ? "do not guarantee" : "tidak menjamin");
    expect(translate(language, "creatorDisclaimer")).toContain(language === "en" ? "optional" : "opsional");
    expect(translate(language, "progressDisclaimer")).toContain(language === "en" ? "do not confirm redemption" : "tidak membuktikan keberhasilan");
  });
});

describe("language URLs and preferences", () => {
  it("prioritizes explicit URLs, then saved choice, then ordered browser preferences", () => {
    expect(detectLanguage("/en/", "id", ["ar-EG"])).toBe("en");
    expect(detectLanguage("/", "id", ["en-US"])).toBe("id");
    expect(detectLanguage("/", null, ["fr-FR", "id-ID", "en"])).toBe("id");
    expect(detectLanguage("/", null, ["EN-us"])).toBe("en");
    expect(detectLanguage("/", "invalid", ["de"])).toBe("ar");
    expect(detectLanguage("/", null, [])).toBe("ar");
  });
  it.each(languages)("%s survives refresh/direct navigation with RTL/LTR and existing anchors", (language) => {
    const path = languagePath(language, "?ref=public", "#browser");
    expect(path).toBe("/" + language + "/?ref=public#browser");
    expect(pathLanguage("/" + language)).toBe(language);
    expect(pathLanguage("/" + language + "/")).toBe(language);
    expect(detectLanguage("/" + language + "/", "ar", ["en"])).toBe(language);
    expect(direction(language)).toBe(language === "ar" ? "rtl" : "ltr");
  });
  it("ignores unsupported paths and unavailable preference storage", () => {
    expect(pathLanguage("/english/")).toBeUndefined();
    expect(pathLanguage("/en/unrelated")).toBeUndefined();
    expect(readLanguage({ getItem() { throw new Error("blocked"); } })).toBeNull();
    expect(() => saveLanguage({ setItem() { throw new Error("quota"); } }, "id")).not.toThrow();
  });
  it("saves preferences only under the language key, without changing current-code history", () => {
    const entry: Entry = { code: "NG-dX626jFL", status: "community_submitted_unverified",
      source: "facebook.com", observedAt: "2026-11-05" };
    const history = restoreCurrent(newHistory(), [entry]);
    const original = JSON.stringify(history);
    const values = new Map([[HISTORY_KEY, original]]);
    const storage = { getItem: vi.fn((key: string) => values.get(key) || null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
    for (const language of languages) {
      saveLanguage(storage, language);
      expect(detectLanguage("/", readLanguage(storage), [])).toBe(language);
      expect(values.get(HISTORY_KEY)).toBe(original);
      expect(history.current).toBe(entry.code);
    }
    expect(storage.setItem.mock.calls.every(([key]) => key === LANGUAGE_KEY)).toBe(true);
  });
});

describe("localized rendering and crawler metadata", () => {
  it.each(languages)("%s renders safe official/referral links with exact-case codes", (language) => {
    const copy = vi.fn();
    const html = renderToStaticMarkup(<LocaleProvider initialLanguage={language}>
      <OfficialAppIntro /><CreatorSupport onCopy={copy} />
    </LocaleProvider>);
    expect(html).toContain(translate(language, "officialIntroTitle"));
    expect(html).toContain(translate(language, "creatorDisclaimer"));
    expect(html).toContain('href="https://services.nusuk.sa/app"');
    expect(html).toContain('href="https://services.nusuk.sa/app?p=27&amp;id=NG-dX626jFL"');
    expect(html).toContain('dir="ltr">NG-dX626jFL</code>');
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(copy).not.toHaveBeenCalled();
  });
  it.each(languages)("%s has static translated SEO and reciprocal alternate URLs", (language) => {
    const html = localizedHtml(readFileSync("index.html", "utf8"), language);
    expect(html).toContain('<html lang="' + language + '" dir="' + direction(language) + '">');
    expect(html).toContain("<title>" + translate(language, "pageTitle") + "</title>");
    expect(html).toContain('href="' + localeMetadata(language).canonical + '"');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/hreflang=/g)).toHaveLength(4);
    for (const target of languages) expect(html).toContain('hreflang="' + target + '"');
    expect(html).toContain('hreflang="x-default"');
    expect(localizedHtml(html, language)).toBe(html);
    expect(html).not.toMatch(/__[A-Z_]+__/);
    expect(html).toContain(translate(language, "noScript"));
    expect(html).toContain('id="root"></div>');
  });
  it("routes only supported localized pages while preserving CDN headers", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const language of languages) for (const suffix of ["", "/"]) {
      expect(config.rewrites).toContainEqual({ source: "/" + language + suffix, destination: "/" + language + "/index.html" });
    }
    expect(config.rewrites).toHaveLength(6);
    expect(config.headers[0].source).toBe("/data/manifest.json");
    expect(config.headers[1].source).toBe("/data/codes.:hash.json");
  });
  it.each(languages)("%s formats dataset and observation dates without changing the source value", (language) => {
    const source = "2026-11-05T00:00:00Z";
    expect(formatDate(source, language)).toBe(new Date(source).toLocaleDateString(locales[language],
      { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }));
    expect(formatSeason("nov-2026", language)).not.toContain("{date}");
    expect(formatDate(undefined, language)).toBe(translate(language, "unavailable"));
  });
});
