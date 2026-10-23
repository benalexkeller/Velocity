// Lists console errors (hydration #418/#425/#423 and others) on every main page, with a clock far from the build time.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const pages = ['/dashboard', '/plan', '/activities', '/analysis', '/nutrition', '/calculator', '/store', '/profile', '/plan/new'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // evening in Los Angeles: different greeting and possibly a different date than the build machine
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: process.argv[2] || 'America/Los_Angeles' });
  const p = await ctx.newPage();
  let total = 0;
  for (const path of pages) {
    const errs = [];
    const onC = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); };
    const onE = (e) => errs.push('pageerror: ' + e.message.slice(0, 140));
    p.on('console', onC); p.on('pageerror', onE);
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    p.off('console', onC); p.off('pageerror', onE);
    const hyd = errs.filter((e) => /418|423|425|hydrat/i.test(e));
    total += hyd.length;
    console.log(`${path}: ${hyd.length} hydration · ${errs.length} errors${errs.length ? ' · ' + errs.slice(0, 2).join(' | ') : ''}`);
  }
  console.log(`TOTAL hydration errors: ${total}`);
  await b.close();
})();
