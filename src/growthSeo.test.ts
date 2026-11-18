import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { languages, direction, translate, pathLanguage } from "./i18n";
import { localizedHtml } from "./localeMetadata";

describe("crawlable content and preview protection", () => {
  const source = readFileSync("index.html", "utf8");
  it.each(languages)("%s has visible pre-JS purpose, instructions, disclaimers and alternate links", (language) => {
    const html = localizedHtml(source, language);
    expect(html).toContain('<main class="static-intro"><h1>' + translate(language, "brand"));
    expect(html).toContain(translate(language, "step2Body"));
    expect(html).toContain(translate(language, "transparencyBody"));
    expect(html).toContain(translate(language, "footerDisclaimer"));
    expect(html).toContain('dir="' + direction(language) + '"');
    expect(html.match(/hreflang=/g)).toHaveLength(languages.length + 1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(localizedHtml(html, language)).toBe(html);
    expect(localizedHtml(source, language, true)).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('name="robots" content="noindex');
  });
  it("releases complete Urdu without activating Bengali or Hindi", () => {
    expect(pathLanguage("/ur/")).toBe("ur"); expect(direction("ur")).toBe("rtl");
    expect(pathLanguage("/bn/")).toBeUndefined(); expect(pathLanguage("/hi/")).toBeUndefined();
    expect(translate("ur", "unverified")).toBe("غیر تصدیق شدہ");
    expect(translate("ur", "faq4Answer")).toContain("ضمانت نہیں");
    expect(translate("ur", "creatorDisclaimer")).toContain("اختیاری");
  });
});
