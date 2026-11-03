// Stand-in for Polar Flow sign-in, the AccessLink API (v3) and its webhooks, for testing without a Polar account.
//   node scripts/mock-polar.js            (port 4017)
// Point the app at it: POLAR_CLIENT_ID=x POLAR_CLIENT_SECRET=polar-secret POLAR_WEBHOOK_SECRET=polar-hook
//   POLAR_AUTH_URL=http://localhost:4017/oauth2/authorization POLAR_TOKEN_URL=http://localhost:4017/v2/oauth2/token
//   POLAR_API=http://localhost:4017/v3
// Test controls: GET /debug; POST /debug/reset; POST /debug/send {url, event, entity_id?, date?} posts a signed
// webhook to the app; POST /debug/add-exercise {...} adds an exercise and returns it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHmac } = require("crypto");
const PORT = Number(process.env.PORT || 4017);
const CLIENT = process.env.POLAR_CLIENT_ID || "x", SECRET = process.env.POLAR_CLIENT_SECRET || "polar-secret";
const HOOK = process.env.POLAR_WEBHOOK_SECRET || "polar-hook";
const USER = 475;

let access, calls, registered, exercises, nights, recharges, physical, seq, webhooks, deregistered;
const DAY = 86400000;
const local = (ms) => new Date(ms + 3600000).toISOString().slice(0, 23); // Europe/Berlin in November, no offset in the text
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
function reset() {
  access = new Set(); calls = 0; registered = new Set(); seq = 0; webhooks = []; deregistered = [];
  exercises = []; nights = []; recharges = [];
  physical = { weight: 74.5, height: 181, vo2_max: 51, resting_heart_rate: 47, modified: "2026-10-28T06:00:00.000Z" };
  const base = Date.parse("2026-11-02T00:00:00Z");
  for (let d = 0; d < 35; d++) {
    const day = base - d * DAY;
    if (d % 3 !== 1) {
      const ride = d % 10 === 3, swim = d % 7 === 5, secs = ride ? 9000 : swim ? 2700 : 2700 + (d % 4) * 600;
      exercises.push({ id: `pl${1000 + d}`, upload_time: new Date(day + 7 * 3600000).toISOString(), polar_user: `https://www.polaraccesslink.com/v3/users/${USER}`, device: "Vantage V3", device_id: "1111AAAA", start_time: local(day + 5.5 * 3600000), start_time_utc_offset: 60, duration: `PT${Math.floor(secs / 3600) ? `${Math.floor(secs / 3600)}H` : ""}${Math.floor((secs % 3600) / 60)}M${secs % 60}S`,
        calories: ride ? 1180 : 500, distance: ride ? 48000 : swim ? 1800 : 9600 + d * 10, heart_rate: { average: ride ? 136 : 147, maximum: 171 }, training_load: 120, sport: ride ? "CYCLING" : swim ? "SWIMMING" : "RUNNING", has_route: !swim, detailed_sport_info: ride ? "ROAD_BIKING" : swim ? "POOL_SWIMMING" : "RUNNING" });
    }
    nights.push({ polar_user: `https://www.polaraccesslink.com/v3/users/${USER}`, date: ymd(day), sleep_start_time: `${ymd(day - DAY)}T23:02:00+01:00`, sleep_end_time: `${ymd(day)}T06:41:00+01:00`, device_id: "1111AAAA", light_sleep: 13200, deep_sleep: 6300 + (d % 4) * 300, rem_sleep: 5700, unrecognized_sleep_stage: 0, sleep_score: 78 + (d % 5), total_interruption_duration: 1500 });
    recharges.push({ polar_user: `https://www.polaraccesslink.com/v3/users/${USER}`, date: ymd(day), heart_rate_avg: 47 + (d % 3), beat_to_beat_avg: 1250, heart_rate_variability_avg: 58 + (d % 6), breathing_rate_avg: 13.1, nightly_recharge_status: (d % 7) - 3, ans_charge: 1.2 });
  }
}
reset();

