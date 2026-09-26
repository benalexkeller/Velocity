// Store placeholder: curated products from known brands. Checkout happens on the brand's own site.
// Prices are not shown on purpose — they change; the brand page is the source of truth.
export type Category = "Wearables" | "Bike" | "Indoor" | "Run" | "Swim" | "Nutrition" | "Kit";
export interface Product { id: string; category: Category; brand: string; name: string; what: string; url: string; plan?: string }

export const CATEGORIES: Category[] = ["Wearables", "Bike", "Indoor", "Run", "Swim", "Nutrition", "Kit"];

export const PRODUCTS: Product[] = [
  { id: "fr970", category: "Wearables", brand: "Garmin", name: "Forerunner 970", what: "Multisport GPS watch. Swim, bike, run, triathlon mode, HRV and training-load tracking.", url: "https://www.garmin.com", plan: "Syncs to Velocity" },
  { id: "fenix8", category: "Wearables", brand: "Garmin", name: "fēnix 8", what: "Multisport watch with longer battery and mapping. Same data as the Forerunner in a heavier case.", url: "https://www.garmin.com", plan: "Syncs to Velocity" },
  { id: "hrmpro", category: "Wearables", brand: "Garmin", name: "HRM-Pro Plus", what: "Chest strap. More accurate heart rate than the wrist, plus running dynamics. Stores swim HR.", url: "https://www.garmin.com" },
  { id: "whoop", category: "Wearables", brand: "WHOOP", name: "WHOOP 5.0", what: "Screenless band for sleep, HRV and resting HR. Worn 24/7; subscription based.", url: "https://www.whoop.com", plan: "Sync planned" },
  { id: "kickr", category: "Indoor", brand: "Wahoo", name: "KICKR CORE", what: "Direct-drive smart trainer. Controls resistance from Zwift or a workout; measures power.", url: "https://www.wahoofitness.com", plan: "Weekday rides in Base 3" },
  { id: "zwift", category: "Indoor", brand: "Zwift", name: "Zwift membership", what: "Virtual riding and structured workouts on the trainer. Pairs with the KICKR and the watch.", url: "https://www.zwift.com" },
  { id: "rally", category: "Bike", brand: "Garmin", name: "Rally RS200", what: "Dual-sided power-meter pedals. Power is the bike's pace: it makes the Zones calculator usable outdoors.", url: "https://www.garmin.com" },
  { id: "speedmax", category: "Bike", brand: "Canyon", name: "Speedmax CF", what: "Triathlon bike with integrated storage and aero position. Sold direct.", url: "https://www.canyon.com" },
  { id: "gp5000", category: "Bike", brand: "Continental", name: "Grand Prix 5000 S TR", what: "Tubeless road tire with low rolling resistance. 28 mm for most rims.", url: "https://www.continental-tires.com" },
  { id: "aerobars", category: "Bike", brand: "Profile Design", name: "Sonic Ergo aerobars", what: "Clip-on aerobars for a road bike. The cheapest route to an aero position.", url: "https://www.profile-design.com" },
  { id: "clifton", category: "Run", brand: "HOKA", name: "Clifton 10", what: "Cushioned daily trainer. Most of the plan's easy miles.", url: "https://www.hoka.com", plan: "Easy runs" },
  { id: "novablast", category: "Run", brand: "ASICS", name: "Novablast 5", what: "Bouncy daily trainer for easy and long runs.", url: "https://www.asics.com", plan: "Long runs" },
  { id: "speed4", category: "Run", brand: "Saucony", name: "Endorphin Speed 4", what: "Nylon-plated tempo shoe. Intervals and tempo sessions.", url: "https://www.saucony.com", plan: "Tempo · intervals" },
  { id: "vaporfly", category: "Run", brand: "Nike", name: "Vaporfly 4", what: "Carbon-plated race shoe. Race day and race simulations only.", url: "https://www.nike.com", plan: "Race day" },
  { id: "maverick", category: "Swim", brand: "ROKA", name: "Maverick wetsuit", what: "Full-sleeve triathlon wetsuit. Legal below 76.1 °F water temperature.", url: "https://www.roka.com", plan: "Race day if wetsuit-legal" },
  { id: "athlex", category: "Swim", brand: "Orca", name: "Athlex Flex wetsuit", what: "Flexible-shoulder triathlon wetsuit for swimmers who want less restriction.", url: "https://www.orca.com" },
  { id: "form", category: "Swim", brand: "FORM", name: "Smart Swim 2 goggles", what: "Goggles with a heads-up display: pace, distance and heart rate while swimming.", url: "https://www.formswim.com" },
  { id: "r1", category: "Swim", brand: "ROKA", name: "R1 goggles", what: "Open-water goggles with wide field of view and anti-fog lenses.", url: "https://www.roka.com" },
  { id: "paddles", category: "Swim", brand: "TYR", name: "Catalyst 2 paddles", what: "Hand paddles for technique and strength sets.", url: "https://www.tyr.com", plan: "Technique sessions" },
  { id: "maurten", category: "Nutrition", brand: "Maurten", name: "Gel 100", what: "25 g carbohydrate hydrogel per gel. Mild taste, low GI load.", url: "https://www.maurten.com", plan: "Run fueling" },
  { id: "pf90", category: "Nutrition", brand: "Precision Fuel & Hydration", name: "PF 90 Gel", what: "90 g carbohydrate in one gel for bike fueling at 90 g/h.", url: "https://www.precisionhydration.com", plan: "Bike fueling" },
  { id: "ph1500", category: "Nutrition", brand: "Precision Fuel & Hydration", name: "PH 1500 electrolytes", what: "1500 mg sodium per litre for high sweat-sodium athletes and hot races.", url: "https://www.precisionhydration.com", plan: "Texas heat" },
  { id: "skratch", category: "Nutrition", brand: "Skratch Labs", name: "Sport Hydration Mix", what: "Lighter drink mix: 20 g carbohydrate and 380 mg sodium per 500 ml.", url: "https://www.skratchlabs.com" },
  { id: "betafuel", category: "Nutrition", brand: "Science in Sport", name: "Beta Fuel 80", what: "80 g carbohydrate drink mix, glucose:fructose 1:0.8.", url: "https://www.scienceinsport.com" },
  { id: "trisuit", category: "Kit", brand: "Castelli", name: "Free Sanremo 2 tri suit", what: "One-piece tri suit, sleeved. Worn swim to run.", url: "https://www.castelli-cycling.com", plan: "Race day" },
  { id: "zoot", category: "Kit", brand: "Zoot", name: "Ultra tri suit", what: "Two-piece tri kit alternative to a one-piece suit.", url: "https://www.zootsports.com" },
  { id: "helmet", category: "Kit", brand: "Rudy Project", name: "Nytron aero helmet", what: "Aero road helmet. Cheaper watt savings than most bike upgrades.", url: "https://www.rudyproject.com" },
  { id: "sunglasses", category: "Kit", brand: "ROKA", name: "Matador sunglasses", what: "Lightweight sport sunglasses that stay put on the bike and run.", url: "https://www.roka.com" },
];
