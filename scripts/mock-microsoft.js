// Stand-in for Microsoft's sign-in and the Graph calendar API, for testing Outlook without a Microsoft account.
//   node scripts/mock-microsoft.js            (port 4012)
// Point the app at it: MICROSOFT_CLIENT_ID=x MICROSOFT_CLIENT_SECRET=y
//   MICROSOFT_AUTH_URL=http://localhost:4012/authorize MICROSOFT_TOKEN_URL=http://localhost:4012/token
//   MICROSOFT_GRAPH_API=http://localhost:4012/v1.0
// GET /debug shows every calendar and event; POST /debug/reset starts over; POST /debug/revoke makes every stored
// refresh token invalid (the athlete removed Velocity in their Microsoft account); POST /debug/fail {status, code,
// after} makes later Graph calls fail; POST /debug/deny makes the next sign-in come back with access_denied.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
const PORT = Number(process.env.PORT || 4012);
const EMAIL = "athlete@outlook.com";

let calendars, refreshTokens, accessTokens, fail, calls, deny, seq;
function reset() {
  seq = 0; calls = 0; fail = null; deny = false;
  refreshTokens = new Set(); accessTokens = new Set();
  calendars = new Map();
  // the athlete's own calendars, with events in the week of 2 Nov 2026 (times in UTC)
  add("cal-default", "Calendar", "#1F6FEB", true, [
    ev("Dentist", "2026-11-03T07:30:00", "2026-11-03T08:15:00"),
    ev("Dinner with Anna", "2026-11-06T18:00:00", "2026-11-06T21:00:00"),
    { ...ev("Trip to Munich", "2026-11-07T00:00:00", "2026-11-09T00:00:00"), isAllDay: true },
    { ...ev("Cancelled call", "2026-11-04T11:00:00", "2026-11-04T11:30:00"), isCancelled: true },
  ]);
  add("cal-work", "Work", "#E8590C", false, [ev("Team standup", "2026-11-02T08:00:00", "2026-11-02T08:30:00"), ev("Client review", "2026-11-04T05:00:00", "2026-11-04T06:30:00")]);
  add("cal-bday", "Birthdays", "#9C36B5", false, [{ ...ev("Mum's birthday", "2026-11-05T00:00:00", "2026-11-06T00:00:00"), isAllDay: true }]);
}
function add(id, name, hexColor, isDefaultCalendar, events) {
  calendars.set(id, { id, name, hexColor, isDefaultCalendar, events: new Map(events.map((e) => [e.id, e])) });
}
function ev(subject, start, end) { return { id: `ev-${++seq}`, subject, start: { dateTime: `${start}.0000000`, timeZone: "UTC" }, end: { dateTime: `${end}.0000000`, timeZone: "UTC" }, isAllDay: false, isCancelled: false, showAs: "busy" }; }
reset();

