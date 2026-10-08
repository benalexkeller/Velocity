// Finds short labels/values/buttons that wrap onto two lines, and lists every muted sentence on each page.
// node wrapcheck.js [widths]   → prints WRAP lines and SENT lines
const { chromium } = require('playwright');
const base = 'http://localhost:3111';
const widths = (process.argv[2] || '1440,1280,390').split(',').map(Number);
const pages = [
  ['dashboard', '/dashboard'],
  ['plan', '/plan'],
  ['plan-session', '/plan', async (p) => { const e = await p.$('.wg-ev.run, .wg-ev.bike'); if (e) { await e.click(); await p.waitForTimeout(400); } }],
  ['plan-month', '/plan', async (p) => { const b = await p.$('button:has-text("Month")'); if (b) { await b.click(); await p.waitForTimeout(300); } }],
  ['activities', '/activities', async (p) => { const r = await p.$('tr.row'); if (r) { await r.click(); await p.waitForTimeout(400); } }],
  ['analysis', '/analysis'],
  ['nutrition-track', '/nutrition'],
  ['nutrition-guide', '/nutrition', async (p) => { const b = await p.$('[role=tab]:has-text("Guide"), button:has-text("Guide")'); if (b) { await b.click(); await p.waitForTimeout(400); } }],
  ['nutrition-supp', '/nutrition', async (p) => { const b = await p.$('[role=tab]:has-text("Supplements"), button:has-text("Supplements")'); if (b) { await b.click(); await p.waitForTimeout(400); } }],
  ['tools', '/calculators'],
  ['profile', '/profile'],
  ['builder', '/plan/new'],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const seen = new Set();
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 } });
    const p = await ctx.newPage();
    await p.goto(base + '/dashboard', { waitUntil: 'networkidle' });
    await p.evaluate(() => { localStorage.setItem('velocity.nutrition.v1', localStorage.getItem('velocity.nutrition.v1') || ''); });
    for (const [name, url, act] of pages) {
      await p.goto(base + url, { waitUntil: 'networkidle' }).catch(() => {});
      if (act) await act(p).catch(() => {});
      await p.waitForTimeout(200);
      const res = await p.evaluate(() => {
        const out = { wrap: [], sent: [] };
        const SEL = '.eyebrow, .k, .v, h1, h2, h3, button, a.btn, th, .chip, .badge, label > b, small, .qstatus, .tab, [role=tab], .stepper-label, .legend span, .lgd span, .sub, .head > span, .hd span';
        for (const el of document.querySelectorAll(SEL)) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
          if (!t || t.length > 48 || t.includes('\n')) continue;
          if (el.querySelector('svg') && !t) continue;
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
          // line count from client rects of the text
          const range = document.createRange(); range.selectNodeContents(el);
          const tops = new Set([...range.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top / (lh * 0.6))));
          if (tops.size > 1 && r.height > lh * 1.6) out.wrap.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ').slice(0, 2).join('.')} "${t}" h=${Math.round(r.height)} w=${Math.round(r.width)}`);
        }
        const isMuted = (c) => { const m = c.match(/\d+/g); if (!m) return false; const [r, g, b2] = m.map(Number); return r > 90 && Math.abs(r - g) < 20 && Math.abs(g - b2) < 25 && r < 200; };
        for (const el of document.querySelectorAll('p, span, div, small, li')) {
          if ([...el.children].some((c) => !['B', 'A', 'I', 'SPAN', 'BR', 'STRONG', 'EM'].includes(c.tagName))) continue;
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
          if (t.length < 28 || !/[a-z]{3,} [a-z]{3,} [a-z]{3,}/i.test(t)) continue;
          const r = el.getBoundingClientRect(); if (!r.width) continue;
          if (!isMuted(getComputedStyle(el).color)) continue;
          if (el.closest('table, .msgs, .facts, svg')) continue;
          out.sent.push(t.slice(0, 150));
        }
        out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
        return out;
      });
      for (const x of res.wrap) console.log(`WRAP ${w} ${name}: ${x}`);
      if (res.overflow) console.log(`OVERFLOW ${w} ${name}`);
      for (const s of res.sent) { const k = name + s; if (seen.has(k)) continue; seen.add(k); console.log(`SENT ${name}: ${s}`); }
    }
    await ctx.close();
  }
  await b.close();
})();
