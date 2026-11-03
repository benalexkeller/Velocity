// Stand-in for WHOOP's sign-in, API v2 and webhooks, for testing without a WHOOP account.
//   node scripts/mock-whoop.js            (port 4014)
// Point the app at it: WHOOP_CLIENT_ID=x WHOOP_CLIENT_SECRET=whoop-secret
//   WHOOP_AUTH_URL=http://localhost:4014/oauth/oauth2/auth WHOOP_TOKEN_URL=http://localhost:4014/oauth/oauth2/token
//   WHOOP_API=http://localhost:4014/developer
// Test controls: GET /debug (tokens, calls); POST /debug/reset; POST /debug/revoke (the member removed Velocity);
// POST /debug/deny (next sign-in is refused); POST /debug/send {url, type, id} posts a signed webhook to the app;
// POST /debug/add-workout {...} adds a workout and returns it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHmac, randomUUID } = require("crypto");
const PORT = Number(process.env.PORT || 4014);
const SECRET = process.env.WHOOP_CLIENT_SECRET || "whoop-secret";
const MEMBER = 10101;

let access, refresh, calls, deny, workouts, sleeps, recoveries, cycles, seq;
const iso = (d) => new Date(d).toISOString();
const DAY = 86400000;
function reset() {
  access = new Set(); refresh = new Set(); calls = 0; deny = false; seq = 0;
  // the member's last 40 days in Europe/Berlin (offset +01:00 in November)
  const base = Date.parse("2026-11-02T00:00:00Z");
  workouts = []; sleeps = []; recoveries = []; cycles = [];
  for (let d = 0; d < 40; d++) {
    const day = base - d * DAY;
    const cycleId = 500000 - d;
    // sleep 23:00 → 06:40 next morning (the "day" is the morning it ends)
    const sleepId = randomUUID();
    sleeps.push({ id: sleepId, cycle_id: cycleId, user_id: MEMBER, created_at: iso(day), updated_at: iso(day), start: iso(day - 3 * 3600000 + 22 * 3600000 - DAY), end: iso(day + 5 * 3600000 + 40 * 60000), timezone_offset: "+01:00", nap: false, score_state: "SCORED",
      score: { stage_summary: { total_in_bed_time_milli: 27600000, total_awake_time_milli: 1800000, total_no_data_time_milli: 0, total_light_sleep_time_milli: 12600000, total_slow_wave_sleep_time_milli: 7200000, total_rem_sleep_time_milli: 6000000, sleep_cycle_count: 5, disturbance_count: 8 }, sleep_needed: { baseline_milli: 28000000 }, respiratory_rate: 15.1, sleep_performance_percentage: 88 - (d % 7), sleep_consistency_percentage: 80, sleep_efficiency_percentage: 93 } });
    recoveries.push({ cycle_id: cycleId, sleep_id: sleepId, user_id: MEMBER, created_at: iso(day), updated_at: iso(day), score_state: "SCORED", score: { user_calibrating: false, recovery_score: 60 + (d * 7) % 35, resting_heart_rate: 46 + (d % 4), hrv_rmssd_milli: 70 + (d * 3) % 25, spo2_percentage: 97, skin_temp_celsius: 33.1 } });
    cycles.push({ id: cycleId, user_id: MEMBER, created_at: iso(day), updated_at: iso(day), start: iso(day + 5 * 3600000 + 40 * 60000), end: d === 0 ? null : iso(day + DAY + 5 * 3600000), timezone_offset: "+01:00", score_state: "SCORED", score: { strain: 8 + (d * 5) % 12, kilojoule: 9000, average_heart_rate: 62, max_heart_rate: 171 } });
    // a run most days at 06:30 local (05:30Z), 45–75 min; a ride on day 3 and 10
    if (d % 3 !== 1) workouts.push({ id: randomUUID(), v1_id: 9000 + d, user_id: MEMBER, created_at: iso(day), updated_at: iso(day), start: iso(day + 5.5 * 3600000), end: iso(day + 5.5 * 3600000 + (45 + (d % 4) * 10) * 60000), timezone_offset: "+01:00", sport_name: d % 10 === 3 ? "cycling" : "running", sport_id: d % 10 === 3 ? 1 : 0, score_state: "SCORED",
      score: { strain: 10.5 + (d % 5), average_heart_rate: 148, max_heart_rate: 176, kilojoule: 2500, percent_recorded: 100, distance_meter: d % 10 === 3 ? 40200 : 9650 + d * 10, altitude_gain_meter: 120, altitude_change_meter: 0, zone_durations: { zone_zero_milli: 0, zone_one_milli: 600000, zone_two_milli: 1800000, zone_three_milli: 900000, zone_four_milli: 300000, zone_five_milli: 0 } } });
  }
  // a swim recorded on an Apple Watch too? no: one unscored workout, to be skipped for score but kept for time
  workouts.push({ id: randomUUID(), user_id: MEMBER, created_at: iso(base), updated_at: iso(base), start: iso(base + 17 * 3600000), end: iso(base + 17 * 3600000 + 50 * 60000), timezone_offset: "+01:00", sport_name: "swimming", sport_id: 2, score_state: "PENDING_SCORE", score: null });
}
reset();

