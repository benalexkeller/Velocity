// Checks for fixes 1–3: log form, session panel, builder inputs, set-up persistence.
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

  // V-001 duration wheel keeps two typed digits
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await p.click('button.plus'); await p.waitForTimeout(400);
  const minIn = p.locator('.wh input[aria-label="min"]');
  await minIn.click(); await p.keyboard.type('30'); await minIn.blur(); await p.waitForTimeout(150);
  ok('V-001 typed 30 → 30', (await minIn.inputValue()) === '30', await minIn.inputValue());
  // V-002 negative distance and HR 300 blocked
  await p.fill('.lf-grid input[placeholder="6.2"]', '-5');
  await p.fill('.lf-grid input[placeholder="145"]', '300');
  await p.waitForTimeout(150);
  const errs = await p.$$eval('.lf-err', es => es.map(e => e.textContent));
  const saveDisabled = await p.$eval('.logform button[type=submit]', b => b.disabled);
  ok('V-002 inline errors shown and Save disabled', errs.length >= 2 && saveDisabled, errs.join(' | '));
  // V-056 future date blocked
  await p.fill('.lf-grid input[placeholder="6.2"]', '5'); await p.fill('.lf-grid input[placeholder="145"]', '150');
  await p.fill('.lf-grid input[type=date]', '2026-12-25'); await p.waitForTimeout(150);
  ok('V-056 future date blocked', await p.$eval('.logform button[type=submit]', b => b.disabled));
  await p.fill('.lf-grid input[type=date]', '2026-10-06');
  // V-057 seconds kept: 17:32
  const secIn = p.locator('.wh input[aria-label="s"]'); await secIn.click(); await p.keyboard.type('32'); await secIn.blur();
  await minIn.click(); await p.keyboard.type('17'); await minIn.blur(); await p.waitForTimeout(150);
  await p.fill('.lf-note', 'verify run');
  await p.click('.logform button[type=submit]'); await p.waitForTimeout(600);
  const store = await p.evaluate(() => JSON.parse(localStorage.getItem('velocity.store.v1') || '{}'));
  const last = (store.manual || []).slice(-1)[0] || {};
  ok('V-057 duration stored with seconds (17.53)', Math.abs((last.min ?? 0) - 17.53) < 0.02, `min=${last.min} hr=${last.hr} mi=${last.mi}`);
  ok('V-002 HR kept when in range', last.hr === 150, `hr=${last.hr}`);
  // V-003 form resets after close
  await p.click('button.plus'); await p.waitForTimeout(400);
  await p.fill('.lf-grid input[placeholder="0"]', '1001'); await p.click('.logform .close'); await p.waitForTimeout(500);
  await p.click('button.plus'); await p.waitForTimeout(400);
  ok('V-003 elevation cleared after Close', (await p.inputValue('.lf-grid input[placeholder="0"]')) === '');
  await p.click('.logform .close');

  // V-004 session panel remounts per session
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const ev = await p.$$('.wg-ev:not(.rest)');
  await ev[0].click(); await p.waitForTimeout(400);
  await p.click('.sp-actions button:has-text("Edit")'); await p.waitForTimeout(200);
  const textA = await p.inputValue('.sp-form input:not([type])');
  await ev[1].click(); await p.waitForTimeout(400);
  const stillEdit = await p.$('.sp-form');
  ok('V-004 Edit form closed when another session opens', !stillEdit, `was editing "${textA.slice(0, 30)}"`);
  // V-005 move outside plan blocked
  await p.click('.sp-actions button:has-text("Move")'); await p.waitForTimeout(200);
  await p.fill('.sp-form input[type=date]', '2020-01-01'); await p.waitForTimeout(150);
  ok('V-005 Move outside plan blocked', await p.$eval('.sp-form button[type=submit]', b => b.disabled) && !!(await p.$('.sp-form .err')));
  // V-133 lock toast clears
  await p.click('.sp-form button:has-text("Cancel")');
  await p.click('.sp-actions button:has-text("Lock")'); await p.waitForTimeout(300);
  const toastNow = await p.$('.sp-toast'); await p.waitForTimeout(3300);
  ok('V-133 lock toast clears after 3 s', !!toastNow && !(await p.$('.sp-toast')));
  await p.click('.sp-actions button:has-text("Unlock")');

  // V-006 / V-007 builder decimals and h:mm
  await p.goto(base + '/plan/new', { waitUntil: 'networkidle' });
  await p.click('.pb-types button:has-text("Full (140.6)")');
  await p.click('.form .days button:has-text("Target time")'); await p.waitForTimeout(100);
  const tt = p.locator('input[placeholder="13:00"]'); await tt.click(); await tt.fill(''); await p.keyboard.type('12:3'); await p.waitForTimeout(100);
  ok('V-007 target time keeps "12:3" while typing', (await tt.inputValue()) === '12:3', await tt.inputValue());
  await p.keyboard.type('0'); await tt.blur(); await p.waitForTimeout(100);
  ok('V-007 target time 12:30 on blur', (await tt.inputValue()) === '12:30', await tt.inputValue());
  await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await p.click('.pb-hits li button >> nth=0');
  await p.fill('.pb-card input[type=date]', '2027-04-24');
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(300);
  const hoursIn = p.locator('.pb-hours .unit-in input').first(); await hoursIn.click(); await hoursIn.fill(''); await p.keyboard.type('2.5'); await hoursIn.blur(); await p.waitForTimeout(100);
  ok('V-006 hours field accepts 2.5', (await hoursIn.inputValue()) === '2.5', await hoursIn.inputValue());
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(300);
  const lr = p.locator('input[placeholder="8"]'); await lr.click(); await p.keyboard.type('6.2'); await lr.blur(); await p.waitForTimeout(100);
  ok('V-006 longest run accepts 6.2', (await lr.inputValue()) === '6.2', await lr.inputValue());
  await p.click('.pb-nav .btn:has-text("Next")'); await p.waitForTimeout(300);
  const st = p.locator('.pb-stepper input').last(); await st.click(); await st.fill(''); await p.keyboard.type('7.5'); await st.blur(); await p.waitForTimeout(100);
  ok('V-006 max-hours stepper accepts 7.5', (await st.inputValue()) === '7.5', await st.inputValue());

  // V-036 set-up persists in local mode
  await p.goto(base + '/setup', { waitUntil: 'networkidle' });
  await p.fill('input[placeholder="e.g. pr_tri"]', 'tester1');
  await p.fill('input[autocomplete="name"]', 'Test Athlete');
  await p.selectOption('select >> nth=0', 'metric');
  await p.click('button:has-text("Save and build my plan")'); await p.waitForTimeout(800);
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  const greet = await p.textContent('.topbar, header').catch(() => '');
  const store2 = await p.evaluate(() => JSON.parse(localStorage.getItem('velocity.store.v1') || '{}'));
  ok('V-036 name/units persisted after reload', store2.profile?.name === 'Test Athlete' && store2.profile?.units === 'metric', JSON.stringify(store2.profile));
  ok('V-036 greeting uses the saved name', /Test/.test(greet || ''), (greet || '').slice(0, 80));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
