/* global document, innerHeight, innerWidth, getComputedStyle */
// Build first, then run: node --test src/winners/qa.mjs
// Install Playwright separately or point PLAYWRIGHT_MODULE to an existing Playwright ESM entry.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { URL, pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : "playwright");
const dist = path.resolve(process.env.WINNERS_QA_BUILD || "dist");
const origin = "https://winners.test";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const { records } = JSON.parse(await readFile(new URL("./data.json", import.meta.url), "utf8"));
const expected = records.toSorted((a, b) =>
  (b.announcedOn ?? "").localeCompare(a.announcedOn ?? "") ||
  (b.winnerOrdinal ?? 0) - (a.winnerOrdinal ?? 0) || a.id.localeCompare(b.id));
let browser;

before(async () => { browser = await chromium.launch({ channel: "chrome" }); });
after(async () => { await browser?.close(); });

async function open(t, { locale = "en", width = 320, theme = "light", motion = "no-preference", holdBanner = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 568 : 720 }, colorScheme: theme, reducedMotion: motion });
  t.after(() => context.close());
  context.setDefaultTimeout(5000);
  let release;
  const barrier = holdBanner ? new Promise(resolve => { release = resolve; }) : null;
  if (release) t.after(release);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const pathname = /^\/(ar|en|id|ur)\/$/.test(url.pathname) ? url.pathname + "index.html" : url.pathname;
    const file = path.resolve(dist, "." + pathname);
    if (!file.startsWith(dist + path.sep)) return route.abort();
    if (barrier && pathname.startsWith("/assets/Winners-")) await barrier;
    try {
      await route.fulfill({ body: await readFile(file), contentType: types[path.extname(file)] || "application/octet-stream" });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(origin + "/" + locale + "/", { waitUntil: "domcontentloaded" });
  await page.locator(".code").waitFor();
  return { page, release };
}

async function expectWinner(page, index) {
  const name = expected[index].displayName;
  const active = page.locator('.winners-slide[aria-hidden="false"] bdi');
  await active.filter({ hasText: name }).waitFor();
  assert.equal(await active.textContent(), name);
}

function older(page) { return page.getByRole("button", { name: "Show older winner" }); }
function rotationButton(page) { return page.locator(".winners-pause"); }

test("Resume restarts the eight-second timer while the pointer stays over the banner", async (t) => {
  const { page } = await open(t);
  await expectWinner(page, 0);
  await older(page).click();
  await expectWinner(page, 1);
  const toggle = rotationButton(page);
  await toggle.click();
  // Clear focus without moving the mouse. Hover alone used to block the timer.
  await page.locator(".copy-code").focus();
  assert(await page.locator(".winners-banner").evaluate(element => element.matches(":hover")));
  await page.clock.runFor(7600);
  await expectWinner(page, 1);
  await page.clock.runFor(800);
  await expectWinner(page, 2);
});

test("Resume restarts rotation with focus retained on the button, while moving focus pauses it", async (t) => {
  const { page } = await open(t);
  await expectWinner(page, 0);
  await older(page).press("Enter");
  await expectWinner(page, 1);
  const toggle = rotationButton(page);
  await toggle.press("Enter");
  assert(await toggle.evaluate(element => element === document.activeElement));
  assert(!(await page.locator(".winners-banner").evaluate(element => element.matches(":hover"))));
  await page.clock.runFor(8400);
  await expectWinner(page, 2);
  assert(await toggle.evaluate(element => element === document.activeElement));
  await page.keyboard.press("Tab");
  assert(await page.getByRole("button", { name: "Show newer winner" }).evaluate(element => element === document.activeElement));
  await page.clock.runFor(16000);
  await expectWinner(page, 2);
});