const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const newTokens = () => { const a = `wh-access-${++seq}`, r = `wh-refresh-${seq}`; access.add(a); refresh.add(r); return { a, r }; };
const page = (list, url) => {
  const start = url.searchParams.get("start"), end = url.searchParams.get("end"), limit = Math.min(25, Number(url.searchParams.get("limit") || 10));
  const sorted = [...list].filter((x) => (!start || x.start >= start || (x.updated_at && !x.start)) && (!end || !x.start || x.start < end)).sort((a, b) => String(b.start ?? b.created_at).localeCompare(String(a.start ?? a.created_at)));
  const from = Number(url.searchParams.get("nextToken") || 0);
  const records = sorted.slice(from, from + limit);
  return { records, next_token: from + limit < sorted.length ? String(from + limit) : null };
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") return send(res, 200, { calls, access: [...access], refresh: [...refresh], workouts: workouts.length, sleeps: sleeps.length });
  if (p === "/debug/reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/debug/revoke") { access.clear(); refresh.clear(); return send(res, 200, { ok: true }); }
  if (p === "/debug/deny") { deny = true; return send(res, 200, { ok: true }); }
  if (p === "/debug/add-workout") {
    const b = raw ? JSON.parse(raw) : {};
    const w = { id: randomUUID(), user_id: MEMBER, created_at: iso(Date.now()), updated_at: iso(Date.now()), start: b.start, end: b.end, timezone_offset: b.timezone_offset || "+01:00", sport_name: b.sport_name || "running", sport_id: 0, score_state: "SCORED", score: { strain: b.strain ?? 9.1, average_heart_rate: b.average_heart_rate ?? 150, max_heart_rate: 180, kilojoule: 2000, percent_recorded: 100, distance_meter: b.distance_meter ?? null, altitude_gain_meter: b.altitude_gain_meter ?? null, altitude_change_meter: 0, zone_durations: {} } };
    workouts.push(w);
    return send(res, 200, w);
  }
  if (p === "/debug/delete-workout") { const b = JSON.parse(raw); workouts = workouts.filter((w) => w.id !== b.id); return send(res, 200, { ok: true }); }
  if (p === "/debug/send") {
    // posts a signed v2 webhook to the app, like WHOOP does
    const b = JSON.parse(raw);
    const body = JSON.stringify({ user_id: MEMBER, id: b.id, type: b.type, trace_id: randomUUID() });
    const ts = String(Date.now());
    const sig = createHmac("sha256", b.secret || SECRET).update(ts + body).digest("base64");
    const r = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json", "X-WHOOP-Signature": b.badSignature ? "nope" : sig, "X-WHOOP-Signature-Timestamp": ts }, body });
    return send(res, 200, { status: r.status, body: await r.text() });
  }

  // ---------- sign-in ----------
  if (p === "/oauth/oauth2/auth") {
    const to = new URL(url.searchParams.get("redirect_uri"));
    to.searchParams.set("state", url.searchParams.get("state") ?? "");
    if ((url.searchParams.get("state") ?? "").length < 8) { to.searchParams.set("error", "invalid_request"); to.searchParams.set("error_description", "state too short"); }
    else if (deny) { deny = false; to.searchParams.set("error", "access_denied"); }
    else to.searchParams.set("code", "wh-code-1");
    res.writeHead(302, { Location: to.toString() }); return res.end();
  }
  if (p === "/oauth/oauth2/token") {
    const f = new URLSearchParams(raw);
    if (f.get("client_secret") !== SECRET) return send(res, 401, { error: "invalid_client" });
    if (f.get("grant_type") === "authorization_code") {
      if (f.get("code") !== "wh-code-1") return send(res, 400, { error: "invalid_grant", error_description: "bad code" });
      const t = newTokens();
      return send(res, 200, { access_token: t.a, expires_in: 3600, refresh_token: t.r, scope: "offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout", token_type: "bearer" });
    }
    if (f.get("grant_type") === "refresh_token") {
      const old = f.get("refresh_token");
      if (!refresh.has(old)) return send(res, 400, { error: "invalid_grant", error_description: "refresh token invalid" });
      // WHOOP cancels the old pair at once
      refresh.delete(old); for (const a of [...access]) if (a.endsWith(old.replace("wh-refresh-", ""))) access.delete(a);
      const t = newTokens();
      return send(res, 200, { access_token: t.a, expires_in: 3600, refresh_token: t.r, scope: "offline read:profile", token_type: "bearer" });
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  // ---------- API ----------
  if (!p.startsWith("/developer/")) return send(res, 404, {});
  const token = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!access.has(token)) return send(res, 401, { error: "unauthorized" });
  calls++;
  const rest = p.slice("/developer".length);
  if (rest === "/v2/user/profile/basic") return send(res, 200, { user_id: MEMBER, email: "athlete@example.com", first_name: "Eva", last_name: "Wedekind" });
  if (rest === "/v2/user/measurement/body") return send(res, 200, { height_meter: 1.72, weight_kilogram: 64.2, max_heart_rate: 190 });
  if (rest === "/v2/user/access" && req.method === "DELETE") { access.delete(token); refresh.clear(); res.writeHead(204); return res.end(); }
  if (rest === "/v2/activity/workout") return send(res, 200, page(workouts, url));
  if (rest === "/v2/activity/sleep") return send(res, 200, page(sleeps, url));
  if (rest === "/v2/recovery") {
    // recoveries are sorted by their sleep's start
    const withStart = recoveries.map((r) => ({ ...r, start: sleeps.find((x) => x.id === r.sleep_id)?.start }));
    const pg = page(withStart, url);
    return send(res, 200, { ...pg, records: pg.records.map((r) => { const { start: _s, ...rest } = r; return rest; }) });
  }
  if (rest === "/v2/cycle") return send(res, 200, page(cycles, url));
  let m;
  if ((m = /^\/v2\/activity\/workout\/([\w-]+)$/.exec(rest))) { const w = workouts.find((x) => x.id === m[1]); return w ? send(res, 200, w) : send(res, 404, { error: "not found" }); }
  if ((m = /^\/v2\/activity\/sleep\/([\w-]+)$/.exec(rest))) { const s = sleeps.find((x) => x.id === m[1]); return s ? send(res, 200, s) : send(res, 404, { error: "not found" }); }
  if ((m = /^\/v2\/cycle\/(\d+)\/recovery$/.exec(rest))) { const r = recoveries.find((x) => x.cycle_id === Number(m[1])); return r ? send(res, 200, r) : send(res, 404, { error: "not found" }); }
  if ((m = /^\/v2\/cycle\/(\d+)$/.exec(rest))) { const c = cycles.find((x) => x.id === Number(m[1])); return c ? send(res, 200, c) : send(res, 404, { error: "not found" }); }
  return send(res, 404, { error: `not handled: ${req.method} ${rest}` });
}).listen(PORT, () => console.log(`mock WHOOP on ${PORT}`));
