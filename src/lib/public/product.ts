// Content of the public product pages (/product/train, /product/nutrition, /product/coach) and of the front-page
// menus, which list each page's sections. Plain facts only: what the product does, how it works, what it looks like.
// Screenshots live in /public/product (taken by scripts/product-shots.js from the running app with seed data).

export type ProductSlug = "train" | "nutrition" | "coach";

export interface Shot { src: string; w: number; h: number; alt: string; caption?: string }
export interface Section {
  id: string;
  /** Menu label and section heading. */
  title: string;
  /** One line under the menu label. */
  short: string;
  /** Paragraphs. */
  body: string[];
  /** Short facts, one per line. */
  facts?: string[];
  /** Numbered steps, for "how it works". */
  steps?: string[];
  shot?: Shot;
}
export interface ProductPage {
  slug: ProductSlug;
  nav: string;
  title: string;
  lead: string;
  /** The full-width screenshot under the title. */
  hero: Shot;
  sections: Section[];
  /** "How it looks": a gallery at the end. */
  gallery: Shot[];
  /** What is not in the app yet, stated plainly. */
  notYet?: string[];
}

const W = 1440, H = 940;
const shot = (id: string, alt: string, caption?: string, w = W, h = H): Shot => ({ src: `/product/${id}.webp`, w, h, alt, caption });