test("Explicit Pause cancels rotation, and the archive keeps it suspended until focus exits", async (t) => {
  const { page } = await open(t, { width: 1280, theme: "dark" });
  await expectWinner(page, 0);
  await page.clock.runFor(6000);
  await rotationButton(page).press("Enter");
  await page.locator(".copy-code").focus();
  await page.clock.runFor(17000);
  await expectWinner(page, 0);
  await rotationButton(page).press("Enter");
  const opener = page.getByRole("button", { name: "All winners" });
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Previous winners" });
  await dialog.waitFor();
  assert.equal(await dialog.locator("li").count(), expected.length);
  await page.clock.runFor(17000);
  await expectWinner(page, 0);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(await opener.evaluate(element => element === document.activeElement));
  await page.clock.runFor(8500);
  await expectWinner(page, 0);
  await page.locator(".copy-code").focus();
  await page.clock.runFor(8400);
  await expectWinner(page, 1);
});

test("Automatic confetti restarts across wraparound and each effect removes its decoration", async (t) => {
  const { page } = await open(t);
  await expectWinner(page, 0);
  const confetti = page.locator(".winners-confetti");
  assert.equal(await confetti.evaluate(element => getComputedStyle(element).animationDuration), "3.4s");
  await confetti.waitFor({ state: "detached" });
  const sparkle = page.locator(".winners-manual-sparkle");
  await page.getByRole("button", { name: "Show newer winner" }).press("Enter");
  await expectWinner(page, expected.length - 1);
  assert.equal(await confetti.count(), 0);
  assert.equal(await sparkle.evaluate(element => getComputedStyle(element).animationDuration), "0.96s");
  await sparkle.waitFor({ state: "detached" });
  await rotationButton(page).press("Enter");
  await page.clock.runFor(8400);
  await expectWinner(page, 0);
  assert.equal(await confetti.evaluate(element => getComputedStyle(element).animationDuration), "2.1s");
  await confetti.evaluate(element => { element.dataset.previousBurst = "true"; });
  await page.clock.runFor(8100);
  await expectWinner(page, 1);
  assert.equal(await confetti.getAttribute("data-previous-burst"), null);
  assert.equal(await confetti.evaluate(element => getComputedStyle(element).animationDuration), "2.1s");
  await confetti.waitFor({ state: "detached" });
  assert.equal(await page.locator(".winners-banner [aria-live=polite] bdi").textContent(), expected.at(-1).displayName);
});

test("Reduced motion prevents celebrations and automatic advance", async (t) => {
  const { page } = await open(t, { motion: "reduce" });
  await expectWinner(page, 0);
  await page.clock.runFor(18000);
  await expectWinner(page, 0);
  await older(page).press("Enter");
  await expectWinner(page, 1);
  assert.equal(await page.locator(".winners-confetti, .winners-manual-sparkle, .winners-pause").count(), 0);
  assert.equal(await page.locator('.winners-slide[aria-hidden="false"]').evaluate(element => getComputedStyle(element).animationName), "none");
});

for (const locale of ["ar", "en", "id", "ur"]) {
  for (const [width, theme] of [[320, "light"], [1280, "dark"]]) {
    test(`${locale} ${width}px preserves the banner slot and Copy/Next`, async (t) => {
      const { page, release } = await open(t, { locale, width, theme, holdBanner: true });
      const codeCard = page.locator(".code-card");
      const initialTop = (await codeCard.boundingBox()).y;
      release();
      await expectWinner(page, 0);
      const bounds = await page.locator(".winners-banner").boundingBox();
      assert.equal((await codeCard.boundingBox()).y, initialTop);
      if (width === 320) assert.equal(bounds.height, 140);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const selector of [".copy-code", ".next-code"]) {
        assert(await page.locator(selector).evaluate(button => {
          const { x, y, width, height, bottom } = button.getBoundingClientRect();
          return bottom <= innerHeight && button.contains(document.elementFromPoint(x + width / 2, y + height / 2));
        }));
      }
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "ar" || locale === "ur" ? "rtl" : "ltr");
    });
  }
}
