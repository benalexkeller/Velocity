// Stand-in for Google's sign-in and Calendar API, for testing the calendar sync without a Google account.
//   node scripts/mock-google.js            (port 3998)
// Point the app at it: GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=y GOOGLE_AUTH_URL=http://localhost:3998/auth
//   GOOGLE_TOKEN_URL=http://localhost:3998/token GOOGLE_REVOKE_URL=http://localhost:3998/revoke
//   GOOGLE_CALENDAR_API=http://localhost:3998/calendar/v3
// GET /debug shows every calendar and event; POST /debug/fail {status, reason, after} makes later calls fail.
const http = require("http");
const PORT = Number(process.env.PORT || 3998);
const calendars = new Map(); // id -> { summary, timeZone, events: Map(eventId -> event) }
let fail = null; // { status, reason, after } — fail every Calendar call once `after` more calls have succeeded
let calls = 0;
const tokens = new Set(["access-1"]);

const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const err = (res, status, reason, message) => send(res, status, { error: { code: status, message: message || reason, errors: [{ reason }] } });
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await read(req);
  if (p === "/auth") {
    // consent given at once: back to the app with a code
    const to = new URL(url.searchParams.get("redirect_uri"));
    to.searchParams.set("code", "code-1"); to.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: to.toString() }); return res.end();
  }
  if (p === "/token") {
    const f = new URLSearchParams(raw);
    const idToken = ["e30", Buffer.from(JSON.stringify({ email: "athlete@example.com" })).toString("base64url"), "sig"].join(".");
    if (f.get("grant_type") === "authorization_code") return send(res, 200, { access_token: "access-1", refresh_token: "refresh-1", scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.app.created", id_token: idToken, expires_in: 3599 });
    if (f.get("refresh_token") === "revoked") return send(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
    return send(res, 200, { access_token: "access-1", expires_in: 3599 });
  }
  if (p === "/revoke") return send(res, 200, {});
  if (p === "/debug" && req.method === "GET") return send(res, 200, { calls, calendars: [...calendars].map(([id, c]) => ({ id, summary: c.summary, timeZone: c.timeZone, events: [...c.events.values()] })) });
  if (p === "/debug/fail") { fail = raw ? JSON.parse(raw) : null; return send(res, 200, { fail }); }
  if (p === "/debug/reset") { calendars.clear(); calls = 0; fail = null; return send(res, 200, {}); }

  if (!p.startsWith("/calendar/v3/")) return err(res, 404, "notFound");
  if (!tokens.has((req.headers.authorization || "").replace("Bearer ", ""))) return err(res, 401, "authError", "Invalid Credentials");
  calls++;
  if (fail) { if (fail.after > 0) fail.after--; else return err(res, fail.status, fail.reason); }
  const parts = p.slice("/calendar/v3/".length).split("/").map(decodeURIComponent);
  const body = raw ? JSON.parse(raw) : {};
  if (parts[0] !== "calendars") return err(res, 404, "notFound");
  if (parts.length === 1 && req.method === "POST") { const id = `cal${calendars.size + 1}@group.calendar.google.com`; calendars.set(id, { summary: body.summary, timeZone: body.timeZone, events: new Map() }); return send(res, 200, { id, summary: body.summary }); }
  const cal = calendars.get(parts[1]);
  if (parts.length === 2) {
    if (!cal) return err(res, 404, "notFound");
    if (req.method === "GET") return send(res, 200, { id: parts[1], summary: cal.summary });
    if (req.method === "DELETE") { calendars.delete(parts[1]); res.writeHead(204); return res.end(); }
  }
  if (!cal) return err(res, 404, "notFound", "Not Found");
  if (parts[2] === "events" && parts.length === 3 && req.method === "POST") {
    if (!/^[a-v0-9]{5,1024}$/.test(body.id)) return err(res, 400, "invalid", "Invalid resource id value.");
    if (cal.events.has(body.id)) return err(res, 409, "duplicate", "The requested identifier already exists.");
    cal.events.set(body.id, body); return send(res, 200, body);
  }
  if (parts[2] === "events" && parts.length === 4) {
    const eid = parts[3];
    if (req.method === "PUT") { if (!cal.events.has(eid)) return err(res, 404, "notFound"); cal.events.set(eid, { ...body, id: eid }); return send(res, 200, body); }
    if (req.method === "DELETE") { if (!cal.events.has(eid)) return err(res, 410, "deleted", "Resource has been deleted"); cal.events.delete(eid); res.writeHead(204); return res.end(); }
  }
  return err(res, 400, "badRequest");
}).listen(PORT, () => console.log(`mock Google on :${PORT}`));
