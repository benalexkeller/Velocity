// Coach panel: closable on Plan (remembered), opens on the right from the coach bar elsewhere, only today's messages.
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
  ok('Plan: coach docked by default', !!(await p.$('aside.coach:not(.drawer)')) && !!(await p.$('main.with-coach')));
  const railText = await p.textContent('aside.coach');
  ok('Plan: no example thread', !/calf cramp|7:30/.test(railText), railText.slice(0, 80));
  await p.click('aside.coach button[aria-label="Close coach"]'); await p.waitForTimeout(200);
  ok('Plan: close removes the panel and gives the space back', !(await p.$('aside.coach')) && !(await p.$('main.with-coach')) && !!(await p.$('.coachbar')));
  await p.reload({ waitUntil: 'networkidle' });
  ok('Plan: closed state remembered after reload', !(await p.$('aside.coach')) && !!(await p.$('.coachbar')));
  await p.click('.coachbar'); await p.waitForTimeout(250);
  const focused = await p.evaluate(() => document.activeElement && document.activeElement.id);
  ok('Plan: coach bar opens the docked panel with the input focused', !!(await p.$('main.with-coach aside.coach')) && focused === 'coach-input', String(focused));

  // other pages: drawer on the right
  await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  ok('Dashboard: no panel until asked', !(await p.$('aside.coach')) && !!(await p.$('.coachbar')));
  const padBefore = await p.$eval('main.main', (e) => parseFloat(getComputedStyle(e).paddingRight));
  await p.click('.coachbar'); await p.waitForTimeout(250);
  const box = await p.$eval('aside.coach.drawer', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, right: window.innerWidth - r.right }; }).catch(() => null);
  const padAfter = await p.$eval('main.main', (e) => parseFloat(getComputedStyle(e).paddingRight));
  ok('Dashboard: coach bar opens a right-side panel', !!box && box.right < 2 && box.w > 300, JSON.stringify(box));
  ok('Dashboard: page layout unchanged under the panel', padAfter === padBefore, `${padBefore} → ${padAfter}`);
  ok('Dashboard: bar hidden while panel open', !(await p.$('.coachbar')));
  await p.fill('#coach-input', 'what is on this week'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const msgs = await p.$$eval('aside.coach .msg', (els) => els.length);
  ok('Dashboard: a message gets an answer in the panel', msgs >= 2, String(msgs));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Dashboard: Esc closes the panel', !(await p.$('aside.coach')));

  // daily reset: yesterday's messages are kept but not shown
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('velocity.store.v1') || '{}');
    s.thread = [{ who: 'You', at: '07:00', text: 'OLD-YESTERDAY', day: '2000-01-01' }, { who: 'Coach', at: '07:00', text: 'OLD-NODAY' }, ...(s.thread || [])];
    localStorage.setItem('velocity.store.v1', JSON.stringify(s));
  });
  await p.goto(base + '/plan', { waitUntil: 'networkidle' });
  const t2 = await p.textContent('aside.coach');
  ok('Daily reset: only today\'s messages show', !/OLD-YESTERDAY|OLD-NODAY/.test(t2) && /what is on this week/.test(t2), t2.slice(0, 100));
  const kept = await p.evaluate(() => (JSON.parse(localStorage.getItem('velocity.store.v1')).thread || []).length);
  ok('Daily reset: older messages stay saved', kept >= 4, String(kept));

  // phone: the panel covers the screen and closes
  const ph = await b.newContext({ viewport: { width: 390, height: 844 } });
  const q = await ph.newPage();
  await q.goto(base + '/analysis', { waitUntil: 'networkidle' });
  await q.click('.coachbar'); await q.waitForTimeout(250);
  const pb = await q.$eval('aside.coach', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, top: r.top }; }).catch(() => null);
  ok('Phone: coach opens full width', !!pb && pb.x === 0 && pb.w === 390, JSON.stringify(pb));
  await q.click('aside.coach button[aria-label="Close coach"]'); await q.waitForTimeout(150);
  ok('Phone: close works', !(await q.$('aside.coach')));
  await q.goto(base + '/plan', { waitUntil: 'networkidle' });
  ok('Phone: Plan starts with the panel closed', !(await q.$('aside.coach')) && !!(await q.$('.coachbar')));

  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(out.join('\n'));
  await b.close();
})();
