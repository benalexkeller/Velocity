// Stand-in for iCloud's CalDAV server, for testing Apple Calendar without an Apple account.
//   node scripts/mock-caldav.js            (port 4013)
// Point the app at it: APPLE_CALDAV_URL=http://localhost:4013/
// Apple ID athlete@icloud.com with the app-specific password abcd-efgh-ijkl-mnop (anything else: 401).
// GET /debug shows every calendar and event; POST /debug/reset starts over; POST /debug/revoke cancels the
// app-specific password; POST /debug/fail {status, after} makes later calls fail.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");
const PORT = Number(process.env.PORT || 4013);
const USER = "athlete@icloud.com";
let PASS = "abcd-efgh-ijkl-mnop";
const BASE = `http://localhost:${PORT}`;
const HOME = "/123456/calendars/";

let cals, fail, calls;
const ics = (lines) => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Apple Inc.//iCloud//EN", ...lines, "END:VCALENDAR"].join("\r\n") + "\r\n";
function reset() {
  calls = 0; fail = null; PASS = "abcd-efgh-ijkl-mnop";
  cals = new Map();
  // the athlete's own calendars, with events in the week of 2 Nov 2026
  cals.set(`${HOME}home/`, { name: "Home", color: "#34AADCFF", comp: "VEVENT", files: new Map([
    ["dentist.ics", ics(["BEGIN:VEVENT", "UID:dentist-1", "DTSTART;TZID=Europe/Berlin:20261103T083000", "DTEND;TZID=Europe/Berlin:20261103T091500", "SUMMARY:Dentist\\, Dr. Weber", "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "SUMMARY:Alarm text", "DESCRIPTION:Reminder", "END:VALARM", "END:VEVENT"])],
    ["trip.ics", ics(["BEGIN:VEVENT", "UID:trip-1", "DTSTART;VALUE=DATE:20261107", "DTEND;VALUE=DATE:20261109", "SUMMARY:Trip to Munich", "END:VEVENT"])],
    ["swim.ics", ics(["BEGIN:VEVENT", "UID:swim-1", "RECURRENCE-ID:20261102T170000Z", "DTSTART:20261102T170000Z", "DURATION:PT1H", "SUMMARY:Kids swim class", "END:VEVENT", "BEGIN:VEVENT", "UID:swim-1", "RECURRENCE-ID:20261104T170000Z", "DTSTART:20261104T170000Z", "DURATION:PT1H", "SUMMARY:Kids swim class", "END:VEVENT"])],
    ["cancelled.ics", ics(["BEGIN:VEVENT", "UID:cx-1", "DTSTART:20261105T120000Z", "DTEND:20261105T130000Z", "SUMMARY:Cancelled lunch", "STATUS:CANCELLED", "END:VEVENT"])],
  ]) });
  cals.set(`${HOME}work/`, { name: "Work &amp; school", color: "#FF9500FF", comp: "VEVENT", files: new Map([
    ["standup.ics", ics(["BEGIN:VEVENT", "UID:standup-1", "DTSTART:20261102T080000Z", "DTEND:20261102T083000Z", "SUMMARY:Team standup with a very long title that is folded by the", "  server", "END:VEVENT"])],
  ]) });
  cals.set(`${HOME}tasks/`, { name: "Reminders", color: "#B1B1B1FF", comp: "VTODO", files: new Map() });
}
reset();

const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const xmlEsc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const multi = (responses) => `<?xml version="1.0" encoding="UTF-8"?>\n<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">${responses.join("")}</multistatus>`;
const resp = (href, props) => `<response><href>${href}</href><propstat><prop>${props}</prop><status>HTTP/1.1 200 OK</status></propstat></response>`;
const sendXml = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/xml; charset=utf-8" }); res.end(body); };
const icsTimeUtc = (v, p) => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(v);
  if (!m) return null;
  if (!m[4]) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (m[7]) return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  // TZID=Europe/Berlin in November: UTC+1 (good enough for a test server)
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) - (/Europe\/Berlin/.test(p) ? 3600000 : 0);
};
/** Does any VEVENT in the file touch [a, b)? */
function inRange(text, a, b) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  return unfolded.split("BEGIN:VEVENT").slice(1).some((blk) => {
    const st = /^DTSTART([^:\r\n]*):(.+)$/m.exec(blk), en = /^DTEND([^:\r\n]*):(.+)$/m.exec(blk), du = /^DURATION:PT(\d+)H$/m.exec(blk);
    if (!st) return false;
    const s = icsTimeUtc(st[2].trim(), st[1]);
    const e = en ? icsTimeUtc(en[2].trim(), en[1]) : s + (du ? Number(du[1]) * 3600000 : 86400000);
    return s < b && e > a;
  });
}
const basic = (s) => { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : NaN; };