const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const basicOk = (req) => (req.headers.authorization || "") === `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString("base64")}`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") return send(res, 200, { calls, access: [...access], registered: [...registered], exercises: exercises.length, webhooks, deregistered });
  if (p === "/debug/reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/debug/add-exercise") {
    const b = JSON.parse(raw || "{}"); const id = `pl${9000 + ++seq}`; const start = Date.parse(b.start || "2026-11-03T12:00:00Z"); const secs = b.secs || 2400;
    const x = { id, start_time: local(start), start_time_utc_offset: 60, duration: `PT${Math.floor(secs / 60)}M${secs % 60}S`, calories: 400, distance: b.metres || 7000, heart_rate: { average: 150, maximum: 172 }, sport: b.sport || "RUNNING", detailed_sport_info: b.sport || "RUNNING", device: "Vantage V3" };
    exercises.unshift(x); return send(res, 200, x);
  }
  if (p === "/debug/send") {
    const b = JSON.parse(raw || "{}");
    const body = JSON.stringify({ event: b.event || "EXERCISE", user_id: USER, ...(b.entity_id ? { entity_id: b.entity_id, url: `${url.origin}/v3/exercises/${b.entity_id}` } : {}), ...(b.date ? { date: b.date } : {}), timestamp: new Date().toISOString() });
    const sig = createHmac("sha256", HOOK).update(body).digest("hex");
    const r = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json", "Polar-Webhook-Event": b.event || "EXERCISE", "Polar-Webhook-Signature": sig }, body });
    return send(res, 200, { status: r.status });
  }

  // ---------- sign-in ----------
  if (p === "/oauth2/authorization") {
    const redirect = new URL(url.searchParams.get("redirect_uri")); redirect.searchParams.set("code", "pl-code-" + (++seq)); redirect.searchParams.set("state", url.searchParams.get("state") || "");
    res.writeHead(302, { Location: redirect.toString() }); return res.end();
  }
  if (p === "/v2/oauth2/token") {
    if (!basicOk(req)) return send(res, 401, { error: "invalid_client" });
    const b = Object.fromEntries(new URLSearchParams(raw));
    if (b.grant_type !== "authorization_code") return send(res, 400, { error: "unsupported_grant_type" });
    const a = `pl-access-${++seq}`; access.add(a);
    return send(res, 200, { access_token: a, token_type: "bearer", expires_in: 315359999, x_user_id: USER });
  }

  // ---------- webhook management (client credentials) ----------
  if (p === "/v3/webhooks") {
    if (!basicOk(req)) return send(res, 401, { error: "invalid_client" });
    if (req.method === "POST") { const b = JSON.parse(raw || "{}"); const w = { id: `wh${++seq}`, events: b.events, url: b.url, active: true }; webhooks.push(w); return send(res, 201, { data: { ...w, signature_secret_key: HOOK } }); }
    return send(res, 200, { data: webhooks });
  }

  // ---------- API (athlete token) ----------
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!access.has(tok)) return send(res, 401, { error: "unauthorized" });
  calls++;
  if (p === "/v3/users" && req.method === "POST") { const b = JSON.parse(raw || "{}"); if (registered.has(USER)) return send(res, 409, { error: "already registered" }); registered.add(USER); return send(res, 200, { "polar-user-id": USER, "member-id": b["member-id"], "registration-date": new Date().toISOString() }); }
  if (p === `/v3/users/${USER}` && req.method === "DELETE") { deregistered.push(USER); registered.delete(USER); access.clear(); return send(res, 204); }
  if (p === `/v3/users/${USER}`) return send(res, 200, { "polar-user-id": USER, "member-id": "velocity", "first-name": "Eva" });
  if (p === "/v3/exercises") return send(res, 200, exercises);
  const one = /^\/v3\/exercises\/([^/]+)$/.exec(p);
  if (one) { const x = exercises.find((e) => e.id === one[1]); return x ? send(res, 200, x) : send(res, 404, { error: "not found" }); }
  if (p === "/v3/users/sleep") return send(res, 200, { nights });
  const night = /^\/v3\/users\/sleep\/(\d{4}-\d{2}-\d{2})$/.exec(p);
  if (night) { const n = nights.find((x) => x.date === night[1]); return n ? send(res, 200, n) : send(res, 404, { error: "not found" }); }
  if (p === "/v3/users/nightly-recharge") return send(res, 200, { recharges });
  if (p === "/v3/users/physical-info") return send(res, 200, physical);
  send(res, 404, { error: `no route ${req.method} ${p}` });
}).listen(PORT, () => console.log(`stand-in Polar on ${PORT}`));
