// Pass 1: full-page screenshots of every page and state at 1440 and 390 px + computed-style measurements.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const base = 'http://localhost:3111';
const outDir = '/home/claude/qa/phone';
fs.mkdirSync(outDir, { recursive: true });

const seedNutrition = async (p) => {
  await p.evaluate(() => {
    const d = new Date(); const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const t = ymd(d); const y = ymd(new Date(d.getTime() - 86400000));
    const e = (id, date, meal, name, unit, kcal, c, pr, f, fi, na, source = 'builtin') => ({ id, date, meal, name, unit, kcal, carbs_g: c, protein_g: pr, fat_g: f, fibre_g: fi, sodium_mg: na, source });
    localStorage.setItem('velocity.nutrition.v1', JSON.stringify({
      profile: { weight_kg: 74.8, height_cm: 178, birth_year: 1994, sex: 'male', goal: 'race_weight', goal_weight_kg: 71.5, weight_stages: [{ date: ymd(new Date(d.getTime() + 63 * 86400000)), weight_kg: 73.5, label: 'Base 3' }, { date: ymd(new Date(d.getTime() + 154 * 86400000)), weight_kg: 72.3, label: 'Build 2' }], base_kcal: null, bottle_ml: 750, supplements: [{ id: 'caffeine', dose: '200 mg', time: 'pre-session' }, { id: 'vitamin-d', dose: '2,000 IU', time: 'morning' }, { id: 'creatine', dose: '5 g', time: 'morning' }], setup_done: true },
      log: [e('a1', t, 'breakfast', 'Oats, rolled, dry', '2 × ½ cup', 303, 54, 11, 5, 8, 5), e('a2', t, 'breakfast', 'Banana, raw', '1 × 1 medium', 105, 27, 1, 0, 3, 1), e('a3', t, 'breakfast', 'Greek yogurt, plain, 2%', '1 × 1 cup', 146, 8, 20, 4, 0, 68), e('a4', t, 'lunch', 'Chicken breast, cooked', '1 × 1 breast', 248, 0, 47, 5, 0, 111), e('a5', t, 'lunch', 'Brown rice, cooked', '1 × 1 cup', 240, 50, 5, 2, 3, 8), e('a6', t, 'lunch', 'Mixed salad greens', '1 × 2 cups', 14, 3, 1, 0, 2, 24), e('a7', t, 'snack', 'Energy bar, oat', '1 × 1 bar', 230, 42, 6, 5, 3, 150), e('b1', y, 'breakfast', 'Estimate', undefined, 500, 0, 0, 0, 0, 0, 'quick'), e('b2', y, 'lunch', 'Estimate', undefined, 800, 0, 0, 0, 0, 0, 'quick'), e('b3', y, 'dinner', 'Estimate', undefined, 900, 0, 0, 0, 0, 0, 'quick')],
      foods: [], drinks: [{ id: 'd1', date: t, ml: 750, at: '07:40' }, { id: 'd2', date: t, ml: 750, at: '12:10' }, { id: 'd3', date: y, ml: 2250, at: '20:00' }], weights: [{ date: y, weight_kg: 74.8 }, { date: t, weight_kg: 74.6 }], taken: [{ date: t, supplement_id: 'caffeine', taken_at: '08:00' }, { date: t, supplement_id: 'vitamin-d', taken_at: '08:00' }],
    }));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
};
const click = async (p, sel, ms = 350) => { const el = await p.$(sel); if (!el) { console.log('  MISSING selector', sel); return false; } await el.click(); await p.waitForTimeout(ms); return true; };

const STATES = [
  { id: 'dashboard', path: '/dashboard' },
  { id: 'dashboard-log-open', path: '/dashboard', after: async (p) => { await click(p, 'button.plus'); } },
  { id: 'dashboard-coach-reply', path: '/dashboard', after: async (p) => { await p.fill('input[placeholder="Ask your coach anything…"]', 'What is on this week?'); await p.keyboard.press('Enter'); await p.waitForTimeout(800); } },
  { id: 'plan-week', path: '/plan' },
  { id: 'plan-session-open', path: '/plan', after: async (p) => { const ev = await p.$$('.wg-ev'); if (ev[2]) await ev[2].click(); await p.waitForTimeout(500); } },
  { id: 'plan-session-move', path: '/plan', after: async (p) => { const ev = await p.$$('.wg-ev'); if (ev[2]) await ev[2].click(); await p.waitForTimeout(400); await click(p, 'button:has-text("Move")'); } },
  { id: 'plan-session-edit', path: '/plan', after: async (p) => { const ev = await p.$$('.wg-ev'); if (ev[2]) await ev[2].click(); await p.waitForTimeout(400); await click(p, 'button:has-text("Edit")'); } },
  { id: 'plan-session-log', path: '/plan', after: async (p) => { const ev = await p.$$('.wg-ev'); if (ev[2]) await ev[2].click(); await p.waitForTimeout(400); await click(p, 'button:has-text("Log")'); } },
  { id: 'plan-add-workout', path: '/plan', after: async (p) => { await click(p, 'button.btn:has-text("Add workout")'); } },
  { id: 'plan-month', path: '/plan', after: async (p) => { await click(p, 'button:has-text("Month")', 500); } },
  { id: 'plan-week-overview', path: '/plan', after: async (p) => { const bars = await p.$$('svg.ramp g > rect[fill="transparent"]'); if (bars[11]) await bars[11].click(); await p.waitForTimeout(500); } },
  { id: 'plan-next-week', path: '/plan', after: async (p) => { const b = await p.$$('button.back'); if (b[1]) await b[1].click(); await p.waitForTimeout(500); } },
  { id: 'activities', path: '/activities' },
  { id: 'activities-detail', path: '/activities', after: async (p) => { const r = await p.$$('tr.row'); if (r[2]) await r[2].click(); await p.waitForTimeout(400); } },
  { id: 'activities-filters', path: '/activities', after: async (p) => { await click(p, 'button.iconbtn'); } },
  { id: 'activities-map-full', path: '/activities', after: async (p) => { const r = await p.$$('tr.row'); if (r[2]) await r[2].click(); await p.waitForTimeout(400); await click(p, 'button.exp', 800); } },
  { id: 'activities-search-none', path: '/activities', after: async (p) => { await p.fill('input[placeholder="Search activities…"]', 'zzzz'); await p.waitForTimeout(300); } },
  { id: 'analysis', path: '/analysis' },
  { id: 'analysis-4wk', path: '/analysis', after: async (p) => { await click(p, 'button:has-text("Last 4 weeks")', 500); } },
  { id: 'analysis-activity', path: '/analysis', after: async (p) => { await click(p, '.an-pick .plus', 300); const opts = await p.$$eval('.an-select option', os => os.map(o => o.value)); if (opts[3]) await p.selectOption('.an-select', opts[3]); await p.waitForTimeout(500); } },
  { id: 'analysis-tooltip', path: '/analysis', after: async (p) => { const b = await p.$$('button.info-btn'); if (b[0]) await b[0].hover(); await p.waitForTimeout(400); } },
  { id: 'nutrition-setup', path: '/nutrition' },
  { id: 'nutrition-day', path: '/nutrition', after: seedNutrition },
  { id: 'nutrition-week', path: '/nutrition', after: async (p) => { await click(p, 'button:has-text("Week")', 500); } },
  { id: 'nutrition-log-search', path: '/nutrition', after: async (p) => { await click(p, '.nu-timeline .btn:has-text("Log meal")'); await p.fill('.nu-add input[type=text], .nu-add input[type=search]', 'oats').catch(() => {}); await p.waitForTimeout(400); } },
  { id: 'nutrition-log-typed', path: '/nutrition', after: async (p) => { await click(p, '.nu-timeline .btn:has-text("Log meal")'); await click(p, 'button:has-text("Type it in")'); } },
  { id: 'nutrition-log-wholeday', path: '/nutrition', after: async (p) => { await click(p, '.nu-timeline .btn:has-text("Log meal")'); await click(p, 'button:has-text("Whole day")'); } },
  { id: 'nutrition-log-datepicker', path: '/nutrition', after: async (p) => { await click(p, '.nu-timeline .btn:has-text("Log meal")'); await click(p, '.nu-date .pick'); } },
  { id: 'nutrition-guide', path: '/nutrition', after: async (p) => { await click(p, '.tabs button:has-text("Guide")', 600); } },
  { id: 'nutrition-guide-edit', path: '/nutrition', after: async (p) => { await click(p, '.tabs button:has-text("Guide")', 400); await click(p, '.nu-plan .btn', 500); } },
  { id: 'nutrition-supplements', path: '/nutrition', after: async (p) => { await click(p, '.tabs button:has-text("Supplements")', 500); const c = await p.$('.nu-supp .card, .supp-card, [class*=supp] button'); if (c) { await c.click(); await p.waitForTimeout(400); } } },
  { id: 'calculator', path: '/calculator' },
  { id: 'calculator-carbs', path: '/calculator', after: async (p) => { await click(p, 'button:has-text("Carbs per hour")', 400); } },
  { id: 'calculator-zones', path: '/calculator', after: async (p) => { await click(p, 'button:has-text("Training zones")', 400); } },
  { id: 'store', path: '/store' },
  { id: 'profile', path: '/profile' },
  { id: 'admin', path: '/admin' },
  { id: 'login', path: '/login' },
  { id: 'setup', path: '/setup' },
  { id: 'feedback', path: '/dashboard', after: async (p) => { await click(p, '.fb-btn'); } },
  { id: 'avatar-menu', path: '/dashboard', after: async (p) => { await click(p, '.topbar button:has-text("P"), header button:has-text("P"), button:text-is("P")'); } },
  { id: 'builder-1-goal', path: '/plan/new' },
  { id: 'builder-1-goal-filled', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); await click(p, '.form .days button:has-text("Target time")'); await p.fill('input[placeholder="13:00"]', '13:00'); await click(p, '.pb-chk input'); } },
  { id: 'builder-2-history', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); await click(p, '.pb-nav .btn:has-text("Next")', 400); } },
  { id: 'builder-3-fitness', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); for (let i = 0; i < 2; i++) await click(p, '.pb-nav .btn:has-text("Next")', 300); } },
  { id: 'builder-4-time', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); for (let i = 0; i < 3; i++) await click(p, '.pb-nav .btn:has-text("Next")', 300); } },
  { id: 'builder-5-devices', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); for (let i = 0; i < 4; i++) await click(p, '.pb-nav .btn:has-text("Next")', 300); } },
  { id: 'builder-upload', path: '/plan/new', after: async (p) => { await click(p, 'button.linkbtn:has-text("Upload your own plan instead")', 500); } },
  { id: 'builder-building', path: '/plan/new', after: async (p) => { await click(p, '.pb-types button:has-text("Full (140.6)")'); await p.fill('.pb-searchin input', 'texas'); await p.waitForTimeout(200); await click(p, '.pb-hits li button >> nth=0'); await p.fill('.pb-card input[type=date]', '2027-04-24'); for (let i = 0; i < 4; i++) await click(p, '.pb-nav .btn:has-text("Next")', 200); await click(p, '.pb-nav .btn:has-text("Build my plan")', 6000); } },
  { id: 'plan-after-build', path: '/plan', wait: 30000 },
  { id: 'dashboard-after-build', path: '/dashboard' },
  { id: 'analysis-after-build', path: '/analysis' },
  { id: 'nutrition-after-build', path: '/nutrition' },
  { id: 'plan-cleared', path: '/plan', after: async (p) => { await p.evaluate(() => { localStorage.clear(); }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500); } },
];

