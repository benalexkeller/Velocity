// Phase detail under the weekly-hours chart: replaces "Your plan explained".
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const body = await p.textContent('main');
  ok('old "Your plan explained" section gone', !/Your plan explained/.test(body));
  const head = await p.textContent('.phd-head');
  const sel = await p.textContent('.phd-tabs button.on');
  ok('defaults to the current phase', /week \d+ of \d+/.test(head) && head.startsWith(sel.trim()), `${sel} | ${head}`);
  const rows = await p.$$eval('.phw', (els) => els.length);
  const weeks = (await p.textContent('.phd-head')).match(/Weeks (\d+)–(\d+)/);
  ok('one row per week of the phase', weeks && rows === +weeks[2] - +weeks[1] + 1, `${rows} rows · ${weeks && weeks[0]}`);
  const nowRow = await p.$eval('.phw.now', (e) => ({ open: e.classList.contains('open'), txt: e.textContent, days: e.querySelectorAll('.phw-days li').length })).catch(() => null);
  ok('current week marked "This week" and open with its 7 days', !!nowRow && /This week/.test(nowRow.txt) && nowRow.open && nowRow.days === 7, JSON.stringify(nowRow && { open: nowRow.open, days: nowRow.days }));
  await p.click('.phd-tabs button:has-text("Build 2")'); await p.waitForTimeout(150);
  const b2 = await p.$$eval('.phw-row', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
  ok('Build 2: long ride counts the brick ride (5:15)', b2.some((t) => /5:15/.test(t)), b2[0]);
  ok('Build 2: quality sessions listed per week', (await p.$$eval('.phw-row .c-q > span', (e) => e.length)) >= 4);
  await p.click('.phw-row >> nth=1'); await p.waitForTimeout(150);
  const days = await p.$$eval('.phw.open .phw-days li', (e) => e.map((x) => x.textContent));
  ok('a week row opens into its 7 days', days.length === 7, days.slice(0, 2).join(' | '));
  const hi = await p.$$eval('svg.ramp rect', (rs) => rs.filter((r) => r.getAttribute('fill') === 'var(--accent-soft)').length);
  ok('selected phase is highlighted on the chart', hi === 1, String(hi));
  const wkN = (await p.textContent('.phw.open .c-wk b')).match(/\d+/)[0];
  await p.click('.phw.open .phw-days .linkbtn'); await p.waitForTimeout(400);
  ok('"Open week N in the calendar" jumps the calendar to that week', (await p.textContent('.stepper-label')).trim() === `Week ${wkN}`);
  { const t = p.locator('svg.ramp text', { hasText: /^Peak$/ }); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const bb = await t.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); } await p.waitForTimeout(150);
  ok('clicking a phase on the chart selects it', (await p.textContent('.phd-head')).startsWith('Peak'), await p.textContent('.phd-head'));
  // phone: no sideways scroll
  const ph = await b.newContext({ viewport: { width: 390, height: 844 } }); const q = await ph.newPage();
  await q.goto(base + '/plan', { waitUntil: 'networkidle' });
  const over = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('phone: no sideways scroll', !over);
  // new athlete without a plan: no phase card, no crash
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('velocity.demo', 'empty'); });
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  ok('no plan: no phase card', !(await p.$('.phd')));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
