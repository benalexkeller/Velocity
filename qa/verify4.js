// Items 10–11: nutrition targets follow what was done, timing rows, estimate days, no targets without weight.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const out = [];
const ok = (name, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  await p.goto(base + '/nutrition', { waitUntil: 'networkidle' });
  // V-104: skip set-up without a weight → no invented targets
  const skip = await p.$('button:has-text("Skip, use defaults")'); if (skip) { await skip.click(); await p.waitForTimeout(400); }
  const t0 = await p.textContent('main');
  ok('V-104 no targets without a weight', /Add your weight to get targets/.test(t0) && !/\/ 3,0\d\d kcal/.test(t0));
  // seed a profile with weight + a whole-day estimate yesterday
  const t = new Date(), y = new Date(t.getTime() - 86400000);
  await p.evaluate(({ td, yd }) => {
    localStorage.setItem('velocity.nutrition.v1', JSON.stringify({
      profile: { weight_kg: 75, height_cm: 178, birth_year: 1994, sex: 'male', goal: 'maintain', goal_weight_kg: null, weight_stages: [], base_kcal: null, bottle_ml: 750, supplements: [], setup_done: true },
      log: [{ id: 'q1', date: yd, meal: 'breakfast', name: 'Estimate', kcal: 2200, carbs_g: 0, protein_g: 0, fat_g: 0, fibre_g: 0, sodium_mg: 0, source: 'quick' },
            { id: 'b1', date: td, meal: 'breakfast', name: 'Oats', kcal: 300, carbs_g: 54, protein_g: 11, fat_g: 5, fibre_g: 8, sodium_mg: 5, source: 'builtin' }],
      foods: [], drinks: [], weights: [], taken: [],
    }));
  }, { td: ymd(t), yd: ymd(y) });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const day = await p.textContent('main');
  ok('targets shown with a weight', /\/ [\d,]+ kcal/.test(day));
  const timing = await p.textContent('.nu-carbgoal').catch(() => '');
  ok('V-091 During row present', /During sessions/.test(timing || ''), (timing || '').replace(/\s+/g, ' ').slice(0, 200));
  ok('V-033 Before row is tied to breakfast for a dawn session', /Before session · breakfast/.test(timing || ''));
  // V-032: today's planned swim is not done; yesterday's planned run (Tue) was missed → yesterday's target has no training
  await p.click('button[aria-label="Previous day"]'); await p.waitForTimeout(300);
  const yday = await p.textContent('.nu-targets');
  ok('V-034 estimate-only day shows "—" for macros', /estimate, no breakdown/.test(yday), yday.replace(/\s+/g, ' ').slice(0, 160));
  const yTitle = await p.getAttribute('.nu-targets .big', 'title');
  ok('V-032 missed session adds no training energy', !/training/.test(yTitle || ''), yTitle);
  await p.click('button:has-text("Week")'); await p.waitForTimeout(400);
  const wk = await p.textContent('.nu-weektable');
  ok('V-034 week table marks the estimate day "(est.)"', /2,200 \(est\.\)/.test(wk));
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
