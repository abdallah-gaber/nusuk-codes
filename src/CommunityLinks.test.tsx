import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreatorSupport, OfficialAppIntro } from "./CommunityLinks";

describe("official app and optional creator support", () => {
  it("uses the unpersonalized official destination for the introduction", () => {
    const html = renderToStaticMarkup(<OfficialAppIntro />);
    expect(html).toContain("أول مرة تستخدم تحدي نسك؟");
    expect(html).toContain('href="https://services.nusuk.sa/app"');
    expect(html).not.toContain("?p=");
    expect(html).not.toContain("NG-dX626jFL");
    expect(html).toContain('aria-labelledby="app-intro-heading"');
  });

  it("labels the creator code explicitly, preserves its exact case and makes support optional", () => {
    const copy = vi.fn();
    const html = renderToStaticMarkup(<CreatorSupport onCopy={copy} />);
    expect(html).toContain('dir="ltr">NG-dX626jFL</code>');
    expect(html).toContain("كود دعوة صاحب الموقع");
    expect(html).toContain("الموقع مجاني ومتاح للجميع");
    expect(html).toContain("استخدام الكود اختياري، واحتساب أي مكافآت يخضع لشروط نسك الرسمية.");
    expect(html).toContain('href="https://services.nusuk.sa/app?p=27&amp;id=NG-dX626jFL"');
    expect(copy).not.toHaveBeenCalled();
  });

  it("announces new-window navigation and isolates both external links", () => {
    for (const html of [
      renderToStaticMarkup(<OfficialAppIntro />),
      renderToStaticMarkup(<CreatorSupport onCopy={vi.fn()} />),
    ]) {
      expect(html).toContain('target="_blank" rel="noopener noreferrer"');
      expect(html).toContain("يفتح في نافذة جديدة");
    }
  });
});
