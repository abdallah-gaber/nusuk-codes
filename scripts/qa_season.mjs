/* global document, localStorage, innerWidth */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { URL, pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : "playwright");
const origin = "https://nusuk.abdallahgaber.dev";
const root = new URL("../", import.meta.url);
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), "utf8"));
const { records } = await readJson("src/winners/data.json");
const manifest = await readJson("public/data/manifest.json");
const { codes } = await readJson("public" + manifest.snapshotUrl);
const historyKey = `nusuk:history:${manifest.season}:v1`;
const consentKey = "nusuk:analytics-consent:v1";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const localeMatrix = {
  en: ["en", "ltr", "The Nusuk Challenge season has ended"],
  ar: ["ar-EG", "rtl", "اختُتم موسم تحدي نسك"],
  id: ["id-ID", "ltr", "Musim Tantangan Nusuk telah berakhir"],
  ur: ["ur-PK", "rtl", "نسک چیلنج کا سیزن ختم ہو گیا ہے"],
};

let output, browser;
const builds = {};

before(async () => {
  output = await mkdtemp(path.join(tmpdir(), "nusuk-season-"));
  for (const mode of ["active", "archived"]) {
    const dir = path.join(output, mode);
    execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", dir], {
      cwd: root,
      env: {
        ...process.env, NUSUK_SEASON_STATUS: mode, VERCEL_ENV: "production",
        VITE_GA_MEASUREMENT_ID: "G-SEASONTEST", VITE_GA_MANUAL_EVENTS_ONLY: "true",
      },
      stdio: "pipe",
    });
    builds[mode] = dir;
  }
  browser = await chromium.launch({ channel: "chrome" });
});

after(async () => {
  await browser?.close();
  if (output) await rm(output, { recursive: true, force: true });
});

for (const [language, [locale, dir, title]] of Object.entries(localeMatrix)) {
  test(`${language}: Active → Archived → Active preserves the route, privacy choice and history`, async (t) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 720 },
      reducedMotion: "reduce",
      storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: consentKey, value: "denied" }] }] },
    });
    t.after(() => context.close());
    context.setDefaultTimeout(8000);

    let mode = "active";
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      const pathname = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
      const file = path.resolve(builds[mode], "." + pathname);
      if (!file.startsWith(builds[mode] + path.sep)) return route.abort();
      try {
        await route.fulfill({ body: await readFile(file), contentType: types[path.extname(file)] || "application/octet-stream" });
      } catch {
        await route.fulfill({ status: 404, body: "" });
      }
    });
    const page = await context.newPage();
    const url = `${origin}/${language}/?season=archived#browser`;
    const activeResponse = await page.goto(url);
    assert.equal(activeResponse.status(), 200);
    const activeHtml = await activeResponse.text();
    assert(!activeHtml.includes(title));
    await page.locator(".copy-code").waitFor();
    await page.locator(".winners-banner").waitFor();
    assert.equal(await page.locator(".season-hero").count(), 0);
    const initial = await page.locator("#browser .code").textContent();
    await page.locator(".next-code").click();
    const current = await page.locator("#browser .code").textContent();
    assert.notEqual(current, initial);
    const readProgress = () => page.evaluate((key) => localStorage.getItem(key), historyKey);
    const progress = await readProgress();
    assert.equal(JSON.parse(progress).current, current);

    mode = "archived";
    const response = await page.reload();
    assert.equal(response.status(), 200);
    const html = await response.text();
    assert(html.includes(title));
    assert(html.includes(`rel="canonical" href="${origin}/${language}/"`));
    assert.equal((html.match(/hreflang=/g) || []).length, 5);
    assert.equal(await page.locator("html").getAttribute("lang"), language);
    assert.equal(await page.locator("html").getAttribute("dir"), dir);
    assert.equal(await page.locator(".season-hero h2").textContent(), title);
    assert.equal(await page.locator("dialog[open], .winners-banner, .next-code, a[href*='?p=27']").count(), 0);
    assert.equal(await page.locator(".consent-banner").count(), 0);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), consentKey), "denied");
    await page.locator(".privacy-link").click();
    assert.equal(await page.locator("#analytics-preferences").getAttribute("open"), "");
    assert.equal(await page.locator(".preference-actions button").count(), 2);
    await page.locator(".season-hero a[href='#winners-history']").press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "winners-history");
    const winners = page.locator(".season-winners");
    await winners.locator("h2 span").waitFor();
    assert.equal(await winners.locator("h2 span").textContent(), records.length.toLocaleString(locale));
    const rows = await winners.locator("li").evaluateAll((items) => items.map(item => ({
      name: item.querySelector("bdi")?.textContent,
      date: item.querySelector("time")?.dateTime,
      flag: item.querySelector(".winner-meta [aria-hidden]")?.textContent.trim(),
      numberLabel: item.querySelector(".winner-number")?.textContent,
      source: item.querySelector("a")?.href,
    })));
    assert.equal(rows.length, records.length);
    for (const row of rows) {
      const record = records.find(item => item.announcementUrl === row.source && item.displayName === row.name);
      assert(record, "Winner links to the original announcement with its published name");
      assert.equal(row.date, record.announcedOn || undefined);
      assert.equal(row.flag, record.country && String.fromCodePoint(...[...record.country].map(letter => letter.charCodeAt(0) + 127397)));
      assert.equal(Boolean(row.numberLabel), record.winnerOrdinal !== undefined);
      if (record.winnerOrdinal !== undefined) assert(row.numberLabel.includes(record.winnerOrdinal.toLocaleString(locale)));
    }

    await page.locator(".season-hero a[href='#browser']").click();
    await page.locator("#browser summary").click();
    await page.locator("#code-search").fill(codes[0].code);
    const result = page.locator("#code-results li");
    await result.waitFor();
    assert.equal(await result.textContent(), codes[0].code);
    assert.equal(await result.locator("button, a").count(), 0);
    assert.equal(await readProgress(), progress);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    mode = "active";
    await page.reload();
    await page.locator(".copy-code").waitFor();
    assert.equal(await page.locator("#browser .code").textContent(), current);
    assert.equal(await readProgress(), progress);
  });
}
