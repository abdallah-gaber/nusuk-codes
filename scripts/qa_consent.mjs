/* global window, document, localStorage, DOMException */
// Optional browser regression runner; no project dependency or production deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, pathToFileURL } from 'node:url';
import { log } from 'node:console';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const build = path.resolve(process.env.CONSENT_QA_BUILD || '/tmp/nusuk-consent-qa-build');
const output = path.resolve(process.env.CONSENT_QA_OUTPUT || 'docs/qa/consent');
const origin = 'https://nusuk.abdallahgaber.dev';
const key = 'nusuk:analytics-consent:v1';
const tagId = process.env.CONSENT_QA_ID || 'G-CONSENTQA'; // Test-only, Google traffic is blocked.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { kind: 'Real Chrome UI; privately intercepted local production artifact; Google script blocked', checks: [], viewports: [] };
await fs.mkdir(output, { recursive: true });
async function context(blockLocal = false, blockSession = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  ctx.setDefaultTimeout(8000);
  await ctx.route(origin + '/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const relative = pathname === '/' ? '/index.html' : /^\/(ar|en|id|ur)\/?$/.test(pathname)
      ? pathname.replace(/\/$/, '') + '/index.html' : pathname;
    const file = path.resolve(build, '.' + relative);
    if (!file.startsWith(build + path.sep)) return route.abort();
    try {
      const ext = path.extname(file);
      await route.fulfill({ status: 200, body: await fs.readFile(file), contentType:
        ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' })[ext] || 'application/octet-stream' });
    } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await ctx.route(/https:\/\/[^/]*(googletagmanager|google-analytics)\.com\//, route => route.abort());
  if (blockLocal || blockSession) await ctx.addInitScript(({ blockLocal, blockSession }) => {
    for (const name of [blockLocal && 'localStorage', blockSession && 'sessionStorage'].filter(Boolean))
      Object.defineProperty(window, name, { get() { throw new DOMException('Blocked for QA', 'SecurityError'); } });
  }, { blockLocal, blockSession });
  return ctx;
}
async function open(ctx, locale = 'en') {
  const page = await ctx.newPage();
  await page.goto(origin + '/' + locale + '/');
  await page.locator('.code').waitFor();
  return page;
}
async function banner(page, visible) {
  await page.locator('.consent-banner').waitFor({ state: visible ? 'visible' : 'detached' });
}
async function withdraw(page) {
  await page.locator('.privacy-link').click();
  await page.locator('#analytics-preferences .preference-actions button').last().click();
}
try {
  const matrix = await context();
  const page = await open(matrix);
  for (const locale of ['en', 'ar', 'id', 'ur']) {
    await page.getByRole('combobox').selectOption(locale);
    for (const theme of ['light', 'dark']) {
      for (let i = 0; i < 3 && await page.locator('html').getAttribute('data-theme') !== theme; i++) await page.locator('.icon-button').click();
      for (const width of [320, 360, 390, 412, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--consent-banner-space')) >= document.querySelector('.consent-banner').getBoundingClientRect().height);
        const data = await page.evaluate(() => {
          const actions = [...document.querySelectorAll('.consent-banner-actions button')].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
          return { locale: document.documentElement.lang, theme: document.documentElement.dataset.theme, width: window.innerWidth,
            overflow: document.documentElement.scrollWidth > window.innerWidth, dir: document.documentElement.dir, actions };
        });
        assert.equal(data.overflow, false);assert.equal(data.actions[0].width, data.actions[1].width);
        assert.ok(data.actions.every(e => e.height >= 44));
        // Native keyboard focus scrolling must keep every core action above the banner.
        for (const selector of ['.copy-code', '.next-code', '.local-actions button', '.official-action > a']) {
          const controls = page.locator(selector);
          assert.ok(await controls.count() > 0, "Missing QA target: " + selector);
          for (let i = 0; i < await controls.count(); i++) {
            await controls.nth(i).focus();
            const safe = await controls.nth(i).evaluate(e => e.getBoundingClientRect().top >= 0 && e.getBoundingClientRect().bottom <= document.querySelector('.consent-banner').getBoundingClientRect().top);
            assert.ok(safe, locale + ' ' + width + ': obscured focused action ' + selector);
          }
        }
        report.viewports.push(data);
        if (width === 390 && theme === 'light') {
          await page.locator('.copy-code').focus();
          await page.screenshot({ path: path.join(output, locale + '-mobile.jpg'), type: 'jpeg', quality: 85 });
        }
      }
    }
  }
  await page.locator('.consent-banner-actions button').first().focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.consent-banner-actions button').last().evaluate(e => e === document.activeElement), true);
  assert.notEqual(await page.locator('.consent-banner-actions button').last().evaluate(e => window.getComputedStyle(e).outlineStyle), 'none');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('.consent-banner-actions button').first().evaluate(e => e === document.activeElement), true);
  await matrix.close();report.checks.push('40 locale/theme/viewport layouts, equal 44px choices, keyboard/focus visibility and unobscured focused core controls');
  const normal = await context();const a = await open(normal), b = await open(normal);
  await banner(a, true);await banner(b, true);
  const current = await a.locator('.code').innerText();
  await a.locator('.consent-banner-actions button').first().click();
  await banner(a, false);await banner(b, false);
  await b.evaluate(k => localStorage.removeItem(k), key);
  await b.reload();await b.locator('.code').waitFor();await banner(b, true);await banner(a, true);
  await b.locator('.consent-banner-actions button').first().click();await banner(a, false);await banner(b, false);
  assert.equal(await a.locator('.code').innerText(), current);
  await a.locator('.next-code').click();
  assert.notEqual(await a.locator('.code').innerText(), current);
  assert.equal(await a.evaluate(k => localStorage.getItem(k), key), 'granted');
  await a.reload();await a.locator('.code').waitFor();await banner(a, false);
  assert.equal(await a.locator('#nusuk-google-tag').count(), 1);
  assert.equal(await a.evaluate(() => (window.dataLayer || []).filter(m => m?.[0] === 'config').length), 1);
  await withdraw(b);
  await a.waitForFunction(id => window['ga-disable-' + id] === true, tagId);
  await banner(a, false);await banner(b, false);
  await a.reload();await a.locator('.code').waitFor();await banner(a, false);assert.equal(await a.locator('#nusuk-google-tag').count(), 0);
  await b.evaluate(k => localStorage.removeItem(k), key);await banner(a, true);
  await a.locator('.consent-banner-actions button').last().click();await banner(a, false);
  assert.equal(await a.locator('#nusuk-google-tag').count(), 0);
  await normal.close();report.checks.push('Accept/decline, saved-choice reload, single initialization, cross-tab withdrawal and explicit reset');
  const session = await context(true);const s = await open(session), t = await open(session);
  await s.locator('.consent-banner-actions button').first().click();await banner(t, false);
  await s.reload();await s.locator('.code').waitFor();await banner(s, false);
  await withdraw(t);await s.waitForFunction(id => window['ga-disable-' + id] === true, tagId);
  await s.reload();await s.locator('.code').waitFor();await banner(s, false);
  assert.equal(await s.locator('#nusuk-google-tag').count(), 0);
  await session.close();report.checks.push('Blocked localStorage: session reload persistence and native BroadcastChannel cross-tab withdrawal');
  const memory = await context(true, true);const m = await open(memory);
  await m.locator('.consent-banner-actions button').last().click();await banner(m, false);
  await m.getByRole('combobox').selectOption('ar');await banner(m, false);
  await m.reload();await m.locator('.code').waitFor();await banner(m, true);
  await memory.close();report.checks.push('Both stores blocked: non-forcing memory choice; prompt returns on reload only');
  log(JSON.stringify({ checks: report.checks, viewports: report.viewports.length }));
} finally {
  await fs.writeFile(path.join(output, 'browser-ui-qa.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
