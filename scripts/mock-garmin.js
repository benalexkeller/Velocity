// Stand-in for Garmin's own program (OAuth 2.0 PKCE sign-in, Health and Activity API pushes), for testing before
// Garmin approves the app.
//   node scripts/mock-garmin.js            (port 4015)
// Point the app at it: GARMIN_CLIENT_ID=x GARMIN_CLIENT_SECRET=garmin-secret GARMIN_WEBHOOK_SECRET=hook123
//   GARMIN_AUTH_URL=http://localhost:4015/oauth2Confirm GARMIN_TOKEN_URL=http://localhost:4015/oauth/token
//   GARMIN_API=http://localhost:4015/wellness-api/rest
// Test controls: GET /debug; POST /debug/reset; POST /debug/revoke; POST /debug/deny;
// POST /debug/push {url, kinds: ["activities","dailies",...], userId?} posts a push to the app like Garmin does;
// POST /debug/push-raw {url, body} posts any body.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash } = require("crypto");
const PORT = Number(process.env.PORT || 4015);
const SECRET = process.env.GARMIN_CLIENT_SECRET || "garmin-secret";
const USER = "garmin-user-abc123";

let access, refresh, calls, deny, seq, challenge, backfills;
function reset() { access = new Set(); refresh = new Set(); calls = 0; deny = false; seq = 0; challenge = null; backfills = []; }
reset();

const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const newTokens = () => { const a = `ga-access-${++seq}`, r = `ga-refresh-${seq}`; access.add(a); refresh.add(r); return { a, r }; };