export const PRODUCT: ProductPage[] = [
  {
    slug: "train",
    nav: "Train",
    title: "Train",
    lead: "A plan built for your race date, every session with its steps and targets, and the week in front of you on a calendar. Activities come in from your watch or by hand.",
    hero: shot("dashboard", "The dashboard: today's session, the next two days, this week's totals and the last activity with its route."),
    sections: [
      {
        id: "plan", title: "The plan", short: "Built from your race, your week and your current fitness",
        body: [
          "The plan builder asks for the race (distance, date, goal time), the days and times you can train, and the longest swim, ride and run you have done recently. From that it writes every week to race day.",
          "Phases follow standard practice: base, build, peak, taper. Volume rises by about ten percent a week, a recovery week comes every third or fourth week, and the long ride and long run are never cut to make up for a missed week.",
        ],
        facts: ["One long ride and one long run a week, hard days separated by easy days.", "Weekly hours per discipline on one chart, the race at the end.", "Every session has numbered steps: warm-up, main set, cool-down, with the zone and the target pace or power.", "Zones come from your own threshold tests (LTHR, FTP, pace), not from your age.", "A brick can be split into its ride and its run, two sessions back to back on the calendar, one at a time or all at once.", "A plan from another source can be imported from a spreadsheet template."],
        shot: shot("plan-week", "The Plan page: the week grid with sessions at their times, the weekly-hours chart with phases, and the phase table."),
      },
      {
        id: "sessions", title: "Sessions", short: "Steps, zones and targets for each one",
        body: ["Open any session and it shows the duration, the zone, the target pace, the planned load and the steps. Intervals are drawn against the zone legend. Log the activity from the same panel, move it, edit it or lock it so nothing else moves it."],
        shot: shot("session", "A session panel: 90 minutes, Zone 2, target pace 2:00 to 2:10 per 100 yards, numbered steps and the interval chart.", undefined, 922, 695),
      },
      {
        id: "calendar", title: "The week", short: "Drag sessions, lock the ones that must stay",
        body: ["The week grid shows each session at its start time. Drag one to another day or time and the plan updates. Locked sessions stay where they are, also when the coach proposes changes. The month view shows the whole block."],
        facts: ["Rest days are shown as rest, not hidden.", "Done sessions turn dark; partial ones are marked.", "Start times come from your availability: a morning time and an evening time for weekdays, one for weekends."],
        shot: shot("plan-month", "The month view: four weeks of sessions with their status."),
      },
      {
        id: "activities", title: "From your watch", short: "Garmin activities land as logged sessions",
        body: ["With Garmin connected, finished activities arrive with duration, distance, pace, heart rate and the route, and are matched to the planned session of the day. Without a watch, log a session by hand in a few fields."],
        facts: ["Every activity is a row: date, sport, duration, distance, pace, heart rate, load, and planned versus done.", "Routes are drawn on a map from the recorded track.", "Garmin connects from the Profile page; the sync runs on a button and in the background."],
        shot: shot("activities", "The Activities page: a table of logged activities with duration, distance, pace, heart rate and load, and one activity opened with its route."),
      },
      {
        id: "analysis", title: "Analysis", short: "Load, fitness, form, pace per sport",
        body: ["The Analysis page keeps the numbers that describe training: load per session and per week, fitness (42-day load), fatigue (7-day load), form (the difference), weekly volume against the plan, pace or speed trends per sport, and compliance. Every figure has its definition one hover away."],
        facts: ["Sunday review: three facts about the week, written from the data.", "Pace trends per sport against the target corridor for the race.", "Body data from Garmin: resting heart rate, HRV, sleep, VO2max."],
        shot: shot("analysis", "The Analysis page: key figures, the Sunday review, the fitness, fatigue and form chart and weekly volume."),
      },
    ],
    gallery: [
      shot("dashboard", "Dashboard", "Dashboard"),
      shot("plan-week", "Plan, week view", "Plan"),
      shot("activities", "Activities", "Activities"),
      shot("analysis", "Analysis", "Analysis"),
    ],
    notYet: ["Google Calendar and Outlook on the training calendar: planned, not in the app yet.", "Starting a session from the phone: planned with the mobile app."],
  },
  {
    slug: "nutrition",
    nav: "Nutrition",
    title: "Nutrition",
    lead: "Daily targets from your weight and the day's training, carbohydrate timed around each session, and logging that takes one tap for a whole plate.",
    hero: shot("nutrition", "The Nutrition page: daily targets, the timeline with the session and meals, and carbohydrate timing around the session."),
    sections: [
      {
        id: "targets", title: "Daily targets", short: "Calories and grams from your weight and the day",
        body: ["Set-up takes weight, height, birth year and sex. Each day's targets then follow the planned training: a light, moderate or heavy day sets the carbohydrate target in grams per kilogram, protein stays at a fixed amount per kilogram, and the calories follow."],
        facts: ["Carbohydrate: 3.5 g/kg plus 1.6 g/kg for every effective training hour, between 3 and 12; 9 to 10 g/kg on the two loading days before the race.", "Protein: 1.7 g/kg, 1.9 in Build and Peak, 2.2 when losing weight. Fat never below 0.8 g/kg.", "A target weight per training phase, with the race weight as the last stage; no deficit on long days, in race week or in the taper."],
        shot: shot("nutrition", "Daily targets at the top of the Nutrition page: calories, carbohydrate, protein, fat, and the day's intake against them."),
      },
      {
        id: "timing", title: "Around the session", short: "Before, during and after, with clock times",
        body: ["For each training day the session's start time sets the schedule: how many grams of carbohydrate to eat by what time before, what to drink per hour during, and what to eat in the two hours after. Long sessions get carbohydrate during; short ones get water."],
        facts: ["Before: up to 2 g/kg with three hours to go, 0.5 to 1 g/kg with ninety minutes, a small amount at dawn, low in fibre and fat, each by a clock time.", "During: 0.3 to 0.8 litres an hour from 45 minutes; carbohydrate from 75 minutes, 30 to 90 g an hour by duration and intensity; sodium past 90 minutes.", "After: 1 to 1.2 g/kg carbohydrate and 0.3 g/kg protein, within two hours, or within 30 minutes when the next session is less than eight hours away.", "The timeline shows the session between the meals, so breakfast is the \"before\" and lunch the \"after\"."],
        shot: shot("nutrition-timing", "The carbohydrate timing panel: before, during, after and the rest of the day, each with its target and what has been logged.", undefined, 472, 394),
      },
      {
        id: "logging", title: "Logging", short: "Photographed meals, food search, or a rough day",
        body: ["The meal library holds photographed plates with standard portions; one tap logs the whole meal with its calories and macros, scaled to a half or double portion. For anything else, search the food database, type a meal in with its calories, or give the day as a rough estimate per meal."],
        facts: ["Meals are built from the foods list, so the macros add up from the ingredients.", "Food search covers the USDA database when a key is set, and a built-in list of athlete staples otherwise.", "Water is logged in bottles; the bottle size is yours."],
        shot: shot("nutrition-meals", "The meal library in the add panel: photo cards with calories, carbohydrate and protein, and one plate opened with its portion sizes."),
      },
      {
        id: "guide", title: "Guide and supplements", short: "Evidence-graded, with sources",
        body: ["The guide covers carbohydrate loading, protein, hydration and sodium, race-day fuelling and the supplements with evidence behind them (caffeine, creatine, beta-alanine, nitrate, sodium bicarbonate). Each claim carries a grade: A strong evidence, B some, C limited. Sources are listed."],
        shot: shot("nutrition-guide", "The nutrition guide: sections on carbohydrate, protein and hydration with evidence grades and sources."),
      },
    ],
    gallery: [
      shot("nutrition", "Nutrition, tracking", "Tracking"),
      shot("nutrition-meals", "Meal library", "Meal library"),
      shot("nutrition-guide", "Guide", "Guide"),
    ],
    notYet: ["Logging a meal from a photo: not in the app.", "Barcode scanning: not in the app."],
  },
  {
    slug: "coach",
    nav: "Coach",
    title: "Coach",
    lead: "A coach that reads your plan, your activities, your body data and your meals before it answers, cites its sources, and changes the plan only through proposals you accept.",
    hero: shot("coach-page", "The Plan page with the coach rail open: a question about last week answered with the figures from the plan and the logged activities."),
    sections: [
      {
        id: "context", title: "What it reads", short: "Your data, and nothing else",
        body: ["Every question goes to the coach together with a compact copy of your data: today's date, the race, your zones and availability, this week's and next week's sessions with their status, the last fourteen days of activities, the last four weeks planned against done, and the latest body data. It does not know anything else about you, and it says \"Not in your data\" when the answer is not there."],
        facts: ["Asked from the Plan page it sees the plan; from Nutrition it sees the day's meals and targets.", "Unsaved moves and edits are included, so the answer matches what is on screen.", "The context is rebuilt in the browser for every message."],
        shot: shot("coach-review", "The coach answering \"How was last week against the plan?\": sessions done, hours, load, the long ride against plan, and this week's key session.", undefined, 340, 406),
      },
      {
        id: "library", title: "Sourced answers", short: "Training science from a reference library",
        body: ["Coaching advice comes from a library of referenced passages on training, nutrition, recovery, injury, racing, heat and altitude. The passage used is marked in the answer and listed under Sources. Your own numbers come from your data; the rules come from the library."],
        facts: ["Each passage carries its source, its evidence grade and the sport it applies to.", "Answers cite only passages they actually used.", "Questions outside the data and the library get \"Not in your data or the library\", not a guess."],
        shot: shot("coach-sources", "An answer about cramp with a numbered citation and the source listed under it.", undefined, 340, 534),
      },
      {
        id: "proposals", title: "Changes are proposals", short: "Accept or decline, nothing moves on its own",
        body: ["The coach never edits the plan directly. When a change is right, it proposes one: which sessions, what changes, and the reason with the numbers. The proposal is a card in the chat with Accept and Decline. Accepted changes land on the calendar; locked and completed sessions are never touched."],
        facts: ["One proposal per answer, with a one-sentence reason from the data.", "\"After work\" means your evening availability time; \"before work\" the morning one.", "Declined proposals stay in the history, marked declined."],
        shot: shot("coach-proposal", "A proposal card: tomorrow's brick moved to 18:00, the reason, and the Accept and Decline buttons.", undefined, 340, 463),
      },
      {
        id: "review", title: "Whole-plan review", short: "A pitch first, the full review on your go",
        body: ["When more than the next two weeks need to change, after an injury, a missed block, a new race date, the coach does not patch piecemeal. It writes a short pitch of what it would change and why. Only when you accept the pitch does the full review run, with every remaining week in view, and it comes back as one proposal with all the changes, week by week."],
        facts: ["The pitch costs one short message; the full review runs only on your acceptance.", "Long sessions are rebuilt from the longest you actually did in the last 30 days, stepping up by at most ten percent.", "Recovery weeks and the taper stay in place; the race never moves."],
        shot: shot("coach-pitch", "A pitch card: what the full review would change and why, with Run the full review and Not now.", undefined, 340, 625),
      },
      {
        id: "limits", title: "Limits", short: "What the coach will not do",
        body: ["A fixed check runs before any question reaches the model: chest pain, fainting, breathlessness at rest and similar signs get one answer, stop and see a doctor. The coach gives no daily readiness score and does not tell you to skip training over one night's sleep. Medical, injury and nutrition questions get general guidance and a referral when something persists."],
        facts: ["Answers come from an open-weight language model (DeepSeek) through OpenRouter, with your data as the only context.", "Forty messages a day per account.", "Only you can see your data."],
      },
    ],
    gallery: [
      shot("coach-page", "The coach rail on the Plan page", "Weekly review"),
      shot("coach-accepted", "An accepted proposal, applied to the calendar", "Accepted proposal"),
    ],
  },
];

export const productBySlug = (slug: string) => PRODUCT.find((p) => p.slug === slug);
