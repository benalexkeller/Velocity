// Screenshots for the public product pages (/public/product/*.webp) and the front page crops (/public/landing/*-crop.webp).
// Needs the app on :3111 in local mode (seed data) with the mock coach: node scripts/mock-coach.js, then
//   OPENROUTER_API_KEY=x OPENROUTER_BASE_URL=http://localhost:3999/v1 npx next start -p 3111
// Run: node scripts/product-shots.js
const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const base = "http://localhost:3111";
const OUT = "public/product", LP = "public/landing";
fs.mkdirSync(OUT, { recursive: true });

const nutritionSeed = () => {
  const d = new Date(); const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const t = ymd(d); const y = ymd(new Date(d.getTime() - 86400000));
  const e = (id, date, meal, name, unit, kcal, c, pr, f, fi, na, source = "manual") => ({ id, date, meal, name, unit, kcal, carbs_g: c, protein_g: pr, fat_g: f, fibre_g: fi, sodium_mg: na, source });
  localStorage.setItem("velocity.nutrition.v1", JSON.stringify({
    profile: { weight_kg: 74.8, height_cm: 178, birth_year: 1994, sex: "male", goal: "race_weight", goal_weight_kg: 71.5, weight_stages: [{ date: ymd(new Date(d.getTime() + 63 * 86400000)), weight_kg: 73.5, label: "Base 3" }, { date: ymd(new Date(d.getTime() + 154 * 86400000)), weight_kg: 72.3, label: "Build 2" }], base_kcal: null, bottle_ml: 750, supplements: [{ id: "caffeine", dose: "200 mg", time: "pre-session" }, { id: "creatine", dose: "5 g", time: "morning" }], setup_done: true },
    log: [e("a1", t, "breakfast", "Oats with banana and honey", "1 serving", 500, 89, 16, 9, 10, 95), e("a2", t, "lunch", "Chicken, rice and broccoli", "1 serving", 550, 65, 55, 6, 4, 162), e("a3", t, "snack", "Greek yogurt with berries and granola", "1 serving", 406, 51, 26, 12, 8, 80), e("b1", y, "breakfast", "Scrambled eggs on toast", "1 serving", 448, 36, 30, 19, 7, 440), e("b2", y, "lunch", "Tuna pasta salad", "1 serving", 560, 78, 38, 12, 6, 330), e("b3", y, "dinner", "Salmon with potatoes and green beans", "1 serving", 605, 58, 39, 24, 8, 110)],
    foods: [], drinks: [{ id: "d1", date: t, ml: 750, at: "07:40" }, { id: "d2", date: t, ml: 750, at: "12:10" }, { id: "d3", date: y, ml: 2250, at: "20:00" }], weights: [{ date: y, weight_kg: 74.8 }, { date: t, weight_kg: 74.6 }], taken: [{ date: t, supplement_id: "caffeine", taken_at: "08:00" }],
  }));
};
// The "perfect account": every planned session up to yesterday done, as Garmin activities with realistic figures,
// so the dashboard, the weekly-hours chart and the analysis show a full, consistent history.
const plan = JSON.parse(fs.readFileSync("src/lib/data/seed/plan.json", "utf8"));
const perfectAccount = (planWeeks) => {
  const d = new Date(); const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const todayS = ymd(d);
  const sportOf = (t) => { const x = t.toLowerCase(); const sw = /swim/.test(x), bk = /bike|ride/.test(x), rn = /\brun/.test(x); if (bk && rn) return "brick"; if (sw) return "swim"; if (bk) return "bike"; if (rn) return "run"; if (/strength|core/.test(x)) return "strength"; return "other"; };
  const minOf = (t) => { const m = t.match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : null; };
  const hard = (t) => /tempo|threshold|interval|race|pickup|strides|hard/i.test(t);
  let seed = 1; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const jitter = (v, pct) => Math.round(v * (1 + (rnd() * 2 - 1) * pct));
  const mk = (id, date, start, sport, min, text) => {
    const h = hard(text); const a = { id, date, start, sport, min, source: "garmin" };
    if (sport === "run") { a.name = start < "12:00" ? "Morning Run" : "Evening Run"; a.pace_s = jitter(h ? 560 : 640, 0.04); a.mi = +((min * 60) / a.pace_s).toFixed(2); a.hr = jitter(h ? 158 : 140, 0.03); a.elev_ft = jitter(min * 2.2, 0.3); }
    else if (sport === "bike") { a.name = start < "12:00" ? "Morning Ride" : "Evening Ride"; a.mph = +(jitter(h ? 180 : 165, 0.04) / 10).toFixed(1); a.mi = +((min / 60) * a.mph).toFixed(1); a.hr = jitter(h ? 150 : 132, 0.03); a.elev_ft = jitter(min * 6, 0.3); }
    else if (sport === "swim") { a.name = "Morning Swim"; a.p100_s = jitter(h ? 118 : 127, 0.03); a.yd = Math.round(((min * 60) / a.p100_s) * 100 / 50) * 50; a.hr = jitter(135, 0.03); }
    else { a.name = sport === "strength" ? "Strength" : "Workout"; a.hr = jitter(118, 0.04); }
    return a;
  };
  const out = [];
  for (const w of planWeeks) {
    const s0 = new Date(w.start + "T00:00:00");
    w.days.forEach((day, i) => {
      const dt = new Date(s0); dt.setDate(s0.getDate() + i); const date = ymd(dt);
      if (date >= todayS || !day.min || /^rest/i.test(day.text) || /^race day/i.test(day.text)) return;
      const text = day.text; const pm = text.match(/\bPM:\s*/i);
      const amStart = i >= 5 ? "08:00" : "06:30";
      if (pm) {
        const amT = text.slice(0, pm.index).replace(/^AM:\s*/i, ""), pmT = text.slice(pm.index + pm[0].length);
        const amMin = minOf(amT) ?? Math.round(day.min * 0.7), pmMin = Math.max(5, minOf(pmT) ?? day.min - amMin);
        const amS = sportOf(amT), pmS = sportOf(pmT);
        out.push(mk(`pa-${date}-a`, date, amStart, amS === "brick" ? "bike" : amS, jitter(amMin, 0.05), amT));
        out.push(mk(`pa-${date}-p`, date, "18:00", pmS === "brick" ? "run" : pmS, jitter(pmMin, 0.05), pmT));
        return;
      }
      const sp = sportOf(text);
      if (sp === "brick") {
        const m = text.match(/\+\s*run\s*(\d+):(\d+)/i); const runMin = m ? +m[1] * 60 + +m[2] : Math.round(day.min * 0.2); const bikeMin = day.min - runMin;
        out.push(mk(`pa-${date}-b`, date, amStart, "bike", jitter(bikeMin, 0.04), text));
        const h = +amStart.slice(0, 2) * 60 + +amStart.slice(3) + bikeMin; out.push(mk(`pa-${date}-r`, date, `${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`, "run", jitter(runMin, 0.05), "run off the bike"));
        return;
      }
      // "Swim 0:40 + Strength 0:20": one swim activity of the swim's minutes
      const own = minOf(text) ?? day.min;
      out.push(mk(`pa-${date}`, date, amStart, sp === "other" ? "strength" : sp, jitter(Math.min(own, day.min), 0.05), text));
    });
  }
  return out;
};
const seedPerfect = async (p) => {
  const acts = perfectAccount(plan);
  await p.evaluate((acts) => {
    const k = "velocity.store.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}");
    s.manual = acts; s.hidden = []; s.thread = []; localStorage.setItem(k, JSON.stringify(s));
  }, acts);
  console.log("seeded", acts.length, "activities");
};
const ask = async (p, q) => {
  await p.fill("#coach-input", q); await p.press("#coach-input", "Enter");
  await p.waitForFunction(() => !document.querySelector(".msg.thinking") && !document.querySelector("#coach-input:disabled"), null, { timeout: 20000 });
  await p.waitForTimeout(400);
};
const save = async (buf, file, w) => { await sharp(buf).resize(w ? { width: w } : undefined).webp({ quality: 74 }).toFile(file); console.log("wrote", file); };
const page = async (p, file) => save(await p.screenshot({ type: "png" }), file);
const clip = async (p, sel, file, pad = 0) => { const el = await p.$(sel); const b = await el.boundingBox(); return save(await p.screenshot({ type: "png", clip: { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad } }), file); };
// the rail, cropped to its content: from the top of the rail to just under the last message
const rail = async (p, file) => { const el = await p.$("aside.coach"); const b = await el.boundingBox(); const msgs = await p.$$("aside.coach .msg"); const last = await msgs[msgs.length - 1].boundingBox(); const h = Math.min(b.height, last.y + last.height + 16 - b.y); return save(await p.screenshot({ type: "png", clip: { x: b.x, y: b.y, width: b.width, height: h } }), file); };
// local mode keeps the thread in localStorage; start each coach shot from an empty thread
const clearThread = async (p) => { await p.evaluate(() => { const k = "velocity.store.v1"; const s = JSON.parse(localStorage.getItem(k) || "{}"); s.thread = []; localStorage.setItem(k, JSON.stringify(s)); }); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const go = async (path) => { await p.goto(base + path, { waitUntil: "networkidle" }); await p.waitForTimeout(500); await p.addStyleTag({ content: ".topbar .greet{visibility:hidden}" }); };

  await go("/dashboard"); await seedPerfect(p); await go("/dashboard"); await page(p, `${OUT}/dashboard.webp`);
  // front page crop: content without the side nav
  await save(await p.screenshot({ type: "png", clip: { x: 130, y: 0, width: 1310, height: 790 } }), `${LP}/dashboard-crop.webp`);

  await go("/plan"); await page(p, `${OUT}/plan-week.webp`);
  const ev = await p.$$(".wg-ev"); await ev[2].click(); await p.waitForTimeout(500); await p.$eval(".session-panel", (e) => e.scrollIntoView({ block: "start" })); await p.evaluate(() => window.scrollBy(0, -90)); await p.waitForTimeout(300);
  await clip(p, ".session-panel", `${OUT}/session.webp`);
  await go("/plan"); await p.click("button:has-text('Month')"); await p.waitForTimeout(500); await page(p, `${OUT}/plan-month.webp`);

  await go("/activities"); const rows = await p.$$("tr.row"); if (rows[1]) { await rows[1].click(); await p.waitForTimeout(400); } await page(p, `${OUT}/activities.webp`);

  await go("/analysis"); await page(p, `${OUT}/analysis.webp`);
  await save(await p.screenshot({ type: "png", clip: { x: 130, y: 60, width: 1280, height: 605 } }), `${LP}/analysis-crop.webp`);

  await go("/nutrition"); await p.evaluate(nutritionSeed); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(600); await p.addStyleTag({ content: ".topbar .greet{visibility:hidden}" });
  await page(p, `${OUT}/nutrition.webp`);
  await clip(p, ".nu-carbgoal", `${OUT}/nutrition-timing.webp`, 2);
  await clip(p, ".nu-carbgoal", `${LP}/nutrition-fuel.webp`, 2);
  await p.click("button:has-text('Log meal')"); await p.waitForTimeout(500); await page(p, `${OUT}/nutrition-meals.webp`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.click(".tabs button:has-text('Guide')"); await p.waitForTimeout(500); await page(p, `${OUT}/nutrition-guide.webp`);

  // coach: the rail on the plan page, mock answers
  const fresh = async () => { await go("/plan"); await clearThread(p); await go("/plan"); };
  await fresh(); await ask(p, "My calves cramped near the end of the long run."); await rail(p, `${OUT}/coach-sources.webp`);
  await fresh(); await ask(p, "How was last week against the plan?"); await rail(p, `${OUT}/coach-review.webp`); await page(p, `${OUT}/coach-page.webp`);
  await fresh(); await ask(p, "Move tomorrow's session to after work."); await rail(p, `${OUT}/coach-proposal.webp`);
  await p.click(".proposal button:has-text('Accept')"); await p.waitForTimeout(600); await page(p, `${OUT}/coach-accepted.webp`);
  await fresh(); await ask(p, "I missed two weeks with a cold. What now?"); await rail(p, `${OUT}/coach-pitch.webp`);
  await clearThread(p);
  await b.close();
})();
