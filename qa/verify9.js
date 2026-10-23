// Week grid covers 00:00–24:00; nutrition target columns share one size and line up.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const labels = await p.$$eval('.wg-hours span', (els) => els.map((e) => e.textContent));
  ok('week grid labels run 00:00 to 24:00', labels[0] === '00:00' && labels[labels.length - 1] === '24:00', labels.join(' '));
  const top = await p.$eval('.wg-scroll', (e) => e.scrollTop);
  ok('opens at the morning, not midnight', top > 60, `scrollTop ${top}`);
  await p.$eval('.wg-scroll', (e) => { e.scrollTop = 0; }); await p.waitForTimeout(100);
  const firstVis = await p.$eval('.wg-hours span.first', (e) => { const r = e.getBoundingClientRect(), b = document.querySelector('.wg-scroll').getBoundingClientRect(); return r.top >= b.top - 1 && r.bottom <= b.bottom; });
  ok('scrolling up shows 00:00', firstVis);
  await p.$eval('.wg-scroll', (e) => { e.scrollTop = e.scrollHeight; }); await p.waitForTimeout(100);
  const lastVis = await p.$eval('.wg-hours span.last', (e) => { const r = e.getBoundingClientRect(), b = document.querySelector('.wg-scroll').getBoundingClientRect(); return r.top >= b.top && r.bottom <= b.bottom + 1; });
  ok('scrolling down shows 24:00', lastVis);
  // lines sit on the labels: the label's centre matches a 40-px grid step
  const align = await p.$eval('.wg-hours span:nth-child(4)', (e) => { const r = e.getBoundingClientRect(), body = document.querySelector('.wg-body').getBoundingClientRect(); return Math.round((r.top + r.height / 2) - body.top); });
  ok('hour label sits on its grid line', Math.abs(align - 120) <= 1, `${align}px (06:00 line at 120)`);
  // a block dragged to midnight is allowed: move a session to 23:00 via the store API and check it renders inside the grid
  // nutrition targets
  await p.evaluate(() => localStorage.setItem('velocity.nutrition.v1', JSON.stringify({ profile: { weight_kg: 75, height_cm: 178, birth_year: 1994, sex: 'male', goal: 'maintain', goal_weight_kg: null, weight_stages: [], base_kcal: null, bottle_ml: 750, supplements: [], setup_done: true }, log: [], foods: [], drinks: [], weights: [], taken: [] })));
  await p.goto(base + '/nutrition', { waitUntil: 'networkidle' });
  const cols = await p.$$eval('.nu-targets > div', (els) => els.map((d) => {
    const g = (sel) => { const e = d.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), fs: getComputedStyle(e).fontSize }; };
    const bar = d.querySelector('.bar, [class*="bar"], .progress') || d.children[2];
    const br = bar.getBoundingClientRect();
    return { k: g('.k'), v: g('.v'), b: g('.v b'), bar: Math.round(br.top), u: g('.u'), w: Math.round(d.getBoundingClientRect().width) };
  }));
  const same = (f) => new Set(cols.map(f)).size === 1;
  ok('labels, numbers, bars and "remaining" lines sit at the same height in every column', same((c) => c.k.top) && same((c) => c.b.top) && same((c) => c.bar) && same((c) => c.u.top), JSON.stringify(cols.map((c) => [c.k.top, c.b.top, c.bar, c.u.top])));
  ok('calories uses the same font sizes as the other columns', same((c) => c.b.fs) && same((c) => c.v.fs) && same((c) => c.u.fs), JSON.stringify(cols.map((c) => [c.b.fs, c.v.fs, c.u.fs])));
  ok('calories column stays the widest', cols[0].w > Math.max(...cols.slice(1).map((c) => c.w)), cols.map((c) => c.w).join(' '));
  // dashboard hero: wearable stat right after the session stats, with a status dot; the log form is no taller than the hero
  for (const w of [1440, 1280]) {
    const q = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
    await q.goto(base + '/dashboard', { waitUntil: 'networkidle' });
    const g = await q.evaluate(() => { const st = [...document.querySelectorAll('.hero .stat')]; const gm = document.querySelector('.hero .stat.gm'); const prev = st[st.indexOf(gm) - 1]; const a = prev.getBoundingClientRect(), c = gm.getBoundingClientRect(), h = document.querySelector('.hero').getBoundingClientRect(); return { gap: Math.round(c.left - a.right), sameRow: Math.abs(c.top - a.top) < 4, inside: c.right <= h.right - 20, dot: !!gm.querySelector('.gm-dot.on') }; });
    ok(`${w}: wearable stat sits next to the session stats (or on its own line when narrow), inside the card`, g.inside && (!g.sameRow || g.gap <= 40), JSON.stringify(g));
    ok(`${w}: green dot when Garmin data is imported`, g.dot);
    await q.click('button.plus'); await q.waitForTimeout(500);
    const hh = await q.evaluate(() => [document.querySelector('.hero').getBoundingClientRect().height, document.querySelector('.logform').getBoundingClientRect().height].map(Math.round));
    ok(`${w}: log form is the hero's height`, hh[1] <= hh[0], hh.join(' vs '));
    ok(`${w}: heart-rate field says "Avg. heart rate (bpm)"`, /Avg\. heart rate \(bpm\)/.test(await q.textContent('.logform')));
  }
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
