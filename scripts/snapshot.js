// Builds a single-file "review mirror" of the running app for comment-based design review.
// Usage: node scripts/snapshot.js http://localhost:3111 out.html
const { chromium } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:3111';
const out = process.argv[3] || 'preview.html';
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'plan', label: 'Plan', path: '/plan' },
  { id: 'activities', label: 'Activities', path: '/activities', after: async (p) => { const r = await p.$$('tr.row'); if (r[2]) await r[2].click(); await p.waitForTimeout(300); } },
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
  const html = `<title>Velocity Preview</title>
<style>${css}
.pv-tabs{position:sticky;top:0;z-index:50;display:flex;gap:6px;padding:10px 16px;background:#101114;color:#fff;font:600 13px/1 Inter,system-ui,sans-serif}
.pv-tabs button{border:0;border-radius:999px;padding:8px 14px;background:transparent;color:#cfd3da;cursor:pointer;font:inherit}
.pv-tabs button.on{background:#2459FE;color:#fff}
.pv-tabs .pv-note{margin-left:auto;color:#9aa1ad;font-weight:400;align-self:center}
.pv-page{display:none}.pv-page.on{display:block}
.pv-page .coach{top:96px}
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
</script>`;
  fs.writeFileSync(out, html);
  console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
})();