const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const graphErr = (res, status, code, message) => send(res, status, { error: { code, message: message || code } });
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const newTokens = () => {
  const access = `ms-access-${++seq}`, refresh = `ms-refresh-${seq}`;
  accessTokens.add(access); refreshTokens.add(refresh);
  return { access, refresh };
};
/** Graph sends times in the zone asked for in Prefer: outlook.timezone, without an offset. */
const toUtc = (d) => new Date(/Z$/.test(d) ? d : `${d.replace(/\.\d+$/, "")}Z`);
function toStored(body, existing) {
  // the app sends local times with an IANA zone; store them as UTC like Graph does internally
  const conv = (t) => {
    if (!t?.dateTime) return t;
    if (!t.timeZone || t.timeZone === "UTC") return { dateTime: t.dateTime, timeZone: "UTC" };
    const [date, time] = t.dateTime.split("T");
    const guess = new Date(`${date}T${time.slice(0, 5)}:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: t.timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
    const g = (k) => parts.find((p) => p.type === k).value;
    const shown = new Date(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00Z`);
    const utc = new Date(guess.getTime() - (shown.getTime() - guess.getTime()));
    return { dateTime: utc.toISOString().replace("Z", "").replace(/\.\d+$/, ".0000000"), timeZone: "UTC", sent: t };
  };
  return { ...(existing ?? {}), ...body, start: conv(body.start ?? existing?.start), end: conv(body.end ?? existing?.end) };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") return send(res, 200, { calls, refreshTokens: [...refreshTokens], calendars: [...calendars.values()].map((c) => ({ ...c, events: [...c.events.values()] })) });
  if (p === "/debug/reset") { reset(); return send(res, 200, { ok: true }); }
  if (p === "/debug/revoke") { refreshTokens.clear(); accessTokens.clear(); return send(res, 200, { ok: true }); }
  if (p === "/debug/fail") { fail = raw ? JSON.parse(raw) : null; return send(res, 200, { ok: true }); }
  if (p === "/debug/deny") { deny = true; return send(res, 200, { ok: true }); }

  // ---------- sign-in ----------
  if (p === "/authorize") {
    const to = new URL(url.searchParams.get("redirect_uri"));
    to.searchParams.set("state", url.searchParams.get("state") ?? "");
    if (deny) { deny = false; to.searchParams.set("error", "access_denied"); to.searchParams.set("error_description", "The user has denied access."); }
    else to.searchParams.set("code", "ms-code-1");
    res.writeHead(302, { Location: to.toString() }); return res.end();
  }
  if (p === "/token") {
    const f = new URLSearchParams(raw);
    if (f.get("client_id") !== process.env.MS_CLIENT_ID && process.env.MS_CLIENT_ID) return send(res, 400, { error: "invalid_client" });
    if (f.get("grant_type") === "authorization_code") {
      if (f.get("code") !== "ms-code-1") return send(res, 400, { error: "invalid_grant", error_description: "AADSTS70000: The code is not valid." });
      const t = newTokens();
      return send(res, 200, { token_type: "Bearer", scope: "https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read openid email", expires_in: 3600, access_token: t.access, refresh_token: t.refresh, id_token: `${b64({ alg: "none" })}.${b64({ email: EMAIL, preferred_username: EMAIL })}.x` });
    }
    if (f.get("grant_type") === "refresh_token") {
      const old = f.get("refresh_token");
      if (!refreshTokens.has(old)) return send(res, 400, { error: "invalid_grant", error_description: "AADSTS70008: The refresh token has expired or been revoked." });
      // Microsoft rotates refresh tokens; the old one keeps working until it expires
      const t = newTokens();
      return send(res, 200, { token_type: "Bearer", scope: "https://graph.microsoft.com/Calendars.ReadWrite", expires_in: 3600, access_token: t.access, refresh_token: t.refresh });
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  // ---------- Graph ----------
  if (!p.startsWith("/v1.0/")) return send(res, 404, {});
  const token = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!accessTokens.has(token)) return graphErr(res, 401, "InvalidAuthenticationToken", "Access token is empty or invalid.");
  calls++;
  if (fail && calls > (fail.after ?? 0)) return graphErr(res, fail.status, fail.code ?? "ErrorInternalServerError");
  const body = raw ? JSON.parse(raw) : {};
  const parts = p.slice(6).split("/").map(decodeURIComponent); // ["me","calendars",id,...]
  const findEvent = (id) => { for (const c of calendars.values()) if (c.events.has(id)) return c; return null; };

  if (parts[1] === "calendars" && parts.length === 2) {
    if (req.method === "GET") return send(res, 200, { value: [...calendars.values()].map((c) => ({ id: c.id, name: c.name, hexColor: c.hexColor, isDefaultCalendar: c.isDefaultCalendar })) });
    if (req.method === "POST") {
      if ([...calendars.values()].some((c) => c.name === body.name)) return graphErr(res, 409, "ErrorFolderExists", "A folder with the specified name already exists.");
      const id = `cal-${++seq}`;
      add(id, body.name, "#2459FE", false, []);
      return send(res, 201, { id, name: body.name });
    }
  }
  if (parts[1] === "calendars" && parts.length >= 3) {
    const c = calendars.get(parts[2]);
    if (!c) return graphErr(res, 404, "ErrorItemNotFound", "The specified object was not found in the store.");
    if (parts.length === 3 && req.method === "GET") return send(res, 200, { id: c.id, name: c.name });
    if (parts.length === 3 && req.method === "DELETE") { calendars.delete(c.id); res.writeHead(204); return res.end(); }
    if (parts[3] === "events" && req.method === "POST") {
      const e = { id: `ev-${++seq}`, ...toStored(body), isCancelled: false };
      c.events.set(e.id, e);
      return send(res, 201, { id: e.id });
    }
    if (parts[3] === "calendarView" && req.method === "GET") {
      const a = new Date(url.searchParams.get("startDateTime")), b = new Date(url.searchParams.get("endDateTime"));
      const top = Number(url.searchParams.get("$top") ?? 10), skip = Number(url.searchParams.get("$skip") ?? 0);
      const all = [...c.events.values()].filter((e) => toUtc(e.start.dateTime) < b && toUtc(e.end.dateTime) > a).sort((x, y) => x.start.dateTime.localeCompare(y.start.dateTime));
      const page = all.slice(skip, skip + top);
      const next = skip + top < all.length ? (() => { const n = new URL(url); n.searchParams.set("$skip", String(skip + top)); return n.toString(); })() : undefined;
      return send(res, 200, { value: page, ...(next ? { "@odata.nextLink": next } : {}) });
    }
  }
  if (parts[1] === "events" && parts[2]) {
    const c = findEvent(parts[2]);
    if (!c) return graphErr(res, 404, "ErrorItemNotFound", "The specified object was not found in the store.");
    if (req.method === "PATCH") { c.events.set(parts[2], toStored(body, c.events.get(parts[2]))); return send(res, 200, { id: parts[2] }); }
    if (req.method === "DELETE") { c.events.delete(parts[2]); res.writeHead(204); return res.end(); }
  }
  return graphErr(res, 400, "BadRequest", `not handled: ${req.method} ${p}`);
}).listen(PORT, () => console.log(`mock Microsoft on ${PORT}`));
