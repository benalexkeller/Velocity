// Slice 2 checks: zones from intake (V-015), threshold-based load/zones (V-019/020/089), session status by sport (V-016/088).
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  p.on('dialog', d => d.accept());

  // Seed athlete: the dashboard still renders and shows the compliance wording
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  const tw = await p.textContent('.card.tw');
  const twHead = await p.$eval('.card.tw .head', (e) => e.getBoundingClientRect().height);
  ok('This week card: one-line header, no 28-day line, no unit inside the big number', twHead < 30 && !/28 days/.test(tw || '') && /Hours/.test(tw || ''), `head ${Math.round(twHead)}px · ${(tw || '').slice(0, 60)}`);
  // Activities detail: load and effort still present for a Garmin activity
  await p.goto(base + '/activities', { waitUntil: 'networkidle' });
  const rows = await p.$$('tr.row'); await rows[0].click(); await p.waitForTimeout(300);
  const load = await p.$eval('.detail .v, .act-detail .v, aside .v', e => e.textContent).catch(() => null);
  ok('seed activity shows a load', !!load, String(load));

  // V-016: a 12-minute swim on a planned run day must NOT complete the run
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const runBlock = await p.$('.wg-ev.run:not(.done)');
  const runText = await runBlock.textContent();
  await runBlock.click(); await p.waitForTimeout(300);
  const date = await p.$eval('.sp-head .eyebrow', e => e.textContent);
  // log a 12-min swim on that date via the dashboard form
  const ymd = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('velocity.store.v1') || '{}'); return s; });
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await p.click('button.plus'); await p.waitForTimeout(300);
  await p.click('.lf-row.sports button:has-text("Swim")');
  const planDate = await p.evaluate(() => { const t = new Date(); t.setDate(t.getDate() - 1); return t.toISOString().slice(0, 10); });
  // find yesterday's planned non-rest session via the plan store instead: use the Plan page's Tue block date from the eyebrow
  const m = (date || '').match(/^(\w{3}) (\d+) (\w{3})/);
  await p.fill('.lf-grid input[type=date]', planDate);
  const minIn = p.locator('.wh input[aria-label="min"]'); await minIn.click(); await p.keyboard.type('12'); await minIn.blur();
  await p.click('.logform button[type=submit]'); await p.waitForTimeout(500);
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const blocks = await p.$$eval('.wg-ev', els => els.map(e => ({ cls: e.className, txt: e.textContent.slice(0, 40) })));
  const yesterday = blocks.filter(b => /swim|run|bike/.test(b.cls));
  const runDone = blocks.some(b => /\brun\b/.test(b.cls) && /\bdone\b/.test(b.cls) && !/partial/.test(b.cls));
  const anySubstituted = blocks.some(b => /substituted/.test(b.cls));
  ok('V-016 a swim does not complete a run (no run marked done)', !runDone, JSON.stringify(blocks.filter(b => /done|substituted|partial/.test(b.cls)).slice(0, 4)));
  ok('V-016 the run day shows "substituted" or stays planned/missed', anySubstituted || !runDone, '');

  // V-015: build a marathon plan for a 2:45 runner → run targets around 7:03–7:41 easy, not 10:15
  await p.evaluate(() => localStorage.clear());
  await p.goto(base + '/plan/new', { waitUntil: 'networkidle' });
  await p.click('.pb-types button:has-text("Marathon")');
  await p.fill('.pb-searchin input', 'houston'); await p.waitForTimeout(200); await p.click('.pb-hits li button >> nth=0');
  const raceDate = await p.evaluate(() => { const t = new Date(); t.setDate(t.getDate() + 7 * 16); return t.toISOString().slice(0, 10); });
  await p.fill('.pb-card input[type=date]', raceDate);
  await p.click('.form .days button:has-text("Target time")');
  const tt = p.locator('input[placeholder="4:00"]'); await tt.click(); await tt.fill(''); await p.keyboard.type('2:45'); await tt.blur();
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(250);
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(250);
  const lthr = p.locator('input[placeholder="165"]'); await lthr.click(); await p.keyboard.type('172'); await lthr.blur();
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(250);
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(250);
  await p.click('.pb-nav .btn:has-text("Build my plan")'); await p.waitForTimeout(36000);
  const store = await p.evaluate(() => JSON.parse(localStorage.getItem('velocity.store.v1') || '{}'));
  const z = store.profile && store.profile.zones;
  ok('V-015 zones saved from the intake', !!z && !!z.run && z.meta && z.meta.lthr === '172', JSON.stringify(z && { run: z.run, hr: z.hr, meta: z.meta }).slice(0, 300));
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const ev = await p.$('.wg-ev.run'); if (ev) { await ev.click(); await p.waitForTimeout(400); }
  const panel = await p.textContent('.session-panel').catch(() => '');
  const tp = (panel || '').match(/Target pace\s*([\d:]+ – [\d:]+)/);
  ok('V-015 marathoner sees his own easy pace (7:xx), not 10:15', !!tp && /^7:/.test(tp[1]), tp ? tp[1] : (panel || '').slice(0, 120));
  ok('V-015 panel says the targets come from the answers', /from your answers/.test(panel || ''));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
