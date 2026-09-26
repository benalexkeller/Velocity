import type { Cube } from "@/components/Cubes";

// Nutrition reference. Numbers are the standard sports-nutrition ranges (ACSM / IOC / ISSN position stands).
// Body-weight examples use 75 kg; the app will use the athlete's own weight once the profile exists.
export const NUTRITION: Cube[] = [
  {
    id: "carbs-during", tag: "During training", title: "Carbohydrate per hour", summary: "30–60 g/h under 2.5 h. 60–90 g/h beyond. 90+ g/h only with a trained gut.",
    render: () => (
      <>
        <table><thead><tr><th>Session length</th><th>Carbs per hour</th><th>Form</th></tr></thead><tbody>
          <tr><td>Under 60 min</td><td>0–30 g</td><td>Water. Mouth rinse is enough.</td></tr>
          <tr><td>1–2.5 h</td><td>30–60 g</td><td>Any single sugar (glucose, maltodextrin).</td></tr>
          <tr><td>2.5 h and longer</td><td>60–90 g</td><td>Glucose + fructose 2:1 (multiple transportable carbohydrates).</td></tr>
          <tr><td>Race pace, trained gut</td><td>90–120 g</td><td>Glucose + fructose 1:0.8. Requires 8+ weeks of gut training.</td></tr>
        </tbody></table>
        <h3>Why the split matters</h3>
        <p>Glucose absorption caps at about 60 g/h through one transporter (SGLT1). Fructose uses a second transporter (GLUT5), so mixing the two raises the ceiling to 90–120 g/h without extra gut distress.</p>
        <h3>What one hour looks like</h3>
        <ul>
          <li>60 g/h = 2 standard gels (25–30 g each) + a few sips of sports drink, or 1 gel + 500 ml of 6% drink.</li>
          <li>90 g/h = 3 gels, or 2 gels + 750 ml of 6% drink, or 1 high-carb gel (40–45 g) + 750 ml drink.</li>
        </ul>
        <p>Start within the first 15–20 minutes. Fueling only once you feel low arrives 30–45 minutes late.</p>
      </>
    ),
  },
  {
    id: "hydration", tag: "During training", title: "Fluid and sodium", summary: "Typical loss 0.5–1.5 L/h. Sodium 300–1000 mg per litre lost. Measure, don't guess.",
    render: () => (
      <>
        <p>Sweat rate varies 3× between athletes and 2× between cool and hot days. The only reliable way to know yours is to weigh before and after a session (the Calculator page has a sweat-rate tool).</p>
        <h3>Working numbers</h3>
        <ul>
          <li>Sweat rate: 0.5–1.5 L/h is common; 2 L/h+ happens in Texas heat.</li>
          <li>Replace 60–80% of losses during the session; finish within 2% of starting body weight.</li>
          <li>Sodium in sweat: 300–1800 mg/L (average about 900). Salty crust on kit = high end.</li>
          <li>Target intake: 300–600 mg sodium per 500 ml of fluid on long, hot days.</li>
          <li>Drinking plain water above 1 L/h for hours dilutes blood sodium (hyponatremia). Pair fluid with sodium.</li>
        </ul>
        <h3>Session guide</h3>
        <table><thead><tr><th>Session</th><th>Fluid</th><th>Sodium</th></tr></thead><tbody>
          <tr><td>Under 60 min</td><td>Optional</td><td>None</td></tr>
          <tr><td>1–2 h, mild</td><td>400–600 ml/h</td><td>200–400 mg/h</td></tr>
          <tr><td>2 h+, hot</td><td>600–1000 ml/h</td><td>500–1000 mg/h</td></tr>
        </tbody></table>
      </>
    ),
  },
  {
    id: "daily", tag: "Every day", title: "Daily carbs, protein, fat", summary: "Carbs scale with training hours: 5–7 g/kg on light days, 8–12 g/kg on 4–5 h days.",
    render: () => (
      <>
        <table><thead><tr><th>Training that day</th><th>Carbohydrate</th><th>75 kg example</th></tr></thead><tbody>
          <tr><td>Rest or under 1 h easy</td><td>3–5 g/kg</td><td>225–375 g</td></tr>
          <tr><td>About 1 h</td><td>5–7 g/kg</td><td>375–525 g</td></tr>
          <tr><td>1–3 h</td><td>6–10 g/kg</td><td>450–750 g</td></tr>
          <tr><td>4–5 h (big weekends)</td><td>8–12 g/kg</td><td>600–900 g</td></tr>
        </tbody></table>
        <h3>Protein</h3>
        <p>1.6–2.0 g/kg per day, split into 4 feedings of 0.3–0.4 g/kg (about 25–30 g each for 75 kg). Higher end during heavy blocks and any weight loss.</p>
        <h3>Fat</h3>
        <p>20–35% of total energy. Below 20% long-term compromises hormones and fat-soluble vitamin intake. Not a fuel to add during sessions.</p>
        <h3>Periodize, don't average</h3>
        <p>Match carbohydrate to the day: high on long-ride and interval days, lower on rest days. The weekly total lands where it should without daily counting.</p>
      </>
    ),
  },
  {
    id: "pre", tag: "Before a session", title: "Pre-session meal", summary: "1–4 g/kg carbs, 1–4 h before. Low fibre, low fat. Under 1 h out: 30 g of easy sugar.",
    render: () => (
      <>
        <table><thead><tr><th>Time before</th><th>Carbs</th><th>Example (75 kg)</th></tr></thead><tbody>
          <tr><td>3–4 h</td><td>3–4 g/kg</td><td>Rice or pasta bowl, bread, juice — 225–300 g carbs</td></tr>
          <tr><td>1–2 h</td><td>1–2 g/kg</td><td>Oats with banana and honey, toast with jam — 75–150 g</td></tr>
          <tr><td>Under 1 h</td><td>0.4 g/kg</td><td>Banana, gel, or 500 ml sports drink — about 30 g</td></tr>
        </tbody></table>
        <h3>Rules</h3>
        <ul>
          <li>Low fibre and low fat close to the start: both slow gastric emptying.</li>
          <li>Protein is fine in the 3–4 h meal (20–30 g), keep it small inside 1 h.</li>
          <li>Fluid: 5–7 ml/kg in the 4 hours before (375–525 ml for 75 kg), plus 300–500 ml in the last 15 minutes on hot days.</li>
          <li>Early morning sessions under 75 minutes can go fasted or on 20–30 g of sugar; anything longer or harder gets a meal.</li>
        </ul>
      </>
    ),
  },
  {
    id: "recovery", tag: "After a session", title: "Recovery window", summary: "Next session within 8 h: 1.0–1.2 g/kg carbs per hour for 4 h, plus 20–40 g protein.",
    render: () => (
      <>
        <h3>When the next session is within 8 hours</h3>
        <ul>
          <li>Carbohydrate: 1.0–1.2 g/kg per hour for the first 4 hours (75–90 g/h for 75 kg). Start within 30 minutes.</li>
          <li>Protein: 0.3 g/kg (20–40 g) in the first meal.</li>
          <li>Fluid: 125–150% of the weight lost, with sodium, over the next 2–4 hours.</li>
        </ul>
        <h3>When the next session is tomorrow</h3>
        <p>The 30-minute window is not critical. Hit the day's totals (see Daily carbs, protein, fat) and eat a normal meal within about 2 hours.</p>
        <h3>Two-a-days</h3>
        <p>Morning swim + evening ride: treat the gap as a recovery window. 100 g carbs + 25 g protein immediately, a full meal within 2 hours, and a 60–90 g carb snack 1–2 hours before the second session.</p>
      </>
    ),
  },
  {
    id: "race-day", tag: "Race", title: "Ironman race-day plan", summary: "Breakfast 3 h out at 2–3 g/kg. Bike 80–100 g/h. Run 60–70 g/h. Sodium 500–1000 mg/h in heat.",
    render: () => (
      <>
        <table><thead><tr><th>Segment</th><th>Carbs</th><th>Fluid</th><th>Sodium</th></tr></thead><tbody>
          <tr><td>Breakfast, 3 h before</td><td>2–3 g/kg (150–225 g)</td><td>500–750 ml</td><td>With food</td></tr>
          <tr><td>Last 15 min</td><td>25–30 g (1 gel)</td><td>200–300 ml</td><td>—</td></tr>
          <tr><td>Swim (1.5 h)</td><td>0</td><td>0</td><td>0</td></tr>
          <tr><td>T1</td><td>1 gel</td><td>200 ml</td><td>—</td></tr>
          <tr><td>Bike (6+ h)</td><td>80–100 g/h</td><td>750–1000 ml/h</td><td>600–1000 mg/h</td></tr>
          <tr><td>Run (4.5+ h)</td><td>60–70 g/h</td><td>500–800 ml/h</td><td>500–800 mg/h</td></tr>
        </tbody></table>
        <h3>Sequencing</h3>
        <ul>
          <li>Bike is where the calories go in: liquid carbs on the bike are easier to hold than solids on the run.</li>
          <li>Drop to gels, chews and cola on the run; aid stations every mile make 60 g/h workable.</li>
          <li>Caffeine: 100–200 mg at the start of the bike, 100 mg at the start of the run, 50–100 mg at mile 18–20.</li>
          <li>Nothing on race day that was not used on at least three long rides.</li>
        </ul>
        <p>The plan's Build 2 phase runs this exact schedule on every Saturday ride.</p>
      </>
    ),
  },
  {
    id: "carb-load", tag: "Race week", title: "Carb-loading", summary: "10–12 g/kg per day for the last 36–48 h. Expect +1–2 kg of water weight. Low fibre from 2 days out.",
    render: () => (
      <>
        <ul>
          <li>Thursday and Friday before a Saturday race: 10–12 g/kg carbohydrate per day (750–900 g for 75 kg).</li>
          <li>Reduce fibre and fat from Thursday to keep gut volume low. White rice, pasta, bread, juice, sports drink, rice cakes, low-fibre cereal.</li>
          <li>Weight up 1–2 kg is glycogen plus stored water (about 3 g water per gram of glycogen). Normal.</li>
          <li>Spread over 5–6 feedings. Big single meals cause bloating, not more storage.</li>
          <li>Taper volume drops training energy needs by 30–50%: the extra carbs replace fat and protein, not add to them.</li>
          <li>Sodium slightly above normal on Friday helps plasma volume in heat: about 1 extra gram spread through the day.</li>
        </ul>
      </>
    ),
  },
  {
    id: "caffeine", tag: "Supplement", title: "Caffeine", summary: "3–6 mg/kg 60 min before. 1–3 mg/kg works late in long events. Half-life about 5 h.",
    render: () => (
      <>
        <ul>
          <li>Effective dose: 3–6 mg/kg taken 45–60 minutes before the effort (225–450 mg for 75 kg). Higher doses add side effects, not performance.</li>
          <li>During long events, 1–3 mg/kg (75–225 mg) in the last third restores alertness and perceived effort.</li>
          <li>Half-life 4–6 hours: a 200 mg dose at 5 pm leaves 100 mg in the blood at 10 pm. Cut caffeine after 2 pm on normal days.</li>
          <li>Habitual users still benefit; no need to withdraw before a race.</li>
          <li>Content: espresso 60–80 mg, filter coffee 80–150 mg per cup, caffeinated gel 25–100 mg, energy drink 80–160 mg.</li>
          <li>Side effects above 6 mg/kg: tremor, GI distress, elevated heart rate, poor sleep.</li>
        </ul>
      </>
    ),
  },
  {
    id: "protein", tag: "Every day", title: "Protein timing", summary: "1.6–2.0 g/kg per day in 4 doses of 0.3–0.4 g/kg. 40 g before sleep on heavy days.",
    render: () => (
      <>
        <ul>
          <li>Daily total 1.6–2.0 g/kg (120–150 g for 75 kg). Up to 2.2 g/kg in a calorie deficit.</li>
          <li>Per meal 0.3–0.4 g/kg (25–30 g), 4 times a day, 3–4 hours apart. More per meal is not used for muscle repair.</li>
          <li>Leucine 2.5–3 g per dose triggers repair: 25–30 g of whey, eggs, dairy, meat or fish delivers that; plant sources need larger portions or mixing.</li>
          <li>Pre-sleep: 30–40 g slow protein (casein, Greek yogurt, cottage cheese) after long or hard days.</li>
          <li>Strength sessions: 20–40 g within 2 hours before or after.</li>
        </ul>
        <table><thead><tr><th>Food</th><th>Protein</th></tr></thead><tbody>
          <tr><td>Chicken breast 150 g</td><td>46 g</td></tr><tr><td>Greek yogurt 200 g</td><td>20 g</td></tr><tr><td>3 eggs</td><td>19 g</td></tr><tr><td>Whey scoop 30 g</td><td>24 g</td></tr><tr><td>Lentils cooked 200 g</td><td>18 g</td></tr><tr><td>Tofu 150 g</td><td>17 g</td></tr>
        </tbody></table>
      </>
    ),
  },
  {
    id: "gut", tag: "Preparation", title: "Gut training", summary: "Start 8+ weeks out. Add 10 g/h every 1–2 weeks. Practice race products on every long ride.",
    render: () => (
      <>
        <p>The gut adapts like a muscle. Absorption capacity and tolerance both rise with repeated exposure to carbohydrate during exercise.</p>
        <ul>
          <li>Start in Base 3, at least 8 weeks before the race. Begin at a comfortable rate (40–60 g/h).</li>
          <li>Increase by about 10 g/h every 1–2 weeks on long rides until you reach the race target (80–100 g/h).</li>
          <li>Use exactly the products, flavours and concentrations you will race with.</li>
          <li>Train with the fluid volume of race day as well, not just the carbs.</li>
          <li>Eat a high-carb diet daily during this period: it raises intestinal transporter density.</li>
          <li>Two consecutive long rides with GI distress: drop back 20 g/h for two weeks, then resume.</li>
        </ul>
      </>
    ),
  },
  {
    id: "heat", tag: "Race conditions", title: "Heat and sweat", summary: "Texas in April: 25–30 °C, humid. Sweat 1.5–2 L/h on the bike. Sodium and pre-cooling matter.",
    render: () => (
      <>
        <ul>
          <li>Heat acclimation takes 10–14 days of 60–90 minute sessions with elevated core temperature. The Peak phase does this indoors, overdressed, plus sauna.</li>
          <li>Acclimated athletes sweat sooner and more, with lower sodium concentration: plan for higher fluid volume (up to 1 L/h) on the bike.</li>
          <li>Pre-cool: 500 ml of cold slush or drink in the 30 minutes before the start; ice under the cap and in the tri-suit at aid stations on the run.</li>
          <li>Sodium: 700–1000 mg/h on the bike in these conditions. Test the plan on the hottest long rides available.</li>
          <li>Weigh before and after hot sessions to update your sweat rate (Calculator page).</li>
          <li>Body-weight loss above 3% during a race measurably slows pace; above 4–5% raises medical risk.</li>
        </ul>
      </>
    ),
  },
  {
    id: "supplements", tag: "Supplement", title: "Supplements with evidence", summary: "Caffeine, creatine, nitrate, sodium bicarbonate, beta-alanine. Everything else: weak or none.",
    render: () => (
      <>
        <table><thead><tr><th>Supplement</th><th>Dose</th><th>Relevance for Ironman</th></tr></thead><tbody>
          <tr><td>Caffeine</td><td>3–6 mg/kg pre, 1–3 mg/kg during</td><td>High. See the Caffeine cube.</td></tr>
          <tr><td>Creatine monohydrate</td><td>3–5 g per day</td><td>Moderate: strength work, recovery, heat tolerance. Adds 1–2 kg water.</td></tr>
          <tr><td>Nitrate (beetroot)</td><td>6–8 mmol, 2–3 h before</td><td>Low–moderate: helps less-trained athletes more.</td></tr>
          <tr><td>Sodium bicarbonate</td><td>0.3 g/kg, 60–90 min before</td><td>Low: 1–7 minute efforts. GI risk. Not for race day.</td></tr>
          <tr><td>Beta-alanine</td><td>3.2–6.4 g per day, 4+ weeks</td><td>Low: 1–4 minute efforts.</td></tr>
          <tr><td>Vitamin D</td><td>1000–2000 IU per day in winter</td><td>Only if a blood test shows low levels.</td></tr>
          <tr><td>Iron</td><td>As prescribed</td><td>Only after a ferritin test. Do not self-dose.</td></tr>
        </tbody></table>
        <p>Not supported by evidence for endurance performance: BCAAs, glutamine, MCT oil, ketone esters (in most studies), collagen for performance, most "fat burners". Third-party tested brands (Informed Sport, NSF) reduce contamination risk.</p>
      </>
    ),
  },
  {
    id: "energy", tag: "Every day", title: "Energy availability", summary: "Under 30 kcal per kg of fat-free mass per day breaks recovery, hormones and bone. Base is not for weight loss.",
    render: () => (
      <>
        <p>Energy availability = calories eaten − calories burned in training, per kilogram of fat-free mass.</p>
        <ul>
          <li>45 kcal/kg FFM/day: full adaptation. 30–45: acceptable short-term. Under 30: impaired recovery, hormones, immune function and bone (RED-S).</li>
          <li>75 kg athlete at 15% body fat: FFM 64 kg. A 2-hour ride (about 1400 kcal) on a 2500 kcal intake leaves 1100 kcal = 17 kcal/kg FFM. Too low.</li>
          <li>Weight loss, if wanted, belongs in Base 1–2 at a maximum deficit of 300–500 kcal per day, never on long-ride days, and never in Build or Peak.</li>
          <li>Warning signs: rising resting HR, falling HRV, poor sleep, repeated illness, stalled paces at the same effort. The Health score tracks the first three.</li>
        </ul>
      </>
    ),
  },
];