const PROPS = ['fontSize', 'fontWeight', 'lineHeight', 'fontFamily', 'color', 'backgroundColor', 'borderRadius', 'borderColor', 'boxShadow', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'gap', 'letterSpacing'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const measures = {}; for (const k of PROPS) measures[k] = {};
  const errors = [];
  const log = [];
  for (const width of [390]) {
    const ctx = await b.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push({ width, page: p.url(), msg: e.message.slice(0, 300) }));
    p.on('console', m => { if (m.type() === 'error') errors.push({ width, page: p.url(), type: 'console', msg: m.text().slice(0, 300) }); });
    for (const st of STATES) {
      try {
        await p.goto(base + st.path, { waitUntil: 'networkidle' });
        await p.waitForTimeout(st.wait || 500);
        if (st.after) await st.after(p);
        const file = path.join(outDir, `${st.id}-${width}.png`);
        if (process.env.SHOTS) await p.screenshot({ path: file, fullPage: true });
        const dims = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight }));
        let overflow = '';
        if (dims.sw > dims.cw + 1) {
          const culprits = await p.evaluate((cw) => { const out = []; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.width && r.right > cw + 1) { const par = e.parentElement && e.parentElement.getBoundingClientRect(); if (!par || par.right <= cw + 1) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0,3).join('.')} r=${Math.round(r.right)} w=${Math.round(r.width)}`); } } return out.slice(0, 5); }, dims.cw);
          overflow = ` OVERFLOW ${dims.sw}>${dims.cw} :: ${culprits.join(' | ')}`;
        }
        log.push(`${st.id}-${width}: ${dims.sh}px tall${overflow}`);
        if (false) {
          const m = await p.evaluate((PROPS) => {
            const out = {}; for (const k of PROPS) out[k] = {};
            const els = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !['SCRIPT', 'STYLE', 'SVG', 'PATH', 'G', 'RECT', 'LINE', 'CIRCLE', 'TEXT', 'POLYLINE', 'DEFS'].includes(e.tagName); });
            for (const e of els) {
              const cs = getComputedStyle(e);
              const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
              for (const k of PROPS) {
                let v = cs[k];
                if (k.startsWith('font') || k === 'color' || k === 'lineHeight' || k === 'letterSpacing') { if (!hasText) continue; }
                if (k === 'backgroundColor' && (v === 'rgba(0, 0, 0, 0)' || v === 'transparent')) continue;
                if (k === 'borderRadius' && v === '0px') continue;
                if (k === 'boxShadow' && v === 'none') continue;
                if (k === 'borderColor' && cs.borderStyle === 'none') continue;
                if (k === 'gap' && v === 'normal') continue;
                if ((k.startsWith('padding') || k.startsWith('margin')) && v === '0px') continue;
                if (k === 'fontFamily') v = v.split(',')[0].replace(/"/g, '');
                out[k][v] = (out[k][v] || 0) + 1;
              }
            }
            return out;
          }, PROPS);
          for (const k of PROPS) for (const [v, n] of Object.entries(m[k])) measures[k][v] = (measures[k][v] || 0) + n;
        }
      } catch (e) { log.push(`${st.id}-${width}: ERROR ${e.message.slice(0, 200)}`); }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(outDir, '_log.txt'), log.join('\n'));
  fs.writeFileSync(path.join(outDir, '_errors.json'), JSON.stringify(errors, null, 1));
  // measurements markdown
  const sortN = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  let md = '# Velocity — computed-style measurements (desktop, all states, visible elements)\n\nCounts are element occurrences across all captured states. Text properties are counted only on elements that directly contain text.\n';
  for (const k of PROPS) { md += `\n## ${k} (${Object.keys(measures[k]).length} distinct)\n\n`; for (const [v, n] of sortN(measures[k])) md += `- ${v}: ${n}\n`; }

  console.log(log.join('\n'));
  console.log(`\n${errors.length} errors; distinct font sizes ${Object.keys(measures.fontSize).length}, colours ${Object.keys(measures.color).length}, bg ${Object.keys(measures.backgroundColor).length}, radii ${Object.keys(measures.borderRadius).length}`);
})();