http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const p = decodeURIComponent(url.pathname);
  const raw = await read(req);
  // ---------- test controls ----------
  if (p === "/debug") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ calls, calendars: [...cals].map(([href, c]) => ({ href, name: c.name, comp: c.comp, files: [...c.files].map(([f, t]) => ({ f, ics: t })) })) })); }
  if (p === "/debug/reset") { reset(); res.writeHead(200); return res.end("ok"); }
  if (p === "/debug/revoke") { PASS = "cancelled-" + Date.now(); res.writeHead(200); return res.end("ok"); }
  if (p === "/debug/fail") { fail = raw ? JSON.parse(raw) : null; res.writeHead(200); return res.end("ok"); }

  const auth = Buffer.from(String(req.headers.authorization ?? "").replace(/^Basic /, ""), "base64").toString("utf8");
  if (auth !== `${USER}:${PASS}`) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="iCloud"' }); return res.end(); }
  calls++;
  if (fail && calls > (fail.after ?? 0)) { res.writeHead(fail.status); return res.end(); }
  const depth = String(req.headers.depth ?? "0");

  if (req.method === "PROPFIND") {
    if (p === "/") return sendXml(res, 207, multi([resp("/", "<current-user-principal><href>/123456/principal/</href></current-user-principal>")]));
    // iCloud answers with a full address on another host; here the same host, written out in full
    if (p === "/123456/principal/") return sendXml(res, 207, multi([resp(p, `<C:calendar-home-set><href xmlns="DAV:">${BASE}${HOME}</href></C:calendar-home-set>`)]));
    if (p === HOME) {
      const out = [resp(HOME, "<resourcetype><collection/></resourcetype><displayname>athlete</displayname>")];
      if (depth === "1") for (const [href, c] of cals) out.push(resp(href, `<resourcetype><collection/><C:calendar/></resourcetype><displayname>${c.name}</displayname><A:calendar-color>${c.color}</A:calendar-color><C:supported-calendar-component-set><C:comp name="${c.comp}"/></C:supported-calendar-component-set>`));
      return sendXml(res, 207, multi(out));
    }
    const c = cals.get(p);
    if (!c) { res.writeHead(404); return res.end(); }
    return sendXml(res, 207, multi([resp(p, `<resourcetype><collection/><C:calendar/></resourcetype><displayname>${c.name}</displayname>`)]));
  }
  if (req.method === "MKCALENDAR") {
    if (cals.has(p)) { res.writeHead(405); return res.end(); }
    if (!p.startsWith(HOME)) { res.writeHead(403); return res.end(); }
    const name = /<(?:\w+:)?displayname>([^<]*)</.exec(raw)?.[1] ?? "Untitled";
    cals.set(p, { name, color: "#2459FEFF", comp: "VEVENT", files: new Map() });
    res.writeHead(201); return res.end();
  }
  if (req.method === "REPORT") {
    const c = cals.get(p);
    if (!c) { res.writeHead(404); return res.end(); }
    const a = basic(/<(?:\w+:)?time-range start="([^"]+)"/.exec(raw)?.[1] ?? ""), b = basic(/<(?:\w+:)?time-range[^>]*end="([^"]+)"/.exec(raw)?.[1] ?? "");
    const out = [...c.files].filter(([, t]) => inRange(t, a, b)).map(([f, t]) => resp(p + f, `<getetag>"${f}"</getetag><C:calendar-data>${xmlEsc(t)}</C:calendar-data>`));
    return sendXml(res, 207, multi(out));
  }
  // a single event file, or a calendar
  const slash = p.lastIndexOf("/");
  const dir = p.slice(0, slash + 1), file = p.slice(slash + 1);
  if (req.method === "PUT") {
    const c = cals.get(dir);
    if (!c) { res.writeHead(409); return res.end(); }
    if (!/^BEGIN:VCALENDAR/.test(raw) || !/BEGIN:VEVENT/.test(raw) || !/\r\n/.test(raw)) { res.writeHead(415); return res.end(); }
    const had = c.files.has(file);
    c.files.set(file, raw);
    res.writeHead(had ? 204 : 201); return res.end();
  }
  if (req.method === "DELETE") {
    if (!file && cals.has(p)) { cals.delete(p); res.writeHead(204); return res.end(); }
    const c = cals.get(dir);
    if (!c || !c.files.has(file)) { res.writeHead(404); return res.end(); }
    c.files.delete(file);
    res.writeHead(204); return res.end();
  }
  res.writeHead(405); res.end();
}).listen(PORT, () => console.log(`mock iCloud CalDAV on ${PORT}`));
