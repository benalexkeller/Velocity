// Phone week list (V-108), keyboard access (V-064), lock spacing, focus rings.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  // phone
  const ph = await b.newContext({ viewport: { width: 390, height: 844 } }); const q = await ph.newPage();
  q.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await q.goto(base + '/plan', { waitUntil: 'networkidle' });
  const gridShown = await q.$eval('.wg', (e) => getComputedStyle(e).display !== 'none');
  const rows = await q.$$eval('.wl > li', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok('V-108 phone shows the week as a 7-row list, not the time grid', !gridShown && rows.length === 7, rows.slice(0, 3).join(' | '));
  ok('V-108 rows carry title, start, intensity and minutes', rows.some((r) => /(Run|Bike|Swim) · \d\d:\d\d.*min/.test(r)), rows.find((r) => /min/.test(r)));
  await q.click('.wl-s >> nth=0'); await q.waitForTimeout(400);
  ok('V-108 tapping a row opens the session panel', !!(await q.$('.session-panel')));
  const rampW = await q.$eval('svg.ramp', (e) => e.getBoundingClientRect().width);
  const over = await q.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('V-108 ramp chart readable (≥ 760 px, scrolls inside its box), page does not scroll sideways', rampW >= 760 && !over, `${Math.round(rampW)} px`);
  // desktop keyboard
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  await p.focus('.wg-ev.run'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('V-064 Enter on a week block opens it', !!(await p.$('.session-panel')));
  const ring = await p.$eval('.wg-ev.run', (e) => getComputedStyle(e).outlineStyle);
  ok('focus ring visible on the focused block', ring === 'solid', ring);
  await p.click('button:has-text("Month")'); await p.waitForTimeout(200);
  const chipTag = await p.$eval('.mg-s', (e) => e.tagName);
  ok('V-064 month chips are buttons', chipTag === 'BUTTON', chipTag);
  await p.goto(base + '/activities', { waitUntil: 'networkidle' });
  await p.focus('tr.row >> nth=2'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const selRow = await p.$eval('tr.row.sel', (e) => e.rowIndex).catch(() => null);
  ok('V-064 Enter on an activity row selects it', selRow != null, String(selRow));
  const cur = await p.$eval('.nav a[aria-current="page"]', (e) => e.textContent).catch(() => null);
  ok('active nav link has aria-current', /Activities/.test(cur || ''), String(cur));
  // lock icon never covers text
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  await p.hover('.wg-ev.run:not(.done)'); await p.click('.wg-ev.run:not(.done) .lk'); await p.waitForTimeout(200); await p.mouse.move(5, 5);
  const lk = await p.$eval('.wg-ev.run.locked', (e) => { const l = e.querySelector('.lk').getBoundingClientRect(); const t = e.querySelector('.txt b').getBoundingClientRect(); return { lkL: l.left, txtR: t.right }; });
  ok('lock icon on a locked block sits clear of the block text', lk.txtR <= lk.lkL + 0.5, JSON.stringify(lk));
  await p.click('.wg-ev.run.locked .lk', { force: true }); await p.waitForTimeout(150);
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
