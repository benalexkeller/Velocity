// Stand-in for Google's sign-in and the Google Health API (v4) that Fitbit data now comes through, for testing
// without a Google Cloud project.
//   node scripts/mock-fitbit.js            (port 4016)
// Point the app at it: GOOGLE_HEALTH_CLIENT_ID=x GOOGLE_HEALTH_CLIENT_SECRET=gh-secret GOOGLE_HEALTH_PROJECT_NUMBER=123
//   GOOGLE_HEALTH_WEBHOOK_SECRET=gh-hook GOOGLE_HEALTH_AUTH_URL=http://localhost:4016/o/oauth2/v2/auth
//   GOOGLE_HEALTH_TOKEN_URL=http://localhost:4016/token GOOGLE_HEALTH_REVOKE_URL=http://localhost:4016/revoke
//   GOOGLE_HEALTH_API=http://localhost:4016/v4
// Test controls: GET /debug; POST /debug/reset; POST /debug/unlink (identity answers ACCOUNT_NOT_LINKED);
// POST /debug/send {url, dataType, operation?, recordId?, from?, to?} posts a notification batch to the app the way
// Google does (Authorization: the shared secret); POST /debug/verify {url} runs Google's two-step endpoint check;
// POST /debug/add-exercise {...} adds a workout and returns it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { randomUUID } = require("crypto");
const PORT = Number(process.env.PORT || 4016);
const HOOK = process.env.GOOGLE_HEALTH_WEBHOOK_SECRET || "gh-hook";
const USER = "gh-user-777";

let access, refresh, calls, unlinked, exercises, sleeps, rhr, hrv, vo2, weights, seq, subscribers, revoked;
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const gdate = (ms) => { const d = new Date(ms); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };
function reset() {
  access = new Set(); refresh = new Set(); calls = 0; unlinked = false; seq = 0; subscribers = []; revoked = [];
  exercises = []; sleeps = []; rhr = []; hrv = []; vo2 = []; weights = [];
  // 40 days in Europe/Berlin (+01:00): exercise most mornings at 06:30 local (05:30Z), sleep 23:00 → 06:40
  const base = Date.parse("2026-11-02T00:00:00Z");
  for (let d = 0; d < 40; d++) {
    const day = base - d * DAY;
    if (d % 3 !== 1) {
      const ride = d % 10 === 3, swim = d % 7 === 5;
      const secs = ride ? 150 * 60 : swim ? 45 * 60 : (45 + (d % 4) * 10) * 60;
      const start = day + 5.5 * 3600000;
      exercises.push({ name: `users/me/dataTypes/exercise/dataPoints/ex-${1000 + d}`, dataSource: { device: { displayName: "Charge 6" }, platform: "FITBIT", recordingMethod: "ACTIVELY_MEASURED" },
        exercise: { interval: { startTime: iso(start), endTime: iso(start + secs * 1000), startUtcOffset: "3600s", endUtcOffset: "3600s", civilStartTime: { date: gdate(start + 3600000), time: { hours: 6, minutes: 30 } }, civilEndTime: { date: gdate(start + secs * 1000 + 3600000), time: { hours: 6 + Math.floor((30 + secs / 60) / 60), minutes: (30 + secs / 60) % 60 } } },
          exerciseType: ride ? "BIKING" : swim ? "SWIMMING" : "RUNNING", displayName: ride ? "Morning ride" : swim ? "Pool swim" : "Morning run", activeDuration: `${secs}s`,
          metricsSummary: { distanceMillimeters: String(ride ? 48280000 : swim ? 1828800 : 9650000 + d * 10000), caloriesKcal: ride ? 1200 : 520, averageHeartRateBeatsPerMinute: ride ? 138 : 148, elevationGainMillimeters: String(ride ? 620000 : 85000) }, exerciseMetadata: { hasGps: !swim } } });
    }
    const sleepStart = day - DAY + 22 * 3600000, sleepEnd = day + 5 * 3600000 + 40 * 60000; // 23:00 → 06:40 local
    sleeps.push({ name: `users/me/dataTypes/sleep/dataPoints/sl-${2000 + d}`, sleep: { interval: { startTime: iso(sleepStart), endTime: iso(sleepEnd), startUtcOffset: "3600s", endUtcOffset: "3600s", civilStartTime: { date: gdate(sleepStart + 3600000), time: { hours: 23 } }, civilEndTime: { date: gdate(sleepEnd + 3600000), time: { hours: 6, minutes: 40 } } }, type: "STAGES", summary: { minutesAsleep: String(420 + (d % 5) * 6), minutesAwake: "30", minutesInSleepPeriod: "460" }, metadata: { isMainSleep: true } } });
    if (d === 2) sleeps.push({ name: `users/me/dataTypes/sleep/dataPoints/nap-${d}`, sleep: { interval: { startTime: iso(day + 13 * 3600000), endTime: iso(day + 13.5 * 3600000), startUtcOffset: "3600s", endUtcOffset: "3600s" }, type: "CLASSIC", summary: { minutesAsleep: "28" }, metadata: { isMainSleep: false } } });
    rhr.push({ name: `users/me/dataTypes/daily-resting-heart-rate/dataPoints/rhr-${d}`, dailyRestingHeartRate: { date: gdate(day), beatsPerMinute: String(48 + (d % 4)) } });
    hrv.push({ name: `users/me/dataTypes/daily-heart-rate-variability/dataPoints/hrv-${d}`, dailyHeartRateVariability: { date: gdate(day), averageHeartRateVariabilityMilliseconds: 62.5 + (d % 6) } });
    if (d % 7 === 0) vo2.push({ name: `users/me/dataTypes/daily-vo2-max/dataPoints/vo2-${d}`, dailyVo2Max: { date: gdate(day), vo2Max: 49.2, estimated: false } });
    if (d % 5 === 0) weights.push({ name: `users/me/dataTypes/weight/dataPoints/w-${d}`, weight: { sampleTime: { physicalTime: iso(day + 6 * 3600000), civilTime: { date: gdate(day), time: { hours: 7 } } }, weightQuantity: { value: 74.2 + (d % 3) * 0.3, unit: "KILOGRAM" } } });
  }
}
reset();