// ---------- sample pushes (Europe/Berlin, +3600 s) ----------
const T = Date.parse("2026-11-02T05:30:00Z") / 1000; // 06:30 local
const samples = (n) => Array.from({ length: n }, (_, i) => ({ startTimeInSeconds: T + i * 30, latitudeInDegree: 52.52 + i * 0.0004, longitudeInDegree: 13.405 + i * 0.0006, elevationInMeters: 40 + i, heartRate: 140 + (i % 20), speedMetersPerSecond: 3.1, totalDistanceInMeters: i * 93 }));
const KINDS = {
  activities: (userId) => [
    { userId, summaryId: "act-1001", activityId: 1001, activityName: "Morning Run", activityType: "RUNNING", startTimeInSeconds: T, startTimeOffsetInSeconds: 3600, durationInSeconds: 3720, distanceInMeters: 10140, averageHeartRateInBeatsPerMinute: 149, maxHeartRateInBeatsPerMinute: 171, activeKilocalories: 690, totalElevationGainInMeters: 85, deviceName: "Forerunner 965", manual: false },
    { userId, summaryId: "act-1002", activityId: 1002, activityName: "Pool Swim", activityType: "LAP_SWIMMING", startTimeInSeconds: T + 86400 + 12 * 3600, startTimeOffsetInSeconds: 3600, durationInSeconds: 2700, distanceInMeters: 1763, averageHeartRateInBeatsPerMinute: 128, activeKilocalories: 410 },
    // a brick: the parent carries nothing, its two legs carry the data
    { userId, summaryId: "act-1003", activityId: 1003, activityName: "Brick", activityType: "MULTI_SPORT", startTimeInSeconds: T + 2 * 86400, startTimeOffsetInSeconds: 3600, durationInSeconds: 9000, isParent: true },
    { userId, summaryId: "act-1004", activityId: 1004, activityName: "Brick Ride", activityType: "ROAD_BIKING", startTimeInSeconds: T + 2 * 86400, startTimeOffsetInSeconds: 3600, durationInSeconds: 6000, distanceInMeters: 48000, averageHeartRateInBeatsPerMinute: 138, parentSummaryId: "act-1003", totalElevationGainInMeters: 410 },
    { userId, summaryId: "act-1005", activityId: 1005, activityName: "Brick Run", activityType: "RUNNING", startTimeInSeconds: T + 2 * 86400 + 6100, startTimeOffsetInSeconds: 3600, durationInSeconds: 2700, distanceInMeters: 7200, averageHeartRateInBeatsPerMinute: 156, parentSummaryId: "act-1003" },
  ],
  activityDetails: (userId) => [{ userId, summaryId: "act-1001", activityId: 1001, summary: KINDS.activities(userId)[0], samples: samples(124) }],
  manuallyUpdatedActivities: (userId) => [{ ...KINDS.activities(userId)[0], activityName: "Morning Run (renamed)" }],
  dailies: (userId) => [
    { userId, summaryId: "d-20261102", calendarDate: "2026-11-02", startTimeInSeconds: T - 5.5 * 3600, startTimeOffsetInSeconds: 3600, activityType: "WALKING", durationInSeconds: 86400, steps: 11234, restingHeartRateInBeatsPerMinute: 44, averageStressLevel: 27, maxStressLevel: 81, bodyBatteryChargedValue: 78, bodyBatteryDrainedValue: 60 },
    { userId, summaryId: "d-20261101", calendarDate: "2026-11-01", startTimeInSeconds: T - 5.5 * 3600 - 86400, startTimeOffsetInSeconds: 3600, activityType: "WALKING", durationInSeconds: 86400, steps: 8211, restingHeartRateInBeatsPerMinute: 46, averageStressLevel: 31 },
  ],
  sleeps: (userId) => [{ userId, summaryId: "s-20261102", calendarDate: "2026-11-02", startTimeInSeconds: T - 7.5 * 3600, startTimeOffsetInSeconds: 3600, durationInSeconds: 26400, unmeasurableSleepInSeconds: 0, deepSleepDurationInSeconds: 6300, lightSleepDurationInSeconds: 13200, remSleepInSeconds: 5400, awakeDurationInSeconds: 1500, validation: "ENHANCED_FINAL", overallSleepScore: { value: 82, qualifierKey: "GOOD" } }],
  hrv: (userId) => [{ userId, summaryId: "h-20261102", calendarDate: "2026-11-02", startTimeInSeconds: T - 7.5 * 3600, startTimeOffsetInSeconds: 3600, durationInSeconds: 26400, lastNightAvg: 58, lastNight5MinHigh: 81 }],
  userMetrics: (userId) => [{ userId, summaryId: "m-20261102", calendarDate: "2026-11-02", vo2Max: 52.0, fitnessAge: 29, enhanced: true }],
  bodyComps: (userId) => [{ userId, summaryId: "b-1", measurementTimeInSeconds: T + 3600, measurementTimeOffsetInSeconds: 3600, weightInGrams: 64250, bodyFatInPercent: 14.2 }],
  deregistrations: (userId) => [{ userId }],
  userPermissionsChange: (userId) => [{ userId, permissions: ["ACTIVITY_EXPORT"] }],
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") return send(res, 200, { calls, access: [...access], refresh: [...refresh], backfills });
  if (p === "/debug/reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/debug/revoke") { access.clear(); refresh.clear(); return send(res, 200, { ok: true }); }
  if (p === "/debug/deny") { deny = true; return send(res, 200, { ok: true }); }
  if (p === "/debug/sample") { const b = raw ? JSON.parse(raw) : {}; const out = {}; for (const k of b.kinds ?? Object.keys(KINDS)) out[k] = KINDS[k](b.userId ?? USER); return send(res, 200, out); }
  if (p === "/debug/push" || p === "/debug/push-raw") {
    const b = JSON.parse(raw);
    let body = b.body;
    if (!body) { body = {}; for (const k of b.kinds ?? ["activities"]) body[k] = KINDS[k](b.userId ?? USER); }
    const r = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return send(res, 200, { status: r.status, body: await r.text() });
  }

  // ---------- sign-in (PKCE) ----------
  if (p === "/oauth2Confirm") {
    const to = new URL(url.searchParams.get("redirect_uri"));
    to.searchParams.set("state", url.searchParams.get("state") ?? "");
    if (url.searchParams.get("code_challenge_method") !== "S256" || !url.searchParams.get("code_challenge")) { to.searchParams.set("error", "invalid_request"); }
    else if (deny) { deny = false; to.searchParams.set("error", "access_denied"); }
    else { challenge = url.searchParams.get("code_challenge"); to.searchParams.set("code", "ga-code-1"); }
    res.writeHead(302, { Location: to.toString() }); return res.end();
  }
  if (p === "/oauth/token") {
    const f = new URLSearchParams(raw);
    if (f.get("client_secret") !== SECRET) return send(res, 401, { error: "invalid_client" });
    if (f.get("grant_type") === "authorization_code") {
      if (f.get("code") !== "ga-code-1") return send(res, 400, { error: "invalid_grant" });
      const v = f.get("code_verifier") ?? "";
      if (createHash("sha256").update(v).digest("base64url") !== challenge) return send(res, 400, { error: "invalid_grant", error_description: "code_verifier does not match" });
      const t = newTokens();
      return send(res, 200, { access_token: t.a, expires_in: 86400, token_type: "bearer", refresh_token: t.r, scope: "ACTIVITY_EXPORT HEALTH_EXPORT", jti: "x", refresh_token_expires_in: 7775998 });
    }
    if (f.get("grant_type") === "refresh_token") {
      const old = f.get("refresh_token");
      if (!refresh.has(old)) return send(res, 400, { error: "invalid_grant" });
      refresh.delete(old);
      const t = newTokens();
      return send(res, 200, { access_token: t.a, expires_in: 86400, token_type: "bearer", refresh_token: t.r, scope: "ACTIVITY_EXPORT HEALTH_EXPORT", refresh_token_expires_in: 7775998 });
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  // ---------- API ----------
  if (!p.startsWith("/wellness-api/rest/")) return send(res, 404, {});
  const token = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!access.has(token)) return send(res, 401, { error: "unauthorized" });
  calls++;
  const rest = p.slice("/wellness-api/rest".length);
  if (rest === "/user/id") return send(res, 200, { userId: USER });
  if (rest === "/user/permissions") return send(res, 200, ["ACTIVITY_EXPORT", "HEALTH_EXPORT"]);
  if (rest === "/user/registration" && req.method === "DELETE") { access.delete(token); refresh.clear(); res.writeHead(204); return res.end(); }
  let m;
  if ((m = /^\/backfill\/(\w+)$/.exec(rest))) { backfills.push({ kind: m[1], start: url.searchParams.get("summaryStartTimeInSeconds"), end: url.searchParams.get("summaryEndTimeInSeconds") }); res.writeHead(202); return res.end(); }
  return send(res, 404, { error: `not handled: ${req.method} ${rest}` });
}).listen(PORT, () => console.log(`mock Garmin on ${PORT}`));
