import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const canonical = "https://nusuk.abdallahgaber.dev/";
const meta = (key: string) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]+)"`))?.[1];

describe("static crawler metadata", () => {
  it("has one canonical route, consistent social URLs and Arabic document language", () => {
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain(`rel="canonical" href="${canonical}"`);
    expect(meta("og:url")).toBe(canonical);
    expect(meta("og:type")).toBe("website");
    expect(meta("twitter:card")).toBe("summary_large_image");
    const image = new URL(meta("og:image")!);
    expect(image.origin).toBe(new URL(canonical).origin);
    expect(meta("twitter:image")).toBe(image.href);
    expect(meta("og:image:type")).toBe("image/jpeg");
    expect(meta("og:image:width")).toBe("1200");
    expect(meta("og:image:height")).toBe("630");
    expect(meta("og:image:alt")).toBeTruthy();
    expect(readFileSync(`public${image.pathname}`).subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
    expect(existsSync("public/favicon.svg")).toBe(true);
    expect(existsSync("public/apple-touch-icon.png")).toBe(true);
  });
  it("only advertises the real route and gives non-JavaScript visitors honest context", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    const sitemap = readFileSync("public/sitemap.xml", "utf8");
    expect(robots).toContain(`Sitemap: ${canonical}sitemap.xml`);
    expect(sitemap.match(/<loc>/g)).toHaveLength(1);
    expect(sitemap).toContain(`<loc>${canonical}</loc>`);
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]+?)\s*<\/script>/)![1]);
    expect(schema).toMatchObject({ "@type": "WebSite", url: canonical, inLanguage: "ar" });
    expect(html).toContain("<noscript>");
    expect(html).not.toMatch(/11,775|١١٬٧٧٥|١٬١٣١|١ نوفمبر/);
  });
});
