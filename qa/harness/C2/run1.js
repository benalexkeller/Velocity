require('./bundle.cjs'); const V = globalThis.V;
const an = V.createAnalysis(V.ACTIVITIES, V.WEEKS, { phases: V.PHASES, body: V.BODY_SEED, athlete: V.DEFAULT_ATHLETE });
console.log('=== Session loads (activityLoad) ===');
for (const a of V.ACTIVITIES) {
  const ifac = a.hr ? Math.min(1.2, (a.hr/155)**2) : a.exertion ? a.exertion/8 : 0.75;
  console.log(a.date, a.sport.padEnd(5), String(a.min).padStart(4), 'hr', a.hr ?? '—', 'IF', ifac.toFixed(3), 'load', V.activityLoad(a), 'zone', V.zoneOf(a));
}
console.log('\n=== Planned loads week 5 ===');
for (const s of V.WEEKS[4].sessions) console.log(s.date, s.sport.padEnd(6), String(s.min).padStart(4), s.intensity.padEnd(10), 'plannedLoad', V.plannedLoad(s), '|', s.text);
console.log('\n=== Planned loads week 3 ===');
for (const s of V.WEEKS[2].sessions) console.log(s.date, s.sport.padEnd(6), String(s.min).padStart(4), s.intensity.padEnd(10), 'plannedLoad', V.plannedLoad(s), '|', s.text);
console.log('\n=== LOAD_SERIES tail ===');
const LS = an.LOAD_SERIES; console.log('len', LS.length, 'first', LS[0].date, 'last', LS[LS.length-1].date);
for (const p of LS) console.log(p.date, 'load', String(p.load).padStart(3), 'fit', p.fitness.toFixed(2), 'fat', p.fatigue.toFixed(2), 'form', p.form.toFixed(2));
console.log('\n=== loadNow ===', JSON.stringify(an.loadNow()));
console.log('\n=== kpis ===');
const k = an.kpis(); console.log(JSON.stringify({load:k.load.v, loadD:k.load.d, fit:k.fitness.v, fitD:k.fitness.d, fat:k.fatigue.v, fatD:k.fatigue.d, form:k.form.v, formD:k.form.dAbs, vol:k.volume.v, volD:k.volume.d, cons:k.consistency.v, consD:k.consistency.dAbs}));
console.log('loadBars', k.load.bars.join(','));
console.log('consBars', k.consistency.bars.join(','));
console.log('\n=== compliance ===');
console.log('rolling28', JSON.stringify(an.rollingCompliance(28)));
console.log('byPhase', JSON.stringify(an.complianceByPhase()));
const cur = an.currentWeek(); console.log('currentWeek', cur.week, cur.start);
for (const w of V.WEEKS.slice(0,5)) { const c = an.complianceFor(w.sessions); console.log('week', w.week, JSON.stringify(c), 'status', w.sessions.map(s=>s.sport[0]+':'+s.status[0]).join(' ')); }
console.log('\n=== zone distribution 84d ===', JSON.stringify(an.zoneDistribution(84)));
console.log('=== zone distribution 400d ===', JSON.stringify(an.zoneDistribution(400)));
console.log('\n=== race projection ===', JSON.stringify(an.raceProjection()));
console.log('weightedAvg run', an.weightedAvgPace('run'), 'bike', an.weightedAvgPace('bike'), 'swim', an.weightedAvgPace('swim'));
console.log('readiness', JSON.stringify(an.raceReadiness()));
console.log('\n=== scores ===');
console.log('race', JSON.stringify(an.raceScore()));
console.log('health', JSON.stringify(an.healthScore()));
for (const o of [28,21,14,7,0]) console.log('hist off', o, 'race', an.raceScore(o).score, 'health', an.healthScore(o).score, JSON.stringify(an.healthScore(o).parts), JSON.stringify(an.bodySummary(7,o)));
console.log('\n=== trainingQuality ===');
for (const r of an.trainingQuality(6)) console.log(r.a.date, r.a.sport, r.a.min, 'planned', r.planned ? r.planned.sport+' '+r.planned.min+' '+r.planned.intensity : null, 'exec', r.execution, r.level, '|', r.insight);
console.log('\n=== sportPerformance ===');
for (const sp of ['swim','bike','run']) { const p = an.sportPerformance(sp); console.log(sp, p.sessions, JSON.stringify(p.rows.map(r=>({k:r.k,cur:r.cur,prev:r.prev, d: r.cur!=null&&r.prev? ((r.cur-r.prev)/r.prev*100).toFixed(1):null})))); console.log('  trend', JSON.stringify(p.trend)); }
console.log('\n=== progressSeries run pace ===', JSON.stringify(an.progressSeries('run','pace',84)));
console.log('\n=== observations ===', JSON.stringify(an.observations()));
console.log('\n=== totals ===', JSON.stringify(an.totals(), (k,v)=> k==='route'?undefined:v));
console.log('\n=== analyzeActivity each ===');
for (const a of V.ACTIVITIES) { const r = an.analyzeActivity(a); console.log(a.date, a.sport, 'planned', r.planned? r.planned.sport+' '+r.planned.intensity+' '+r.planned.min : null, 'rest', r.restDay, 'zone', r.zone, 'range', r.range, 'pace', r.pace, 'verdict', r.verdict, 'ef', r.ef?.toFixed(4), 'efAvg', r.efAvg?.toFixed(4), 'n', r.efN); }
console.log('\n=== corridor ===');
const c = V.corridorFor('2026-09-07','2027-04-24');
for (const sp of ['run','swim','bike']) console.log(sp, 'now', JSON.stringify(c(sp, new Date(2026,9,7))), 'race', JSON.stringify(c(sp, new Date(2027,3,24))));
