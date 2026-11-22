/* global window, document, localStorage, DOMException, navigator, requestAnimationFrame */
// Optional browser regression runner; no project dependency or production deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL, pathToFileURL } from 'node:url';
import { log } from 'node:console';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const build = path.resolve(process.env.CONSENT_QA_BUILD || '/tmp/nusuk-consent-qa-build');
const output = path.resolve(process.env.CONSENT_QA_OUTPUT || '/tmp/nusuk-consent-qa-output');
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
  await ctx.route(url => url.origin !== origin, route => route.abort());
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
        await page.evaluate(() => window.scrollTo(0, 0));
        const data = await page.evaluate(() => {
          const actions = [...document.querySelectorAll('.consent-banner-actions button')].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
          return { locale: document.documentElement.lang, theme: document.documentElement.dataset.theme, width: window.innerWidth,
            overflow: document.documentElement.scrollWidth > window.innerWidth, dir: document.documentElement.dir, actions,
            primaryVisible: ['.code', '.copy-code', '.next-code'].every(selector => {
              const control = document.querySelector(selector).getBoundingClientRect();
              return control.top >= 0 && control.bottom <= window.innerHeight;
            }),
            bannerFollowsBrowser: document.querySelector('.consent-banner').getBoundingClientRect().top >=
              document.querySelector('#browser').getBoundingClientRect().bottom };
        });
        assert.equal(data.overflow, false);assert.ok(Math.abs(data.actions[0].width - data.actions[1].width) < 1);
        assert.ok(data.primaryVisible && data.bannerFollowsBrowser, JSON.stringify(data));
        assert.ok(data.actions.every(e => e.height >= 44));
        // Native keyboard focus scrolling must keep every core action above the banner.
        for (const selector of ['.copy-code', '.next-code', '.local-actions button:not(:disabled)', '.official-action']) {
          const controls = page.locator(selector);
          assert.ok(await controls.count() > 0, "Missing QA target: " + selector);
          for (let i = 0; i < await controls.count(); i++) {
            await controls.nth(i).focus();
            const safe = await controls.nth(i).evaluate(e => {
              const { left, top, width, height, bottom } = e.getBoundingClientRect();
              return top >= 0 && bottom <= window.innerHeight &&
                e.contains(document.elementFromPoint(left + width / 2, top + height / 2));
            });
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
  await matrix.close();report.checks.push('40 locale/theme/viewport layouts, first-viewport primary controls, inline consent, equal 44px choices and unobscured focus');
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
  const accessibility = await context();
  const axe = process.env.AXE_QA_MODULE;
  for (const locale of ['en', 'ar', 'id', 'ur']) {
    const page = await open(accessibility, locale);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const largeText = await page.evaluate(() => {
      const find = selector => document.querySelector(selector).getBoundingClientRect();
      const buttons = ['.copy-code', '.next-code'].map(find);
      return { overflow: document.documentElement.scrollWidth > window.innerWidth,
        firstViewport: buttons.every(rect => rect.top >= 0 && rect.bottom <= window.innerHeight),
        consentBelowBrowser: find('.consent-banner').top >= find('#browser').bottom };
    });
    assert.ok(!largeText.overflow && largeText.firstViewport && largeText.consentBelowBrowser,
      locale + ' at 200% text: ' + JSON.stringify(largeText));
    const decisions = page.locator('.consent-banner-actions button');
    await decisions.first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await decisions.last().evaluate(e => e === document.activeElement), true);
    if (axe) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addStyleTag({ content: 'html { font-size: 100% }' });
      await page.addScriptTag({ path: axe });
      await page.evaluate(() => {
        document.querySelectorAll('.progress-card, .code-list, #how, #analytics-preferences')
          .forEach(panel => { panel.open = true; });
      });
      await page.locator('#code-search').waitFor();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        const violations = await page.evaluate(async () => (await window.axe.run()).violations
          .map(({ id, nodes }) => ({ id, targets: nodes.flatMap(node => node.target) })));
        assert.deepEqual(violations, [], locale + ' ' + theme + ' axe violations');
      }
    }
    await page.close();
  }
  await accessibility.close();
  report.checks.push('All four locales at 320 × 568 and 200% text: no horizontal scrolling, first-viewport primary actions and reachable consent');
  if (axe) report.checks.push('Zero axe violations in each locale, light and dark');

  const flow = await context();
  const f = await open(flow, 'en');
  const codeBefore = await f.locator('.code').innerText();
  const hasFocus = locator => locator.evaluate(e => e === document.activeElement);
  const events = () => f.evaluate(() => (window.dataLayer || [])
    .filter(command => command[0] === 'event').map(command => [command[1], command[2]]));
  const eventCount = async name => (await events()).filter(([event]) => event === name).length;
  await f.keyboard.press('Tab');
  assert.ok(await hasFocus(f.locator('.skip-link')));
  await f.keyboard.press('Enter');
  assert.ok(await hasFocus(f.locator('#browser')));
  await f.keyboard.press('Tab');
  assert.ok(await hasFocus(f.locator('.copy-code')));
  await f.keyboard.press('Tab');
  assert.ok(await hasFocus(f.locator('.next-code')));
  await f.locator('.privacy-link').click();
  assert.ok(await hasFocus(f.locator('#analytics-preferences summary')));
  await f.locator('#analytics-preferences .preference-actions button').first().click();
  assert.equal(await eventCount('code_browser_view'), 0);
  await f.evaluate(() => window.scrollTo(0, 0));
  await f.waitForFunction(() => (window.dataLayer || []).some(c => c[1] === 'code_browser_view'));
  await f.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.qaClipboard = text; }
    } });
  });
  await f.locator('.copy-code').click();
  assert.equal(await f.evaluate(() => window.qaClipboard), codeBefore);
  assert.equal(await eventCount('copy_code'), 1);
  const official = new URL(await f.locator('.official-action').getAttribute('href'));
  assert.equal(official.origin, 'https://services.nusuk.sa');
  assert.equal(official.searchParams.get('id'), codeBefore);
  await f.locator('.next-code').click();
  const nextCode = await f.locator('.code').innerText();
  assert.notEqual(nextCode, codeBefore);
  await f.reload();
  await f.locator('.code').waitFor();
  assert.equal(await f.locator('.code').innerText(), nextCode);
  const layout = f.locator('.local-actions button');
  await layout.first().click();
  assert.notEqual(await f.locator('.code').innerText(), nextCode);
  await layout.nth(2).click();
  assert.equal(await f.locator('.code').innerText(), nextCode);
  await layout.nth(1).click();
  assert.notEqual(await f.locator('.code').innerText(), nextCode);
  const history = f.locator('.progress-card');
  await history.locator('summary').click();
  const [download] = await Promise.all([f.waitForEvent('download'), history.getByRole('button', { name: /export/i }).click()]);
  const exported = await fs.readFile(await download.path());
  const data = JSON.parse(exported);
  assert.ok(data.skipped.includes(nextCode));
  assert.ok(!data.tried.includes(nextCode));
  await history.getByRole('button', { name: 'Clear history', exact: true }).click();
  assert.ok(await f.locator('dialog').isVisible());
  assert.ok(await hasFocus(f.getByRole('button', { name: 'Cancel', exact: true })));
  await f.keyboard.press('Escape');
  assert.ok(!(await f.locator('dialog').isVisible()));
  await history.getByRole('button', { name: 'Clear history', exact: true }).click();
  await f.getByRole('button', { name: 'Yes, clear history', exact: true }).click();
  const chooser = f.waitForEvent('filechooser');
  await history.getByRole('button', { name: /import/i }).click();
  await (await chooser).setFiles({ name: 'qa-history.json', mimeType: 'application/json', buffer: exported });
  await f.waitForFunction(() => (window.dataLayer || []).some(c => c[1] === 'history_import'));
  const search = f.locator('.code-list');
  await search.locator('summary').click();
  await search.getByRole('searchbox').fill(codeBefore);
  assert.equal(await search.locator('.code-results li').count(), 1);
  await search.getByRole('searchbox').fill('QA-private-search');
  await f.locator('#how summary').click();
  await f.waitForFunction(() => (window.dataLayer || []).some(c => c[1] === 'secondary_feature_open' && c[2].feature === 'help'));
  assert.deepEqual((await events()).filter(([name]) => name === 'secondary_feature_open').map(([, params]) => params.feature),
    ['progress', 'search', 'help']);
  for (const name of ['mark_tried', 'undo_tried', 'skip_code', 'history_export', 'history_import']) assert.equal(await eventCount(name), 1, name);

  const share = f.locator('.share-actions button');
  await f.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => new Promise(resolve => { window.qaShare = resolve; }) });
  });
  await share.click();
  assert.equal(await eventCount('share_website'), 0);
  await f.evaluate(() => window.qaShare());
  assert.equal(await eventCount('share_website'), 1);
  await f.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  });
  await share.click();
  assert.equal(await eventCount('share_website'), 1);
  await f.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: async () => { throw new Error('Unavailable'); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.qaClipboard = text; }
    } });
  });
  await share.click();
  assert.equal(await f.evaluate(() => window.qaClipboard), origin + '/en/');
  assert.deepEqual((await events()).filter(([name]) => name === 'share_website').map(([, params]) => params.share_method), ['native', 'clipboard']);
  await f.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
    document.execCommand = () => false;
  });
  await share.click();
  await f.locator('.toast').filter({ hasText: 'Sharing failed' }).waitFor();
  const [whatsapp] = await Promise.all([f.waitForEvent('popup'), f.locator('.share-actions a').click()]);
  await whatsapp.close();
  assert.equal(await eventCount('share_website'), 2);
  await f.evaluate(() => window.scrollTo(0, 0));
  await f.getByRole('combobox').selectOption('ar');
  await f.waitForFunction(() => (window.dataLayer || []).some(c => c[1] === 'code_browser_view' && c[2].locale === 'ar'));
  await f.getByRole('combobox').selectOption('en');
  await f.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  assert.equal(await eventCount('code_browser_view'), 2);
  const payloads = JSON.stringify(await events());
  for (const secret of [codeBefore, nextCode, 'QA-private-search', 'qa-history.json']) assert.ok(!payloads.includes(secret));
  await flow.close();
  report.checks.push('Keyboard entry, clipboard, exact official link, Next persistence, Tried/Skip/Undo, history export/import/reset and search');
  report.checks.push('Consent-gated viewport impression and locale deduplication, three discovery events, successful share only and payload privacy');

  log(JSON.stringify({ checks: report.checks, viewports: report.viewports.length }));
} finally {
  await fs.writeFile(path.join(output, 'browser-ui-qa.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
