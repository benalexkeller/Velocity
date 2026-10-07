// Dump every interactive control per page (text, tag, class) so the click-through can be planned.
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const pages = ['/dashboard', '/plan', '/activities', '/analysis', '/nutrition', '/calculator', '/store', '/login', '/setup', '/profile', '/admin', '/plan/new'];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', e => errors.push({ page: p.url(), msg: e.message }));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ page: p.url(), type: m.type(), msg: m.text().slice(0, 200) }); });
  for (const path of pages) {
    const resp = await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => {
      const ctl = [...document.querySelectorAll('button, a, input, select, textarea, [role=button], [onclick]')];
      const vis = ctl.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      return {
        title: document.title,
        url: location.href,
        h1: [...document.querySelectorAll('h1,h2')].slice(0, 6).map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 60)),
        controls: vis.map(e => `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : ''}${e.type ? '[' + e.type + ']' : ''} "${(e.textContent || e.placeholder || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`),
        bodyText: document.body.innerText.length,
      };
    });
    console.log(`\n===== ${path} -> ${info.url} (${resp.status()}) title="${info.title}" text=${info.bodyText}`);
    console.log(info.h1.join(' | '));
    const counts = {};
    for (const c of info.controls) counts[c] = (counts[c] || 0) + 1;
    for (const [c, n] of Object.entries(counts)) console.log((n > 1 ? `  ×${n} ` : '     ') + c);
  }
  console.log('\n===== console/page errors');
  for (const e of errors) console.log(JSON.stringify(e));
  await b.close();
})();