const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const newTokens = () => { const a = `gh-access-${++seq}`, r = seq === 1 ? "gh-refresh-1" : [...refresh][0] ?? `gh-refresh-${seq}`; access.add(a); refresh.add(r); return { a, r }; };
const civilOf = (dp, type) => {
  if (type === "exercise") return dp.exercise.interval.civilStartTime ? `${dp.exercise.interval.civilStartTime.date.year}-${String(dp.exercise.interval.civilStartTime.date.month).padStart(2, "0")}-${String(dp.exercise.interval.civilStartTime.date.day).padStart(2, "0")}` : dp.exercise.interval.startTime.slice(0, 10);
  if (type === "sleep") return dp.sleep.interval.endTime.slice(0, 10);
  if (type === "weight") return dp.weight.sampleTime.physicalTime.slice(0, 10);
  const k = type === "daily-resting-heart-rate" ? "dailyRestingHeartRate" : type === "daily-heart-rate-variability" ? "dailyHeartRateVariability" : "dailyVo2Max";
  const d = dp[k].date; return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
};
const listOf = (type) => (type === "exercise" ? exercises : type === "sleep" ? sleeps : type === "daily-resting-heart-rate" ? rhr : type === "daily-heart-rate-variability" ? hrv : type === "daily-vo2-max" ? vo2 : type === "weight" ? weights : null);

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") return send(res, 200, { calls, access: [...access], refresh: [...refresh], exercises: exercises.length, sleeps: sleeps.length, subscribers, revoked });
  if (p === "/debug/reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/debug/unlink") { unlinked = true; return send(res, 200, { ok: true }); }
  if (p === "/debug/add-exercise") {
    const b = JSON.parse(raw || "{}"); const id = `ex-${randomUUID().slice(0, 8)}`; const start = Date.parse(b.start || "2026-11-03T07:00:00Z"); const secs = b.secs || 2400;
    const dp = { name: `users/me/dataTypes/exercise/dataPoints/${id}`, exercise: { interval: { startTime: iso(start), endTime: iso(start + secs * 1000), startUtcOffset: "3600s", endUtcOffset: "3600s" }, exerciseType: b.type || "RUNNING", displayName: b.name || "Lunch run", activeDuration: `${secs}s`, metricsSummary: { distanceMillimeters: String(b.metres ? b.metres * 1000 : 7000000), caloriesKcal: 410, averageHeartRateBeatsPerMinute: 150 } } };
    exercises.unshift(dp); return send(res, 200, { id, dataPoint: dp });
  }
  if (p === "/debug/send") {
    const b = JSON.parse(raw || "{}");
    const n = { data: { version: "1", clientProvidedSubscriptionName: "velocity", healthUserId: USER, dataType: b.dataType || "exercise", operation: b.operation || "UPSERT", ...(b.recordId ? { recordId: b.recordId } : {}), intervals: [{ civilDateTimeInterval: { start: b.from || "2026-11-03T00:00:00", end: b.to || "2026-11-04T00:00:00" } }] } };
    const r = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: HOOK, "GOOGLE-HEALTH-API-SIGNATURE": "stand-in", "User-Agent": "Google-Health-API-Webhooks" }, body: JSON.stringify([n]) });
    return send(res, 200, { status: r.status });
  }
  if (p === "/debug/verify") {
    const b = JSON.parse(raw || "{}");
    const ok = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: HOOK, "User-Agent": "Google-Health-API-Webhooks" }, body: JSON.stringify({ type: "verification" }) });
    const bad = await fetch(b.url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Google-Health-API-Webhooks" }, body: JSON.stringify({ type: "verification" }) });
    return send(res, 200, { authorized: ok.status, unauthorized: bad.status, passed: (ok.status === 200 || ok.status === 201) && (bad.status === 401 || bad.status === 403) });
  }

  // ---------- Google sign-in ----------
  if (p === "/o/oauth2/v2/auth") {
    const redirect = new URL(url.searchParams.get("redirect_uri")); redirect.searchParams.set("code", "gh-code-" + (++seq)); redirect.searchParams.set("state", url.searchParams.get("state") || "");
    if (!url.searchParams.get("code_challenge")) return send(res, 400, { error: "missing code_challenge" });
    res.writeHead(302, { Location: redirect.toString() }); return res.end();
  }
  if (p === "/token") {
    const b = Object.fromEntries(new URLSearchParams(raw));
    if (b.client_secret !== (process.env.GOOGLE_HEALTH_CLIENT_SECRET || "gh-secret")) return send(res, 401, { error: "invalid_client" });
    if (b.grant_type === "authorization_code") { if (!b.code_verifier) return send(res, 400, { error: "invalid_request", error_description: "code_verifier" }); const t = newTokens(); return send(res, 200, { access_token: t.a, refresh_token: t.r, expires_in: 3599, token_type: "Bearer", scope: "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.sleep.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly" }); }
    if (b.grant_type === "refresh_token") { if (!refresh.has(b.refresh_token)) return send(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }); const a = `gh-access-${++seq}`; access.add(a); return send(res, 200, { access_token: a, expires_in: 3599, token_type: "Bearer" }); }
    return send(res, 400, { error: "unsupported_grant_type" });
  }
  if (p === "/revoke") { revoked.push(url.searchParams.get("token")); access.clear(); refresh.clear(); return send(res, 200, {}); }

  // ---------- Google Health API ----------
  const auth = req.headers.authorization || "";
  const tok = auth.replace(/^Bearer\s+/i, "");
  if (!access.has(tok)) return send(res, 401, { error: { code: 401, status: "UNAUTHENTICATED", message: "Request had invalid authentication credentials." } });
  calls++;
  if (p === "/v4/users/me/identity") return unlinked ? send(res, 400, { error: { code: 400, status: "FAILED_PRECONDITION", message: "ACCOUNT_NOT_LINKED", details: [{ reason: "ACCOUNT_NOT_LINKED" }] } }) : send(res, 200, { name: "users/me/identity", legacyUserId: "ABC123", healthUserId: USER });
  if (p === "/v4/users/me/pairedDevices") return send(res, 200, { pairedDevices: [{ name: "users/me/pairedDevices/1", displayName: "Charge 6", deviceType: "TRACKER" }] });
  const m = /^\/v4\/users\/me\/dataTypes\/([a-z0-9-]+)\/dataPoints(?::reconcile)?$/.exec(p);
  if (m) {
    const list = listOf(m[1]); if (!list) return send(res, 404, { error: { code: 404, message: "unknown data type" } });
    const f = url.searchParams.get("filter") || "";
    const ge = />=\s*"([^"]+)"/.exec(f)?.[1]?.slice(0, 10), lt = /<\s*"([^"]+)"/.exec(f)?.[1]?.slice(0, 10);
    const sorted = list.filter((dp) => { const d = civilOf(dp, m[1]); return (!ge || d >= ge) && (!lt || d < lt); }).sort((a, b) => civilOf(b, m[1]).localeCompare(civilOf(a, m[1])));
    const size = Math.min(m[1] === "exercise" || m[1] === "sleep" ? 25 : 1000, Number(url.searchParams.get("pageSize") || 25));
    const from = Number(url.searchParams.get("pageToken") || 0);
    const dataPoints = sorted.slice(from, from + size);
    return send(res, 200, { dataPoints, ...(from + size < sorted.length ? { nextPageToken: String(from + size) } : {}) });
  }
  const one = /^\/v4\/users\/me\/dataTypes\/([a-z0-9-]+)\/dataPoints\/([^/]+)$/.exec(p);
  if (one) { const dp = (listOf(one[1]) || []).find((x) => x.name.endsWith(`/${one[2]}`)); return dp ? send(res, 200, dp) : send(res, 404, { error: { code: 404, message: "not found" } }); }
  const sub = /^\/v4\/projects\/(\d+)\/subscribers$/.exec(p);
  if (sub) {
    if (req.method === "POST") {
      const b = JSON.parse(raw || "{}");
      // Google's two-step check of the endpoint before saving
      const ok = await fetch(b.endpointUri, { method: "POST", headers: { "Content-Type": "application/json", Authorization: b.endpointAuthorization?.secret || "", "User-Agent": "Google-Health-API-Webhooks" }, body: JSON.stringify({ type: "verification" }) }).catch(() => ({ status: 0 }));
      const bad = await fetch(b.endpointUri, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Google-Health-API-Webhooks" }, body: JSON.stringify({ type: "verification" }) }).catch(() => ({ status: 0 }));
      if (!((ok.status === 200 || ok.status === 201) && (bad.status === 401 || bad.status === 403))) return send(res, 400, { error: { code: 400, status: "FAILED_PRECONDITION", message: `endpoint verification failed (${ok.status}/${bad.status})` } });
      const s = { name: `projects/${sub[1]}/subscribers/${url.searchParams.get("subscriberId") || "velocity"}`, endpointUri: b.endpointUri, subscriberConfigs: b.subscriberConfigs };
      subscribers.push(s); return send(res, 200, s);
    }
    return send(res, 200, { subscribers });
  }
  send(res, 404, { error: { code: 404, message: `no route ${req.method} ${p}` } });
}).listen(PORT, () => console.log(`stand-in Google Health (Fitbit) on ${PORT}`));
