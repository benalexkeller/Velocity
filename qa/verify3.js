// Items 7–9: scores removed, gated projection, body panel, crash/cold start, seed out of other accounts.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));

  // Seed athlete (week 5, base phase)
  await p.goto(base + '/analysis', { waitUntil: 'networkidle' });
  const body = await p.textContent('main');
  ok('V-022 no "Race capability score"', !/capability score/i.test(body));
  ok('V-025 no "Health score" ring', !/Health score/.test(body) && !/Building|Near targets/.test(body));
  ok('V-023 no "On track" verdict', !/On track for/.test(body));
  ok('V-023 projection gated in base phase', /Shows from the Build phase/.test(body), (body.match(/Last 8 weeks:[^.]*\./) || [''])[0]);
  ok('V-084 VO2max trend shown', /VO2max/.test(body) && !!(await p.$('svg[aria-label="VO2max over time"]')));
  const fit = await p.$$eval('.kpi', ks => ks.map(k => k.textContent).find(t => /Fitness/.test(t)) || '');
  ok('V-021 Fitness seeded (not a warm-up artefact)', /\d/.test(fit), fit.replace(/\s+/g, ' ').slice(0, 60));
  await p.screenshot({ path: '/home/claude/qa/v3-analysis.png', fullPage: true });

  // Dashboard: no weather, Garmin "Imported", watch with real numbers
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  const top = await p.textContent('header, .topbar').catch(() => '');
  ok('V-047 no weather in the top bar', !/°C/.test(top || ''), (top || '').slice(0, 60));
  const hero = await p.textContent('.hero');
  ok('V-050 Garmin shows "Imported <date>", not "Connected"', /Imported \d+ \w{3}/.test(hero) && !/Connected/.test(hero));
  const watch = await p.$$eval('svg.watch text', ts => ts.map(t => t.textContent));
  ok('V-051 watch shows the last activity (1:01:00 · 6.3 mi · 152)', watch.includes('1:01:00') && watch.includes('6.3 mi') && watch.includes('152'), watch.join(' | '));

  // Calculator uses own data
  await p.goto(base + '/calculator', { waitUntil: 'networkidle' });
  const calc = await p.textContent('main');
  ok('V-035 no "Ironman Texas" note in the race-time calculator', !/Sub-13 at Ironman Texas/.test(calc));

  // New athlete (empty demo): no seed coach thread; Analysis does not crash; calculator button disabled
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('velocity.demo', 'empty'); });
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const rail = await p.textContent('aside.coach').catch(() => '');
  ok('V-054 new athlete has no example coach thread', !/calf cramp|7:30/.test(rail || '') && /Ask about today/.test(rail || ''), (rail || '').slice(0, 80));
  await p.goto(base + '/analysis', { waitUntil: 'networkidle' });
  const an2 = await p.textContent('main');
  ok('V-029 Analysis renders for a new athlete', /Analysis/.test(an2) && !/could not load/.test(an2));
  ok('V-024 no race → "No race set", no Ironman legs', /No race set/.test(an2) && !/2\.4 mi/.test(an2));
  await p.goto(base + '/calculator', { waitUntil: 'networkidle' });
  const btn = await p.$('button:has-text("No activities in the last 4 weeks")');
  ok('V-035 calculator button disabled with no activities', !!btn && await btn.isDisabled());

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
