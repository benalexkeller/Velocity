// Round 2: flush period steppers, connect-wearable everywhere, session fuel on hero + panel, recent-activities status words.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('velocity.nutrition.v1', JSON.stringify({ profile: { weight_kg: 75, height_cm: 178, birth_year: 1994, sex: 'male', goal: 'maintain', goal_weight_kg: null, weight_stages: [], base_kcal: null, bottle_ml: 750, supplements: [], setup_done: true }, log: [], foods: [], drinks: [], weights: [], taken: [] })));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const fuel = await p.textContent('.hero .fuel-line').catch(() => null);
  ok('V-049 fuel line on the dashboard hero', !!fuel && /during/.test(fuel), fuel);
  const url0 = p.url();
  await p.click('.hero .cw-btn'); await p.waitForTimeout(300);
  ok('wearable: hero button opens the sheet without leaving the dashboard', !!(await p.$('.cw-sheet')) && p.url() === url0);
  await p.click('.cw-list li:has-text("Garmin") button'); await p.waitForTimeout(200);
  ok('wearable: picking Garmin is saved', /Picked/.test(await p.textContent('.cw-list li:has-text("Garmin")')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('wearable: Esc closes the sheet and stays on the page', !(await p.$('.cw-sheet')) && p.url() === url0);
  await p.screenshot({ path: '/home/claude/qa/r2-dash.png' });
  // plan stepper flush
  await p.goto(base + '/plan', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const g = await p.evaluate(() => { const [a, c] = [...document.querySelectorAll('.plan-head .stepper-btn')].map((e) => e.getBoundingClientRect()); const l = document.querySelector('.plan-head .stepper-label').getBoundingClientRect(); return { left: Math.round(l.left - a.right), right: Math.round(c.left - l.right) }; });
  ok('arrows flush with the week label (gap ≤ 2 px)', g.left <= 2 && g.right <= 2, JSON.stringify(g));
  const before = await p.evaluate(() => document.querySelectorAll('.plan-head .stepper-btn')[1].getBoundingClientRect().left);
  await p.click('.plan-head .stepper-btn >> nth=1'); await p.waitForTimeout(200);
  const after = await p.evaluate(() => document.querySelectorAll('.plan-head .stepper-btn')[1].getBoundingClientRect().left);
  ok('arrows do not move when the week changes', before === after, `${before} → ${after}`);
  await p.click('.pill-group button:has-text("Month")'); await p.waitForTimeout(300);
  const lab = await p.textContent('.plan-head .stepper-label');
  ok('month view uses the same stepper', /October|November/.test(lab), lab);
  await p.click('.pill-group button:has-text("Week")'); await p.waitForTimeout(200);
  const ev = await p.$$('.wg-ev:not(.rest)'); await ev[0].click(); await p.waitForTimeout(400);
  const fb = await p.textContent('.sp-fuel').catch(() => null);
  ok('V-049 fuel block in the session panel', !!fb && /Before/.test(fb) && /During/.test(fb) && /After/.test(fb), (fb || '').replace(/\s+/g, ' ').slice(0, 160));
  await p.screenshot({ path: '/home/claude/qa/r2-plan.png' });
  // nutrition stepper
  await p.goto(base + '/nutrition', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const n = await p.evaluate(() => { const [a, c] = [...document.querySelectorAll('.nu-daynav .stepper-btn')].map((e) => e.getBoundingClientRect()); const l = document.querySelector('.nu-daynav .stepper-label').getBoundingClientRect(); return { left: Math.round(l.left - a.right), right: Math.round(c.left - l.right) }; });
  ok('nutrition day arrows flush', n.left <= 2 && n.right <= 2, JSON.stringify(n));
  // activities + profile + setup + builder have the connect button
  for (const [path, sel] of [['/activities', '.cw-btn'], ['/profile', '.cw-btn'], ['/setup', '.cw-btn']]) { await p.goto(base + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(300); ok(`connect button on ${path}`, !!(await p.$(sel))); }
  await p.screenshot({ path: '/home/claude/qa/r2-setup.png' });
  // analysis status words
  await p.goto(base + '/analysis', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  const q = await p.textContent('section[aria-label="Training quality"]').catch(() => '');
  ok('V-026 no execution % for a rest-day run or another sport', !/100%/.test(q) && /Unplanned/.test(q), q.replace(/\s+/g, ' ').slice(0, 300));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
