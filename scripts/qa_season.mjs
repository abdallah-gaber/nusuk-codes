/* global document, localStorage, innerWidth */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { URL, pathToFileURL } from "node:url";
import { fixtureArchive } from "./fixtures/season-winners.mjs";

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
  en: ["en", "ltr", "The 2026 Nusuk Challenge season has ended", "View all winners", "Show fewer winners"],
  ar: ["ar-EG", "rtl", "اختُتم موسم تحدي نسك لعام ٢٠٢٦", "عرض جميع الفائزين", "عرض عدد أقل من الفائزين"],
  id: ["id-ID", "ltr", "Musim Tantangan Nusuk 2026 telah berakhir", "Lihat semua pemenang", "Tampilkan lebih sedikit pemenang"],
  ur: ["ur-PK", "rtl", "نسک چیلنج 2026 کا سیزن ختم ہو گیا ہے", "تمام فاتحین دیکھیں", "کم فاتحین دکھائیں"],
};
const screenshotDir = process.env.SEASON_QA_SCREENSHOTS && path.resolve(process.env.SEASON_QA_SCREENSHOTS);

let output, browser;
const builds = {};

before(async () => {
  output = await mkdtemp(path.join(tmpdir(), "nusuk-season-"));
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  for (const mode of ["active", "archived", "fixture"]) {
    const dir = path.join(output, mode);
    const args = ["node_modules/vite/bin/vite.js", "build", "--outDir", dir];
    if (mode === "fixture") args.push("--config", "scripts/fixtures/season-winners.vite.mjs");
    execFileSync(process.execPath, args, {
      cwd: root,
      env: {
        ...process.env, NUSUK_SEASON_STATUS: mode === "active" ? "active" : "archived", VERCEL_ENV: "production",
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

async function openPage(t, dir, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 720 },
    reducedMotion: "reduce",
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: consentKey, value: "denied" }] }] },
    ...options,
  });
  t.after(() => context.close());
  context.setDefaultTimeout(8000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const pathname = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
    const root = builds[dir()];
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      await route.fulfill({ body: await readFile(file), contentType: types[path.extname(file)] || "application/octet-stream" });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
  return context.newPage();
}

async function assertWinnerRows(winners, expected, locale) {
  const rows = await winners.locator("li:visible").evaluateAll((items) => items.map(item => ({
    name: item.querySelector("bdi")?.textContent,
    date: item.querySelector("time")?.dateTime,
    flag: item.querySelector(".winner-meta [aria-hidden]")?.textContent.trim(),
    numberLabel: item.querySelector(".winner-number")?.textContent,
    source: item.querySelector("a")?.href,
  })));
  assert.equal(rows.length, expected.length);
  for (const [index, row] of rows.entries()) {
    const record = expected[index];
    assert.equal(row.name, record.displayName);
    assert.equal(row.source, record.announcementUrl);
    assert.equal(row.date, record.announcedOn || undefined);
    assert.equal(row.flag, record.country && String.fromCodePoint(...[...record.country].map(letter => letter.charCodeAt(0) + 127397)));
    assert.equal(Boolean(row.numberLabel), record.winnerOrdinal !== undefined);
    if (record.winnerOrdinal !== undefined) assert(row.numberLabel.includes(record.winnerOrdinal.toLocaleString(locale)));
  }
}

function ordered(records) {
  return records.toSorted((a, b) =>
    (b.announcedOn ?? "").localeCompare(a.announcedOn ?? "") ||
    (b.winnerOrdinal ?? 0) - (a.winnerOrdinal ?? 0) ||
    a.id.localeCompare(b.id));
}

for (const [language, [locale, dir, title, viewAll, showFewer]] of Object.entries(localeMatrix)) {
  test(`${language}: Active → Archived → Active preserves the route, privacy choice and history`, async (t) => {
    let mode = "active";
    const page = await openPage(t, () => mode);
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
    const footerReference = page.locator(".closing a.season-official-reference");
    assert.equal(await footerReference.getAttribute("href"), "https://www.nusuk.sa/");
    assert.equal(await page.locator(".closing .primary, a[href='https://services.nusuk.sa/app']").count(), 0);
    assert((await page.locator(".season-farewell").textContent()).length > 10);
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
    const expected = ordered(records);
    await assertWinnerRows(winners, expected.slice(0, 5), locale);
    if (expected.length > 5) {
      const action = winners.locator("summary");
      assert.equal(await action.innerText(), viewAll);
      await action.press("Enter");
      await assertWinnerRows(winners, expected, locale);
      assert.equal(await action.innerText(), showFewer);
      assert.equal(await action.evaluate(element => element === document.activeElement), true);
      await action.press("Space");
      await assertWinnerRows(winners, expected.slice(0, 5), locale);
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

  test(`${language}: 55-winner archive stays compact and expands without horizontal overflow`, async (t) => {
    const page = await openPage(t, () => "fixture", { colorScheme: "dark" });
    await page.goto(`${origin}/${language}/`);
    const winners = page.locator(".season-winners");
    const action = winners.locator("summary");
    await action.waitFor();
    assert.equal(await action.innerText(), viewAll);
    const expected = ordered(fixtureArchive.records);
    assert.equal(await winners.locator("h2 span").textContent(), expected.length.toLocaleString(locale));
    await assertWinnerRows(winners, expected.slice(0, 5), locale);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert(await action.evaluate(element => element.getBoundingClientRect().height >= 44));
    await action.press("Enter");
    await assertWinnerRows(winners, expected, locale);
    const lastAnnouncement = winners.locator("li").last().getByRole("link");
    await lastAnnouncement.focus();
    assert(await lastAnnouncement.evaluate(element => element === document.activeElement));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await action.innerText(), showFewer);
    await action.press("Space");
    await assertWinnerRows(winners, expected.slice(0, 5), locale);
  });
}

if (screenshotDir) {
  for (const shot of [
    { language: "ar", colorScheme: "dark", viewport: { width: 390, height: 844 }, name: "archived-arabic-mobile-dark" },
    { language: "en", colorScheme: "light", viewport: { width: 1200, height: 900 }, name: "archived-english-desktop-expanded" },
  ]) {
    test(`capture ${shot.name}`, async (t) => {
      const { language, name, colorScheme, viewport } = shot;
      const page = await openPage(t, () => "archived", { colorScheme, viewport });
      await page.goto(`${origin}/${language}/`);
      const archive = page.locator(".season-winners");
      await archive.locator("h2 span").waitFor();
      if (language === "en" && records.length > 5) await archive.locator("summary").click();
      await page.evaluate(async () => {
        await document.fonts.ready;
        document.activeElement?.blur();
        document.documentElement.scrollTop = 0;
      });
      const { x, y, width, height } = await archive.boundingBox();
      const left = Math.max(0, Math.floor(x - 24));
      await page.screenshot({
        path: path.join(screenshotDir, name + ".png"),
        animations: "disabled",
        fullPage: true,
        clip: { x: left, y: 0, width: Math.min(viewport.width - left, Math.ceil(width + 48)), height: Math.ceil(y + height + 12) },
      });
    });
  }
}
