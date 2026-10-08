// Supplements for endurance athletes. Grades follow the IOC consensus statement on dietary supplements
// (Maughan et al., Br J Sports Med 2018) and the Australian Institute of Sport classification:
// A = strong evidence of benefit in specific situations, B = some evidence / emerging, C = no or insufficient evidence.
// Facts only. This is information, not medical advice.
export type Grade = "A" | "B" | "C";
export interface Study { ref: string; finding: string }
export interface Supplement {
  id: string; name: string; grade: Grade; category: "performance" | "health" | "fuel";
  what: string; dose: string; when: string; who: string;
  defaultDose: string; defaultTime: string;
  background: string; mechanism: string; benefits: string[]; caveats: string[]; studies: Study[];
}

export const GRADE_LABEL: Record<Grade, string> = { A: "Strong evidence", B: "Some evidence", C: "Limited / no evidence" };

export const SUPPLEMENTS: Supplement[] = [
  {
    id: "caffeine", name: "Caffeine", grade: "A", category: "performance",
    what: "Lowers perceived effort and raises alertness; improves endurance time-trial performance by about 2–4%.",
    dose: "3–6 mg per kg body weight (200–400 mg for 75 kg). Low doses of 1–3 mg/kg also work for many.",
    when: "30–60 min before the session. For long races, top-ups of 1–2 mg/kg every 2–3 hours, or in the final third.",
    who: "Most athletes who tolerate it. Trial in training first; do not use for the first time on race day.",
    defaultDose: "200 mg", defaultTime: "pre-session",
    background: "Caffeine is the most studied performance supplement in sport. It was removed from the WADA prohibited list in 2004 and is now on WADA's monitoring programme only. It works in coffee, tablets, gum and gels; the dose, not the form, is what matters.",
    mechanism: "Caffeine blocks adenosine receptors in the brain, which lowers the sensation of effort and fatigue, and increases the release of adrenaline. The old idea that it works mainly by sparing glycogen through fat burning is not well supported; the central effect on perceived effort is the main driver.",
    benefits: ["Endurance: meta-analyses show a 2–4% improvement in time-trial performance and about 12% longer time to exhaustion at a fixed intensity.", "Works in trained and untrained athletes, in the heat, and after poor sleep.", "Low doses (about 3 mg/kg) give most of the benefit with fewer side effects than 6 mg/kg."],
    caveats: ["Side effects at higher doses: jitters, gut upset, faster heart rate, disturbed sleep — a problem for evening sessions.", "Habitual coffee drinkers still get the effect; withdrawal beforehand is not needed.", "Genetic differences (CYP1A2) change how fast it clears; some people get little benefit or feel worse.", "Combine with carbohydrate in a race, not instead of it."],
    studies: [
      { ref: "Ganio et al., J Strength Cond Res 2009 (systematic review, 21 studies)", finding: "Caffeine improved endurance time-trial performance by an average of 3.2%." },
      { ref: "Southward, Rutherfurd-Markwick & Ali, Sports Med 2018 (meta-analysis, 46 studies)", finding: "Time-trial performance improved 2.2% (mean power +2.9%); effects held across doses of 3–6 mg/kg." },
      { ref: "Maughan et al., IOC consensus statement, Br J Sports Med 2018", finding: "Caffeine listed among the few supplements with strong evidence of performance benefit." },
    ],
  },
  {
    id: "sodium", name: "Sodium (electrolytes)", grade: "A", category: "fuel",
    what: "Replaces the main electrolyte lost in sweat; keeps blood sodium and plasma volume in the normal range during long, hot sessions.",
    dose: "300–1,000 mg per litre of fluid, matched to sweat rate and saltiness. Ironman in heat: often 500–1,500 mg per hour.",
    when: "During sessions over about 90 minutes, and pre-loading (about 1,000 mg in 500 ml) in the hour before a hot race.",
    who: "Anyone training over 90 minutes in the heat, heavy or salty sweaters, and everyone racing Ironman distance.",
    defaultDose: "500 mg / hour", defaultTime: "during",
    background: "Sweat contains roughly 200–2,000 mg of sodium per litre; the average is about 900 mg/L, and the number is highly individual and fairly stable for a given athlete. Drinking only plain water for many hours dilutes blood sodium (hyponatraemia), which is the most dangerous fluid problem in long-course triathlon.",
    mechanism: "Sodium holds water in the blood and extracellular space. Replacing it with fluid maintains plasma volume, supports sweating and cardiac output, and drives thirst so you keep drinking. It also increases fluid absorption from the gut when taken with carbohydrate.",
    benefits: ["Reduces the fall in plasma volume during prolonged exercise, especially in the heat.", "Pre-loading with sodium raises plasma volume before the start and improves endurance in hot conditions in several trials.", "Protects against exercise-associated hyponatraemia when fluid intake is high."],
    caveats: ["It does not prevent cramp on its own; cramp is mostly neuromuscular fatigue.", "Very high intakes with little fluid cause gut distress.", "Athletes with high blood pressure should discuss race-day sodium with their doctor.", "A sweat-rate test (Calculator page) and a sweat-sodium test give the actual numbers."],
    studies: [
      { ref: "Sawka et al., ACSM position stand: Exercise and fluid replacement, Med Sci Sports Exerc 2007", finding: "Sodium in fluids recommended for events over 2 hours to maintain fluid balance and avoid hyponatraemia." },
      { ref: "Sims et al., J Appl Physiol 2007", finding: "Pre-exercise sodium loading increased plasma volume and endurance capacity in the heat." },
      { ref: "Hew-Butler et al., Clin J Sport Med 2015 (consensus statement on exercise-associated hyponatraemia)", finding: "Over-drinking of hypotonic fluid is the primary cause of EAH; fluid intake guided by thirst with sodium replacement lowers the risk." },
    ],
  },
  {
    id: "carbohydrate", name: "Carbohydrate (sports fuel)", grade: "A", category: "fuel",
    what: "The fuel for anything over about an hour. Maintains blood glucose, spares muscle glycogen and delays fatigue.",
    dose: "30–60 g per hour for 1–2.5 h; 60–90 g/h beyond that; up to 120 g/h with a trained gut using glucose + fructose.",
    when: "Start in the first 15–20 minutes of any session over 60–75 minutes; steady every 15–20 minutes.",
    who: "Every endurance athlete training or racing over 60–90 minutes.",
    defaultDose: "60 g / hour", defaultTime: "during",
    background: "Gels, drinks, chews and bars are just carbohydrate in a convenient form. The science on carbohydrate during exercise is the most consistent in sports nutrition: it improves performance in events lasting over an hour, and the optimal amount rises with duration.",
    mechanism: "Glucose absorption is capped at roughly 60 g/h by the intestinal transporter SGLT1. Fructose uses a different transporter (GLUT5), so a glucose:fructose mix of about 2:1 (or 1:0.8) lifts total absorption to 90–120 g/h. The gut adapts to higher intakes over 8–12 weeks of training with them.",
    benefits: ["Consistent performance benefit in events over 60 minutes; the benefit grows with duration.", "Mouth rinsing alone helps in efforts under an hour, through receptors in the mouth.", "Higher intakes (90–120 g/h) in trained guts reduce muscle damage and improve late-race running in Ironman."],
    caveats: ["Gut training is required for intakes above 60 g/h; untrained guts get cramps and diarrhoea.", "Fructose-only products above about 30 g/h cause gut trouble; the mix matters.", "Sugar-free 'electrolyte' drinks are not fuel."],
    studies: [
      { ref: "Jeukendrup, Sports Med 2014 — A step towards personalized sports nutrition: carbohydrate intake during exercise", finding: "Sets the duration-based intake framework: 30–60 g/h up to 2.5 h, up to 90 g/h beyond, using multiple transportable carbohydrates." },
      { ref: "Stellingwerff & Cox, Appl Physiol Nutr Metab 2014 (systematic review, 61 studies)", finding: "Carbohydrate improved performance in 82% of studies of exercise over about 60 minutes." },
      { ref: "Viribay et al., Nutrients 2020", finding: "120 g/h during a mountain marathon lowered muscle damage markers and improved recovery compared with 60 and 90 g/h." },
    ],
  },
  {
    id: "creatine", name: "Creatine monohydrate", grade: "A", category: "performance",
    what: "Increases muscle phosphocreatine; improves high-intensity repeat efforts and strength-training adaptations, and supports lean mass.",
    dose: "3–5 g daily. A loading phase (20 g/day for 5–7 days) is optional; 3–5 g/day gets there in 3–4 weeks.",
    when: "Daily, any time; with a meal is convenient. Consistency matters more than timing.",
    who: "Athletes doing strength work, intervals or hills; useful for masters athletes for muscle maintenance. Endurance-only benefit is small.",
    defaultDose: "5 g", defaultTime: "morning",
    background: "Creatine is the most researched sports supplement after caffeine, with hundreds of trials over 30 years and a strong safety record in healthy adults. For endurance athletes its case is about strength sessions, sprints and the body-composition support that comes with a hard training block, not the steady-state work itself.",
    mechanism: "Creatine phosphate regenerates ATP in the first seconds of maximal effort. Supplementation raises muscle creatine stores by 20–40%, which means more repeat sprints or reps at the same quality, and better training adaptation. It also draws water into the muscle cell.",
    benefits: ["Strength and power gains from resistance training are consistently larger with creatine.", "Improved repeated high-intensity efforts (intervals, surges, hills).", "Evidence for maintaining lean mass and, in older adults, for cognitive support under stress."],
    caveats: ["Expect 0.5–1 kg of water weight in the first weeks — relevant for run economy in the taper, so trial it early in the plan, not before the race.", "Benefit for steady-state endurance performance is small or absent; do not expect a faster Ironman bike split from it.", "Choose plain creatine monohydrate; other forms are not better, only pricier.", "People with kidney disease should talk to a doctor first."],
    studies: [
      { ref: "Kreider et al., ISSN position stand: safety and efficacy of creatine supplementation, J Int Soc Sports Nutr 2017", finding: "Creatine monohydrate is the most effective ergogenic supplement for increasing high-intensity exercise capacity and lean mass; safe in healthy people at recommended doses." },
      { ref: "Lanhers et al., Sports Med 2017 (meta-analysis)", finding: "Creatine improved upper-limb strength performance across studies." },
      { ref: "Forbes et al., Nutrients 2023 (review)", finding: "Evidence for benefits in endurance-relevant contexts is limited to high-intensity components and recovery, not steady endurance." },
    ],
  },
  {
    id: "beta-alanine", name: "Beta-alanine", grade: "B", category: "performance",
    what: "Raises muscle carnosine, a buffer against acid build-up; helps efforts of 1–10 minutes and repeated hard surges.",
    dose: "3.2–6.4 g per day, split into 0.8–1.6 g doses (or slow-release), for at least 4 weeks.",
    when: "Daily for 4–10 weeks before it matters; timing within the day is irrelevant, only the total.",
    who: "Athletes whose events or key sessions include hard 1–10 minute efforts (intervals, hill reps, swim sets). Limited value for steady Ironman pacing.",
    defaultDose: "3.2 g", defaultTime: "morning",
    background: "Beta-alanine combines with histidine to form carnosine inside muscle. Carnosine buffers the hydrogen ions produced during hard efforts, delaying the burn. It is one of the five supplements with an A or B grade in the IOC consensus, but the benefit is specific to high-intensity work.",
    mechanism: "Four to ten weeks of daily supplementation increases muscle carnosine by 40–80%. Higher carnosine means more buffering capacity in the working muscle, which extends the time you can hold an intensity above threshold.",
    benefits: ["Meta-analyses show a small but reliable improvement (about 2–3%) in exercise lasting 30 seconds to 10 minutes.", "Some benefit in the final sprint of longer events and in repeated efforts.", "No effect on body weight."],
    caveats: ["Paraesthesia (tingling skin) at doses above 800 mg at once; harmless, avoided by splitting doses or slow-release tablets.", "No benefit for efforts under 30 seconds or for steady efforts over about 25 minutes.", "Takes weeks to load; taking it on race day does nothing."],
    studies: [
      { ref: "Saunders et al., Br J Sports Med 2017 (meta-analysis, 40 studies)", finding: "Beta-alanine improved exercise capacity and performance, with the largest effect in efforts of 30 s to 10 min." },
      { ref: "Trexler et al., ISSN position stand: beta-alanine, J Int Soc Sports Nutr 2015", finding: "4–6 g/day for at least 2–4 weeks raises muscle carnosine and improves high-intensity performance; tingling is the only known side effect." },
    ],
  },
  {
    id: "nitrate", name: "Nitrate (beetroot juice)", grade: "B", category: "performance",
    what: "Dietary nitrate raises nitric oxide; may lower the oxygen cost of submaximal exercise and improve time-trial performance in some athletes.",
    dose: "6–13 mmol nitrate (about 300–800 mg), typically 1–2 concentrated 70 ml beetroot shots.",
    when: "2–3 hours before the session or race. Several days of daily intake beforehand increases the effect.",
    who: "Recreational and moderately trained athletes see the clearest benefit; highly trained athletes often see little.",
    defaultDose: "1 shot (400 mg)", defaultTime: "pre-session",
    background: "Nitrate from vegetables (beetroot, rocket, spinach) is converted to nitrite by bacteria on the tongue and then to nitric oxide in the body. Concentrated beetroot juice became popular after trials showed reduced oxygen cost of running and cycling at a fixed pace.",
    mechanism: "Nitric oxide widens blood vessels, improves the efficiency of the muscle's use of oxygen and calcium handling, and may enhance blood flow to fast-twitch fibres. The result is a slightly lower oxygen cost for the same speed.",
    benefits: ["Reduced oxygen cost of submaximal exercise (about 3–5%) in many studies.", "Small improvements in time-to-exhaustion and, less consistently, in time-trial performance.", "May help in hypoxia (altitude) and in the heat."],
    caveats: ["Well-trained endurance athletes (high VO2max) frequently show no benefit; individual response varies.", "Antibacterial mouthwash blocks the conversion in the mouth and removes the effect.", "Pink urine and stool are harmless. Gut upset from the volume of juice is possible.", "Not a substitute for carbohydrate or caffeine on race day."],
    studies: [
      { ref: "Jones et al., Annu Rev Nutr 2018 — Dietary nitrate and physical performance (review)", finding: "Nitrate lowers oxygen cost of exercise and can improve performance, with smaller effects in highly trained athletes." },
      { ref: "Senefeld et al., Med Sci Sports Exerc 2020 (meta-analysis, 73 studies)", finding: "Small overall performance benefit, larger in less-trained participants and for time-to-exhaustion tests." },
    ],
  },
  {
    id: "iron", name: "Iron", grade: "B", category: "health",
    what: "Needed for haemoglobin and oxygen transport. Correcting a deficiency restores performance; taking it without a deficiency does nothing and can harm.",
    dose: "Only when blood tests show low ferritin (typically under 30–50 µg/L in athletes). Common protocol: 60–100 mg elemental iron on alternate days, with vitamin C, away from coffee and calcium.",
    when: "Morning, alternate days, on an empty stomach or with orange juice; not within an hour of a hard session.",
    who: "Athletes with a diagnosed deficiency: endurance runners, menstruating women, vegetarians and vegans, and anyone with low ferritin on a test.",
    defaultDose: "as prescribed", defaultTime: "morning",
    background: "Iron deficiency is the most common nutritional deficiency in endurance athletes. Foot-strike haemolysis, sweat and gut losses, and the inflammatory hormone hepcidin (raised for 3–6 hours after hard training, which blocks absorption) all contribute. A blood test for ferritin, haemoglobin and transferrin saturation is the only way to know.",
    mechanism: "Iron sits at the centre of haemoglobin and myoglobin and in the enzymes of aerobic metabolism. Low stores reduce oxygen delivery and mitochondrial function even before anaemia appears.",
    benefits: ["In deficient athletes, supplementation raises ferritin and improves VO2max, time trial performance and perceived fatigue.", "Alternate-day dosing absorbs better than daily dosing with fewer gut side effects."],
    caveats: ["Iron overload is real: do not supplement without a test. Men and post-menopausal women rarely need it.", "Gut side effects (constipation, nausea) are common with daily high doses.", "Absorption is blocked by coffee, tea, calcium and by the post-exercise hepcidin spike — time it away from all three.", "Hereditary haemochromatosis makes iron supplements dangerous; a doctor should be involved."],
    studies: [
      { ref: "Burden et al., Br J Sports Med 2015 (meta-analysis)", finding: "Iron supplementation improved iron status and aerobic capacity in iron-deficient, non-anaemic endurance athletes." },
      { ref: "Stoffel et al., Lancet Haematol 2017", finding: "Alternate-day dosing increased fractional iron absorption compared with consecutive daily dosing." },
      { ref: "Sim et al., Eur J Appl Physiol 2019 (review)", finding: "Exercise-induced hepcidin peaks 3–6 h after training and suppresses iron absorption; timing intake around it matters." },
    ],
  },
  {
    id: "vitamin-d", name: "Vitamin D", grade: "B", category: "health",
    what: "Supports bone health, muscle function and immunity. Deficiency is common in winter and indoor training; correcting it helps, extra beyond normal levels does not.",
    dose: "Only if a blood test shows low 25(OH)D (under 50 nmol/L, 20 ng/mL). Typical: 1,000–4,000 IU daily depending on the result; re-test after 8–12 weeks.",
    when: "Daily with a meal containing fat.",
    who: "Athletes training indoors through winter, at northern latitudes, with darker skin, or with a low test result. Munich in winter qualifies.",
    defaultDose: "2,000 IU", defaultTime: "morning",
    background: "Vitamin D is made in the skin from sunlight; between October and March at Munich's latitude the sun is too low for meaningful production. Surveys find 30–70% of athletes below the recommended level in winter. The evidence for benefit is about correcting a deficiency, not about super-dosing.",
    mechanism: "Vitamin D regulates calcium absorption and bone remodelling, and has receptors in muscle and immune cells. Deficiency is linked to stress fractures, muscle weakness and more upper-respiratory infections in athletes.",
    benefits: ["Correcting deficiency reduces stress-fracture risk and supports muscle function.", "Fewer upper-respiratory infections in deficient athletes who supplement through winter.", "No performance benefit once levels are adequate."],
    caveats: ["Very high doses (over 10,000 IU/day long term, or large bolus doses) can cause toxicity; more is not better.", "Test first, then dose to the result; re-test.", "Vitamin K2 and magnesium claims alongside it are marketing, not evidence."],
    studies: [
      { ref: "Owens, Allison & Close, Sports Med 2018 — Vitamin D and the athlete: current perspectives and new challenges", finding: "Deficiency is prevalent in athletes and linked to bone injury and illness; supplementation benefits those who are deficient." },
      { ref: "Farrokhyar et al., Sports Med 2015 (meta-analysis)", finding: "56% of athletes had inadequate vitamin D; risk higher in winter, indoors and at higher latitude." },
    ],
  },
  {
    id: "omega-3", name: "Omega-3 (EPA + DHA)", grade: "C", category: "health",
    what: "Fish-oil fatty acids with anti-inflammatory effects. Modest evidence for recovery and muscle soreness; no clear endurance performance effect.",
    dose: "1–3 g combined EPA + DHA per day, or two servings of oily fish per week.",
    when: "Daily with food.",
    who: "Athletes who eat little oily fish. Optional otherwise.",
    defaultDose: "1,000 mg", defaultTime: "morning",
    background: "EPA and DHA are long-chain omega-3 fatty acids found in oily fish. They are incorporated into cell membranes over weeks. Interest in sport comes from their anti-inflammatory role and from studies on muscle soreness and adaptation, which are mixed.",
    mechanism: "Omega-3s shift the balance of signalling molecules produced from membrane fats towards less inflammatory ones, and may increase muscle protein synthesis in some populations (older adults). Effects on trained athletes are small.",
    benefits: ["Some trials show reduced muscle soreness and better recovery of function after damaging exercise.", "General cardiovascular and cognitive health support in people with low fish intake."],
    caveats: ["No consistent improvement in endurance performance.", "Fish-burp and mild gut effects; high doses (over 3 g) thin the blood slightly.", "Quality varies — third-party tested products only, as with everything else here."],
    studies: [
      { ref: "Philpott, Witard & Galloway, Res Sports Med 2019 (review)", finding: "Evidence for omega-3 in athletes is promising for recovery and adaptation but inconsistent; performance effects are not established." },
      { ref: "Lewis et al., J Int Soc Sports Nutr 2015", finding: "Omega-3 supplementation improved neuromuscular function and reduced fatigue in trained men; small sample." },
    ],
  },
  {
    id: "bicarbonate", name: "Sodium bicarbonate", grade: "B", category: "performance",
    what: "Buffers acid in the blood; improves efforts of 1–7 minutes and repeated sprints. Notorious for gut problems.",
    dose: "0.2–0.3 g per kg body weight (15–22 g for 75 kg), ideally in enteric-coated or gel form.",
    when: "60–180 min before a short, hard event; split doses over 2–3 hours reduce gut trouble.",
    who: "Track cyclists, swimmers, rowers and runners racing 1–7 minutes. Rarely relevant to an Ironman athlete.",
    defaultDose: "0.3 g/kg", defaultTime: "pre-session",
    background: "Baking soda. Well studied since the 1980s; the IOC lists it with the A/B-grade supplements for high-intensity events. Included here for completeness — its use-case is short events, not long-course triathlon.",
    mechanism: "Raises blood bicarbonate, which draws hydrogen ions out of the muscle faster during very hard efforts and delays the fall in muscle pH.",
    benefits: ["About 2% improvement in efforts of 1–7 minutes in meta-analyses.", "Some benefit in repeated-sprint sports."],
    caveats: ["Nausea, bloating and diarrhoea are common with standard powders; unusable for many athletes.", "Large sodium load (about 6 g in a 22 g dose).", "No role in steady endurance racing."],
    studies: [
      { ref: "Grgic et al., ISSN position stand: sodium bicarbonate and exercise performance, J Int Soc Sports Nutr 2021", finding: "0.2–0.5 g/kg improves performance in high-intensity efforts of about 30 s to 12 min; gut side effects are the main limitation." },
    ],
  },
];

export const NO_EVIDENCE = {
  title: "No evidence for endurance",
  items: [
    ["BCAAs", "Whole protein contains them; extra BCAAs add nothing to recovery or performance in athletes eating enough protein."],
    ["Glutamine", "No effect on performance or immunity in well-nourished athletes."],
    ["Multivitamins", "No benefit unless a specific deficiency exists; a varied diet covers the rest."],
    ["Antioxidant megadoses (vitamin C, E)", "High doses can blunt training adaptation; food sources are fine."],
    ["Fat burners, 'metabolism boosters'", "No performance evidence; several have caused positive doping tests through contamination."],
    ["Ketone drinks", "Expensive; performance evidence is mixed to negative for endurance events."],
  ] as [string, string][],
};

export const SUPPLEMENT_MAP = Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s])) as Record<string, Supplement>;
