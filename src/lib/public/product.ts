// Content of the public product pages (/product/train, /product/nutrition, /product/coach) and of the front-page
// menus, which list each page's sections. Plain facts only: what the product does, how it works, what it looks like.
// Titles carry no full stops; ranges use a plain hyphen.
// Screenshots live in /public/product (taken by scripts/product-shots.js from the running app with seed data).

export type ProductSlug = "train" | "nutrition" | "coach";

export interface Shot {
  src: string; w: number; h: number; alt: string; caption?: string;
  /** A single card cut out of the app: it has its own border, so the page adds a shadow but no frame. */
  card?: boolean;
}
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
  /** A row of labelled chips (the coach's models): name, and what it is used for. */
  chips?: { name: string; role: string }[];
  shot?: Shot;
  /** A drawn mock-up instead of a screenshot. */
  mock?: "calendar";
  /** Show the screenshot smaller than the default. */
  small?: boolean;
}
export interface ProductPage {
  slug: ProductSlug;
  nav: string;
  title: string;
  lead: string;
  /** The full-width screenshot under the title. */
  hero: Shot;
  sections: Section[];
}

const W = 1440, H = 940;
const shot = (id: string, alt: string, w = W, h = H): Shot => ({ src: `/product/${id}.webp`, w, h, alt });
const card = (id: string, alt: string, w: number, h: number): Shot => ({ src: `/product/${id}.webp`, w, h, alt, card: true });
// the coach shots are the rail cropped without its left rule, so they take the ordinary frame

