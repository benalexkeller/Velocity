// A stand-in for OpenRouter used only to take the product screenshots (scripts/product-shots.js): canned coach
// answers so the rail shows a chat, a citation, a proposal and a pitch without spending model calls.
// Run:  OPENROUTER_API_KEY=x OPENROUTER_BASE_URL=http://localhost:3999/v1 npx next start -p 3111
const http = require("http");
http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
    try {
      const j = JSON.parse(body);
      const last = j.messages[j.messages.length - 1].content.toLowerCase();
      const sys = j.messages.filter((m) => m.role === "system").map((m) => m.content);
      const ctx = JSON.parse(sys.find((c) => c.startsWith("Athlete data"))?.split("\n").slice(1).join("\n") || "{}");
      const tools = (j.tools || []).map((t) => t.function.name);
      const tomorrow = (ctx.sessions || []).find((s) => s.date > ctx.today && s.sport !== "rest");
      let message;
      if (/today/.test(last)) {
        message = { role: "assistant", content: "Swim, 90 min at 06:30, Zone 2. Target 2:00 to 2:10 per 100 yd. Main set 3 × 400 steady with a minute easy between, then 30 min easy on the bike in the evening. An easy day; Thursday's brick is the hard one this week." };
      } else if (/last week/.test(last)) {
        message = { role: "assistant", content: "Last week: 5 of 6 sessions, 7.9 of 8.5 h, load 395 of 410. The long ride came in at 1:55 against 2:15 planned; everything else went to plan, and the run pace sat inside the target corridor all week. This week is Base 2, week 2: 9.0 h with the long ride at 2:30 on Saturday. Nothing to change. Hold the easy range on Saturday and the 2:30 is yours." };
      } else if (/review this activity/.test(last)) {
        const pace = (last.match(/(\d+:\d+) ?\/mi/) || [])[1] || "10:15";
        message = { role: "assistant", content: `On plan, and easy where it should be.\n- Pace **${pace} /mi**, inside the 10:15-11:15 easy range\n- Heart rate **140 bpm**, 15 below threshold\n- Duration matched the plan to the minute\nKeep Saturday's long ride just as easy; the run off the bike is where to hold back.` };
      } else if (/stretch/.test(last)) {
        message = { role: "assistant", content: "Easy ones, nothing forced for 48 hours.\n- **Wall calf stretch**, straight knee, 3 × 30 s each side\n- **Bent-knee version** for the soleus, 3 × 30 s\n- **Foam roll** the calf, 2 min each, before the stretches\nWalk tomorrow, swim Wednesday as planned. If the cramp comes back at the right pace, we look at sodium." };
      } else if (/cramp/.test(last)) {
        message = { role: "assistant", content: "That was the pace, not the salt.\n- Last 3 miles at **9:50 /mi** against a 10:15-11:15 target\n- Longest run in 30 days: **13.1 mi**, up from 11.2\n- Sodium intake is not in your data, so no reason to blame it yet\nNext long run, hold the easy range. Calf raises go in twice a week from Monday. [L1]" };
      } else if (/\blog\b|\bate\b|\bhad\b/.test(last) && tools.includes("log_meal")) {
        const y = new Date(ctx.today + "T12:00:00"); y.setDate(y.getDate() - 1);
        const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
        const date = /last night|yesterday/.test(last) ? yd : ctx.today;
        const meal = /last night|dinner/.test(last) ? "dinner" : /lunch/.test(last) ? "lunch" : /breakfast/.test(last) ? "breakfast" : "other";
        const lib = (ctx.nutrition?.library || []).find((m) => /chicken/.test(last) ? m.id === "chicken-rice" : /oat/.test(last) ? m.id === "oats-banana" : false);
        const day = (ctx.nutrition?.days || []).find((d) => d.date === date);
        const carbs = (day?.eaten?.carbs_g ?? 0) + (lib?.carbs_g ?? 60);
        const tail = day?.targets ? ` That puts ${date === ctx.today ? "today" : "yesterday"} at ${carbs} g of the ${day.targets.carbs_g} g carb target.` : "";
        message = { role: "assistant", content: `Logged under ${meal}.${tail}`, tool_calls: [{ id: "c3", type: "function", function: { name: "log_meal", arguments: JSON.stringify({ items: [lib ? { date, meal, library_id: lib.id, servings: 1 } : { date, meal, name: "Meal", kcal: 600, carbs_g: 60, protein_g: 35, fat_g: 20 }] }) } }] };
      } else if (/after work|move/.test(last) && tools.includes("propose_plan_change") && tomorrow) {
        message = { role: "assistant", content: `Moved to ${ctx.athlete?.availability?.weekday_pm ?? "18:00"}, your evening slot. Same session, same duration.`, tool_calls: [{ id: "c1", type: "function", function: { name: "propose_plan_change", arguments: JSON.stringify({ summary: `${tomorrow.sport[0].toUpperCase() + tomorrow.sport.slice(1)} tomorrow to ${ctx.athlete?.availability?.weekday_pm ?? "18:00"}.`, reason: "You asked for after work; your evening availability is " + (ctx.athlete?.availability?.weekday_pm ?? "18:00") + ".", changes: [{ kind: "move", sessionId: tomorrow.id, date: tomorrow.date, start: ctx.athlete?.availability?.weekday_pm ?? "18:00" }] }) } }] };
      } else if (/missed|cold|two weeks/.test(last) && tools.includes("request_restructure")) {
        message = { role: "assistant", content: "Two weeks out is more than a patch. Here is what I would change; the full review runs only if you want it.", tool_calls: [{ id: "c2", type: "function", function: { name: "request_restructure", arguments: JSON.stringify({ pitch: "Long rides restart at 1:30 and climb 15 min a week instead of jumping back to 2:30; the long run restarts at 1:10. Base 2 is extended by one week and the recovery week moves with it. The taper and the race stay where they are.", reason: "Longest ride in the last 30 days: 1:10, the plan has 2:30 this Saturday; longest run 55 min against 1:30." }) } }] };
      } else {
        message = { role: "assistant", content: "Not in your data. Log the session and ask again." };
      }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ choices: [{ message }] }));
    } catch (e) { res.statusCode = 400; res.end(String(e)); }
  });
}).listen(3999, () => console.log("mock coach on 3999"));
