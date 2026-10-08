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
  const stats = await p.$$eval('.phd-stats > div', (els) => els.map((e) => e.textContent));
  ok('facts come from the plan (hours, long sessions)', stats.some((t) => /^Hours per week[\d.]+/.test(t)) && stats.some((t) => /^Long ride\d/.test(t)), stats.join(' | '));
  await p.click('.phd-tabs button:has-text("Build 2")'); await p.waitForTimeout(150);
  const b2 = await p.$$eval('.phd-stats > div', (els) => Object.fromEntries(els.map((e) => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  ok('Build 2: long ride counts the brick ride (5:15)', /5:15/.test(b2['Long ride'] || ''), JSON.stringify(b2));
  ok('Build 2: quality sessions found in the session text', b2['Quality sessions'] && b2['Quality sessions'] !== 'none', b2['Quality sessions']);
  const hi = await p.$$eval('svg.ramp rect', (rs) => rs.filter((r) => r.getAttribute('fill') === 'var(--accent-soft)').length);
  ok('selected phase is highlighted on the chart', hi === 1, String(hi));
  { const t = p.locator('svg.ramp text', { hasText: /^Peak$/ }); const bb = await t.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); } await p.waitForTimeout(150);
  ok('clicking a phase on the chart selects it', (await p.textContent('.phd-head')).startsWith('Peak'), await p.textContent('.phd-head'));
  await p.click('.phd-head .linkbtn'); await p.waitForTimeout(400);
  const wk = await p.textContent('.stepper-label');
  const from = (await p.textContent('.phd-head')).match(/Weeks (\d+)/)[1];
  ok('"Open week" jumps the calendar to that week', wk.trim() === `Week ${from}`, `${wk} vs ${from}`);
  const ms = await p.$$eval('.phd-ms li', (els) => els.map((e) => e.textContent));
  ok('milestones only when concrete', ms.every((m) => /\d/.test(m)), ms.join(' | '));
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