export const PRODUCT: ProductPage[] = [
  {
    slug: "train",
    nav: "Train",
    title: "Train",
    lead: "A plan built for your race date, session by session, with set targets to achieve your race ambitions. Activities come in from your watch or by hand.",
    hero: shot("dashboard", "The dashboard: today's session, the next two days, this week's totals and the last activity with its route."),
    sections: [
      {
        id: "plan", title: "The plan", short: "Built from your race, your week and your current fitness",
        body: [
          "The plan builder asks for the race (distance, date, goal time), the days and times you can train, and the longest swim, ride and run you have done recently. From that it writes every week to race day.",
          "Phases follow standard practice: base, build, peak, taper. Volume rises by about ten percent a week, a recovery week comes every third or fourth week, and the long ride and long run are never cut to make up for a missed week.",
        ],
        facts: ["One long ride and one long run a week, hard days separated by easy days", "Weekly hours on one chart, from week one to the race", "Every session has numbered steps: warm-up, main set, cool-down, with the zone and the target pace or power", "Zones come from your own threshold tests (LTHR, FTP, pace), not from your age", "A brick is two sessions on the calendar, the ride and then the run, each with its own steps", "Drag a session to another day or time, or lock it so nothing moves it"],
        mock: "calendar",
      },
      {
        id: "sessions", title: "Sessions", short: "Steps, zones and targets for each one",
        body: ["Open any session and it shows the duration, the zone, the target pace, the planned load and the steps. Intervals are drawn against the zone legend. Log the activity from the same panel, move it, edit it or lock it so nothing else moves it.", "Swims are written in yards or metres, not minutes: 800 yd warm-up at 2:00-2:20 per 100 yd, then the main set rep by rep."],
        shot: card("session", "A swim session panel: 10 × 100 yd at threshold pace with 20 s rest, the steps in yards and the interval chart drawn by distance.", 922, 745),
      },
      {
        id: "activities", title: "From your device", short: "Every activity in one library",
        body: ["With Garmin, WHOOP, Fitbit or your own mobile device, log all of your activities into one library. Every activity keeps the stats that matter, duration, distance, pace, heart rate and the route, and is matched to the planned session of the day."],
        facts: ["Coach insight when you ask for it: a few bullets with the numbers that matter for that activity", "Analyze opens the activity on the Analysis page", "Routes are drawn on a map from the recorded track", "No watch: log a session by hand in a few fields"],
        shot: shot("activities", "The Activities page: logged activities with duration, distance, pace, heart rate and load, and one opened with its route, Analyze and coach insight."),
      },
      {
        id: "analysis", title: "Analysis", short: "Where the training adds up",
        body: ["Analysis is where the weeks add up. Six numbers at the top tell you where you stand, then your volume against the plan, then fitness, fatigue and form over time, and pace per sport against what your race needs. Hover over any number to see how it is worked out."],
        facts: ["Every Sunday, three things worth knowing about the week", "Pace per sport against the corridor your goal time needs", "Resting heart rate, HRV, sleep and VO2max from your watch"],
        shot: shot("analysis", "The Analysis page: six key figures, training volume against the plan, the Sunday review and the fitness, fatigue and form chart.", 1440, 1180),
      },
    ],
  },
  {
    slug: "nutrition",
    nav: "Nutrition",
    title: "Nutrition",
    lead: "Daily targets set from your body and each day's training load, carbs planned into your sessions, and logging that takes one message for a whole plate.",
    hero: shot("nutrition", "The Nutrition page: the day's meals with calories, carbs, protein and fat, the activity fuel plan and hydration."),
    sections: [
      {
        id: "targets", title: "Daily targets", short: "Calories and grams from your body and the day",
        body: ["Set-up takes weight, height, age and sex, and the training of each day sets that day's targets. A rest day, a light day and a long day each get their own carbohydrate target, protein stays steady, and the calories follow."],
        facts: ["Carbohydrate starts at 3.5 g per kg of body weight on a rest day and rises with every hour of training, because carbohydrate is the fuel for hard work and the body's store of it runs low after about 90 minutes", "A target weight for each training phase, with race weight as the last stage, and never a deficit on long days, in race week or in the taper", "Protein at about 1.7 g per kg, a little more in the hardest weeks, to repair muscle after each session"],
        shot: shot("nutrition", "Daily targets at the top of the Nutrition page: calories, carbohydrate, protein and fat against what was eaten."),
      },
      {
        id: "timing", title: "Planned around your activities", short: "Before, during and after, with clock times",
        body: ["For each training day the session's start time sets the schedule: how many grams of carbohydrate to eat by what time before, what to drink per hour during, and what to eat in the two hours after. Long sessions get carbohydrate during; short ones get water."],
        shot: card("nutrition-timing", "The activity fuel plan: before, during, after and the rest of the day, each with its target and what has been logged.", 468, 388),
        small: true,
      },
      {
        id: "logging", title: "Logging", short: "One tap, a search, or a message to your coach",
        body: ["The meal library holds photographed plates, the food search covers over 40,000 foods, recent meals are one tap away, or you can just write to your coach what you ate and it logs it for you."],
        facts: ["Meal library: photographed plates with standard portions, one tap logs the whole plate, half or double portion", "Search: over 40,000 foods with their calories and macros", "Recent: the foods you log most, one tap to log again", "Coach: write \"chicken and rice for dinner\" and it is logged with its calories and macros", "Type it in: your own meal with its calories, or a rough estimate for the whole day"],
        shot: shot("nutrition-meals", "The meal library in the add panel: photo cards with calories, carbohydrate and protein, and one plate opened with its portion sizes."),
      },
      {
        id: "guide", title: "Guide", short: "Evidence-graded, with sources",
        body: ["The guide covers carbohydrate loading, protein, hydration, race-day fuelling and the supplements with evidence behind them: caffeine, creatine, beta-alanine and nitrate. Each claim carries a grade, A strong evidence, B some, C limited, and its sources are listed."],
        shot: shot("nutrition-guide", "The nutrition guide: your nutrition stats, body weight, energy needs by day type, and guide sections with evidence grades and sources."),
      },
    ],
  },
  {
    slug: "coach",
    nav: "Coach",
    title: "Coach",
    lead: "A coach that reads your plan, your activities, your body data and your meals before it answers, cites its sources, and changes the plan only through proposals you accept. It works across the leading AI models.",
    hero: shot("coach-page", "The Plan page with the coach rail open: a question about last week answered with the figures from the plan and the logged activities."),
    sections: [
      {
        id: "context", title: "What it reads", short: "Your data, and nothing else",
        body: ["Every question goes to the coach together with a compact copy of your data: today's date, the race, your zones and availability, this week's and next week's sessions with their status, the last fourteen days of activities, the last four weeks planned against done, your latest body data, and yesterday's and today's meals against their targets. It does not know anything else about you, and it says \"Not in your data\" when the answer is not there."],
        facts: ["Tell it what you ate and it logs the meal, with a photo when the plate is in the meal library", "Unsaved moves and edits are included, so the answer matches what is on screen", "The context is rebuilt in the browser for every message"],
        shot: shot("coach-review", "The coach answering \"How was last week against the plan?\": sessions done, hours, load, the long ride against plan, and this week's key session.", 339, 406),
      },
      {
        id: "library", title: "Sourced answers", short: "Training science from a reference library",
        body: ["Coaching advice comes from a library of referenced passages on training, nutrition, recovery, injury, racing, heat and altitude. The passage used is marked in the answer and listed under Sources. Your own numbers come from your data; the rules come from the library."],
        facts: ["Each passage carries its source, its evidence grade and the sport it applies to", "Answers cite only passages they actually used", "Questions outside the data and the library get \"Not in your data or the library\", not a guess"],
        shot: shot("coach-sources", "An answer about cramp: a verdict, three bullets with the numbers, the next step and a numbered citation with its source.", 339, 550),
      },
      {
        id: "proposals", title: "Changes are proposals", short: "Accept or decline, nothing moves on its own",
        body: ["The coach never edits the plan directly. When a change is right, it proposes one: which sessions, what changes, and the reason with the numbers. The proposal is a card in the chat with Accept and Decline. Accepted changes land on the calendar; locked and completed sessions are never touched."],
        facts: ["One proposal per answer, with a one-sentence reason from the data", "\"After work\" means your evening availability time; \"before work\" the morning one", "Declined proposals stay in the history, marked declined"],
        shot: shot("coach-proposal", "A proposal card: tomorrow's session moved to 18:00, the reason, and the Accept and Decline buttons.", 339, 463),
      },
      {
        id: "review", title: "Whole-plan review", short: "A pitch first, the full review on your go",
        body: ["When more than the next two weeks need to change, after an injury, a missed block, a new race date, the coach does not patch piecemeal. It writes a short pitch of what it would change and why. Only when you accept the pitch does the full review run, with every remaining week in view, and it comes back as one proposal with all the changes, week by week."],
        facts: ["The pitch costs one short message; the full review runs only on your acceptance", "Long sessions are rebuilt from the longest you actually did in the last 30 days, stepping up by at most ten percent", "Recovery weeks and the taper stay in place; the race never moves"],
        shot: shot("coach-pitch", "A pitch card: what the full review would change and why, with Run the full review and Not now.", 339, 625),
      },
      {
        id: "models", title: "Built across the leading models", short: "The right model for each job, and the newest as they arrive",
        body: ["The coach works across the leading AI models. Everyday questions go to a fast model; whole-plan reviews go to the strongest one available. If a model is down, the next one in line answers.", "New versions are picked up as they are released, so the coach gets stronger without you changing anything. Your data, the library and the safety check stay the same whichever model answers."],
        chips: [{ name: "DeepSeek", role: "Questions" }, { name: "Gemini Flash", role: "Questions, backup" }, { name: "Claude", role: "Plan reviews" }, { name: "GPT", role: "Plan reviews, backup" }, { name: "Gemini Pro", role: "Plan reviews, backup" }],
      },
      {
        id: "limits", title: "Limits", short: "What the coach will not do",
        body: ["A fixed check runs before any question reaches the model: chest pain, fainting, breathlessness at rest and similar signs get one answer, stop and see a doctor. The coach gives no daily readiness score and does not tell you to skip training over one night's sleep. Medical, injury and nutrition questions get general guidance and a referral when something persists."],
        facts: ["Your data is the only context the model gets", "Forty messages a day per account", "Only you can see your data"],
      },
    ],
  },
];

export const productBySlug = (slug: string) => PRODUCT.find((p) => p.slug === slug);
