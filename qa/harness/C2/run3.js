require('./bundle.cjs'); const V = globalThis.V;
const mk = (sport, min, intensity) => ({ id: 'x', date: '2026-10-07', dayIndex: 2, min, sport, title: sport, detail: '', text: '', intensity, why: '', status: 'planned' });
const pr = { weight_kg: 74.8, height_cm: 177.8, birth_year: 1994, sex: 'male', goal: 'race_weight', goal_weight_kg: 71.5, base_kcal: null, weight_stages: [{ date: '2026-12-09', weight_kg: 73.5, label: 'W14' }, { date: '2027-03-10', weight_kg: 72.3, label: 'W27' }], bottle_ml: 750, supplements: [], setup_done: true };
console.log('BMR PR', V.bmrOf(pr));
for (const [label, ss] of [['rest', []], ['light 45 Z2 run', [mk('run', 45, 'Zone 2')]], ['today swim 55 aerobic', [mk('swim', 55, 'Aerobic')]], ['moderate 2h bike', [mk('bike', 120, 'Aerobic')]], ['long 4h bike', [mk('bike', 240, 'Endurance')]], ['5h race-day', [mk('bike', 360, 'Race')]]]) {
  const t = V.targetsFor(pr, ss, '2027-04-24');
  console.log(label.padEnd(24), JSON.stringify(t), 'macro kcal', t.carbs*4 + t.protein*4 + t.fat*9);
}
console.log('\n--- session fuel (74.8 kg) ---');
for (const s of [mk('swim', 55, 'Aerobic'), mk('bike', 70, 'Tempo'), mk('swim', 65, 'Aerobic'), mk('bike', 120, 'Zone 2'), mk('run', 50, 'Zone 2'), mk('bike', 59, 'Zone 2'), mk('bike', 60, 'Zone 2'), mk('bike', 150, 'Zone 2'), mk('bike', 151, 'Zone 2'), mk('bike', 240, 'Zone 2'), mk('bike', 241, 'Zone 2'), mk('run', 30, 'Intervals')]) console.log(s.sport, s.min, s.intensity, JSON.stringify(V.sessionFuel(s, 74.8)));
console.log('\n--- small female, lose goal ---');
const f = { weight_kg: 52, height_cm: 160, birth_year: 1996, sex: 'female', goal: 'lose', goal_weight_kg: null, base_kcal: null, weight_stages: [], bottle_ml: 500, supplements: [], setup_done: true };
console.log('BMR', V.bmrOf(f));
for (const [label, ss] of [['rest', []], ['light 45', [mk('run', 45, 'Zone 2')]], ['moderate 2h bike', [mk('bike', 120, 'Aerobic')]]]) { const t = V.targetsFor(f, ss); const ffm = 52 * 0.78; console.log(label.padEnd(18), 'kcal', t.kcal, 'training', t.training, 'carbs', t.carbs, 'protein', t.protein, 'fat', t.fat, 'macro kcal', t.carbs*4+t.protein*4+t.fat*9, 'EA kcal/kgFFM', ((t.kcal - t.training) / ffm).toFixed(1)); }
console.log('\n--- MET kcal/h for 74.8 kg: run easy', 9.5*74.8, 'run hard', 11.5*74.8, 'bike easy', 7*74.8, 'bike hard', 9.5*74.8, 'swim easy', 7.5*74.8, 'swim hard', 9.5*74.8, 'strength', 4.5*74.8);
console.log('Ainsworth bike 16-19 mph MET 12 →', 12*74.8, 'kcal/h; 14-15.9 mph MET 10 →', 10*74.8);
console.log('\n--- projectWeight ---', JSON.stringify(V.projectWeight([-300, -300, -300])));
