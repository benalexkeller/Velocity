// Builds a single-file "review mirror" of the running app for comment-based design review.
// Usage: node scripts/snapshot.js http://localhost:3111 out.html
const { chromium } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:3111';
const out = process.argv[3] || 'preview.html';
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'plan', label: 'Plan', path: '/plan', after: async (p) => { const ev = await p.$$('.wg-ev'); const pick = ev[2] || ev[ev.length - 1]; if (pick) await pick.click(); await p.waitForTimeout(400); const bars = await p.$$('svg.ramp g > rect[fill="transparent"]'); if (bars[11]) await bars[11].click(); await p.waitForTimeout(400); } },
  { id: 'activities', label: 'Activities', path: '/activities', after: async (p) => { const r = await p.$$('tr.row'); if (r[2]) await r[2].click(); await p.waitForTimeout(300); } },
  { id: 'analysis', label: 'Analysis', path: '/analysis', after: async (p) => { await p.click('.an-pick .plus'); await p.waitForTimeout(200); const opts = await p.$$eval('.an-select option', os => os.map(o => o.value)); if (opts[3]) await p.selectOption('.an-select', opts[3]); await p.waitForTimeout(400); const vg = await p.$$('.ax-volwrap svg > g'); if (vg.length) { await vg[vg.length - 1].hover(); await p.waitForTimeout(250); } } },
  { id: 'nutrition', label: 'Nutrition', path: '/nutrition', after: async (p) => {
    // seed a set-up profile and a logged day so the Track tab shows content in the mirror
    await p.evaluate(() => {
      const d = new Date(); const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      const t = ymd(d); const y = ymd(new Date(d.getTime() - 86400000));
      const e = (id, date, meal, name, unit, kcal, c, pr, f, fi, na, source = 'builtin') => ({ id, date, meal, name, unit, kcal, carbs_g: c, protein_g: pr, fat_g: f, fibre_g: fi, sodium_mg: na, source });
      localStorage.setItem('velocity.nutrition.v1', JSON.stringify({
        profile: { weight_kg: 74.8, height_cm: 178, birth_year: 1994, sex: 'male', goal: 'race_weight', goal_weight_kg: 72.5, bottle_ml: 750, supplements: [{ id: 'caffeine', dose: '200 mg', time: 'pre-session' }, { id: 'vitamin-d', dose: '2,000 IU', time: 'morning' }, { id: 'creatine', dose: '5 g', time: 'morning' }], setup_done: true },
        log: [e('a1', t, 'breakfast', 'Oats, rolled, dry', '2 × ½ cup', 303, 54, 11, 5, 8, 5), e('a2', t, 'breakfast', 'Banana, raw', '1 × 1 medium', 105, 27, 1, 0, 3, 1), e('a3', t, 'breakfast', 'Greek yogurt, plain, 2%', '1 × 1 cup', 146, 8, 20, 4, 0, 68), e('a4', t, 'lunch', 'Chicken breast, cooked', '1 × 1 breast', 248, 0, 47, 5, 0, 111), e('a5', t, 'lunch', 'Brown rice, cooked', '1 × 1 cup', 240, 50, 5, 2, 3, 8), e('a6', t, 'lunch', 'Mixed salad greens', '1 × 2 cups', 14, 3, 1, 0, 2, 24), e('a7', t, 'snack', 'Energy bar, oat', '1 × 1 bar', 230, 42, 6, 5, 3, 150), e('b1', y, 'breakfast', 'Estimate', undefined, 500, 0, 0, 0, 0, 0, 'quick'), e('b2', y, 'lunch', 'Estimate', undefined, 800, 0, 0, 0, 0, 0, 'quick'), e('b3', y, 'dinner', 'Estimate', undefined, 900, 0, 0, 0, 0, 0, 'quick')],
        foods: [], drinks: [{ id: 'd1', date: t, ml: 750, at: '07:40' }, { id: 'd2', date: t, ml: 750, at: '12:10' }, { id: 'd3', date: y, ml: 2250, at: '20:00' }], weights: [{ date: y, weight_kg: 74.8 }, { date: t, weight_kg: 74.6 }], taken: [{ date: t, supplement_id: 'caffeine', taken_at: '08:00' }, { date: t, supplement_id: 'vitamin-d', taken_at: '08:00' }],
      }));
    });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  } },
  { id: 'calculator', label: 'Calculator', path: '/calculator' },
  { id: 'store', label: 'Store', path: '/store' },
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  let css = '';
  const seen = new Set();
  const sections = [];
  for (const pg of PAGES) {
    await p.goto(base + pg.path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    if (pg.after) await pg.after(p);
    // collect stylesheets
    const links = await p.$$eval('link[rel=stylesheet]', ls => ls.map(l => l.href));
    for (const href of links) { if (seen.has(href)) continue; seen.add(href); const r = await p.request.get(href); css += '\n' + (await r.text()); }
    const inline = await p.$$eval('style', ss => ss.map(s => s.textContent).join('\n'));
    if (!seen.has('inline:' + pg.id)) { seen.add('inline:' + pg.id); css += '\n' + inline; }
    const fontClass = await p.$eval('html', h => h.className);
    let body = await p.$eval('.shell', el => el.outerHTML);
    body = body.replace(/<script[\s\S]*?<\/script>/g, '');
    sections.push({ ...pg, html: body, fontClass });
  }
  await b.close();
  // inline the self-hosted font
  const fontUrl = (css.match(/url\(([^)]+\.woff2[^)]*)\)/) || [])[1];
  if (fontUrl) {
    const f = fs.readFileSync('src/app/fonts/inter-latin-wght.woff2').toString('base64');
    css = css.replace(new RegExp(fontUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `data:font/woff2;base64,${f}`);
  }
  css = css.replace(/\/\*# sourceMappingURL=[^*]*\*\//g, '').replace(/@font-face\s*\{[^}]*__nextjs-Geist[^}]*\}/g, '');
  const fontClass = sections[0].fontClass;
  const html = `<meta charset="utf-8"><title>Velocity Preview</title>
<style>${css}
.pv-tabs{position:sticky;top:0;z-index:50;display:flex;gap:6px;padding:10px 16px;background:#101114;color:#fff;font:600 13px/1 Inter,system-ui,sans-serif}
.pv-tabs button{border:0;border-radius:999px;padding:8px 14px;background:transparent;color:#cfd3da;cursor:pointer;font:inherit}
.pv-tabs button.on{background:#2459FE;color:#fff}
.pv-tabs .pv-note{margin-left:auto;color:#9aa1ad;font-weight:400;align-self:center}
.pv-page{display:none}.pv-page.on{display:block}
.pv-page .coach{top:96px}
.pv-page .topbar{top:48px}
.pv-page .acts-sticky{top:104px}
.pv-page .acts-tbl thead th{top:calc(104px + var(--acts-top, 0px))}
.pv-page .drawer{top:116px}
.pv-page .nav{top:104px}
.pv-root{font-family:var(--font-inter),system-ui,sans-serif;color:#101114}
.pv-root .shell{background:var(--bg)}
</style>
<div class="pv-root ${fontClass}">
<div class="pv-tabs" role="tablist">${sections.map((s, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-pv="${s.id}">${s.label}</button>`).join('')}<span class="pv-note">Review mirror of the real app · leave comments on anything</span></div>
${sections.map((s, i) => `<div class="pv-page${i === 0 ? ' on' : ''}" id="pv-${s.id}">${s.html}</div>`).join('\n')}
</div>
<script>
document.querySelectorAll('[data-pv]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-pv]').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.pv-page').forEach(p=>p.classList.toggle('on',p.id==='pv-'+b.dataset.pv));window.scrollTo(0,0);}));
document.querySelectorAll('.pv-page a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const m=(a.getAttribute('href')||'').replace('/','');const b=document.querySelector('[data-pv="'+m+'"]');if(b)b.click();}));
const wgs=()=>document.querySelectorAll('.wg-scroll').forEach(b=>{b.scrollTop=12});wgs();document.querySelectorAll('[data-pv]').forEach(b=>b.addEventListener('click',()=>setTimeout(wgs,0)));
</script>`;
  fs.writeFileSync(out, html);
  console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
})();
