// Stand-in for Supabase Auth, for testing sign-in and password reset without the real project.
//   node scripts/mock-supabase-auth.js        (port 54321)
// Point the app at it: NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npx next dev
// One test user: reviewer@velocity.test / old-pass-123. Addresses ending in @outside.test get Supabase's
// "Email address not authorized" (what the built-in email sender says for anyone outside the project team).
// GET /debug/last-link gives the link the last reset email would contain (and its token_hash, for Velocity's own
// email templates); GET /debug/users the users.
// Only the auth endpoints the login, sign-up and reset pages use. Database calls (/rest/v1) get an empty answer, except
// profile writes, which get Supabase's 403 unless the id is the signed-in user's own (GET /debug/writes lists them).
const http = require("http");
const crypto = require("crypto");
const PORT = Number(process.env.PORT || 54321);
const BASE = `http://localhost:${PORT}`;

const users = new Map([["reviewer@velocity.test", { id: "00000000-0000-4000-8000-000000000001", email: "reviewer@velocity.test", password: "old-pass-123" }]]);
const recoveries = new Map(); // token -> { email, redirect, challenge, method, used }
const codes = new Map(); // auth code -> { email, challenge, method }
const sessions = new Map(); // access or refresh token -> email
let lastLink = null;
let lastHash = null; // what {{ .TokenHash }} would be in the email
const writes = []; // profile writes: who sent them and for which ids

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const userOf = (email) => { const u = users.get(email); return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-11-01T00:00:00Z", updated_at: new Date().toISOString() }; };
function session(email, amr = "password") {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: users.get(email).id, email, aud: "authenticated", role: "authenticated", exp, iat: exp - 3600, session_id: crypto.randomUUID(), amr: [{ method: amr, timestamp: exp - 3600 }] })}.mock`;
  const refresh = crypto.randomBytes(12).toString("hex");
  sessions.set(access, email); sessions.set(refresh, email);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userOf(email) };
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json", ...cors }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const fail = (res, status, error_code, msg) => send(res, status, { code: status, error_code, msg });
const bearer = (req) => sessions.get(String(req.headers.authorization || "").replace(/^Bearer /i, ""));
const s256 = (v) => crypto.createHash("sha256").update(v).digest("base64url");

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, BASE);
    const body = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
    const p = url.pathname;
    console.log(req.method, p + url.search);
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

    if (p === "/debug/last-link") return send(res, 200, { link: lastLink, token_hash: lastHash });
    if (p === "/debug/users") return send(res, 200, [...users.values()]);

    if (p === "/auth/v1/token" && req.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = users.get(String(body.email || "").toLowerCase());
        if (!u || u.password !== body.password) return fail(res, 400, "invalid_credentials", "Invalid login credentials");
        return send(res, 200, session(u.email));
      }
      if (grant === "pkce") {
        const c = codes.get(body.auth_code);
        if (!c) return fail(res, 404, "flow_state_not_found", "invalid flow state, no valid flow state found");
        const ok = c.method === "s256" ? s256(String(body.code_verifier || "")) === c.challenge : body.code_verifier === c.challenge;
        codes.delete(body.auth_code);
        if (!ok) return fail(res, 403, "bad_code_verifier", "code challenge does not match previously saved code verifier");
        return send(res, 200, session(c.email, "recovery"));
      }
      if (grant === "refresh_token") {
        const email = sessions.get(body.refresh_token);
        if (!email) return fail(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
        return send(res, 200, session(email));
      }
      return fail(res, 400, "unsupported_grant_type", "unsupported grant type");
    }

    if (p === "/auth/v1/recover" && req.method === "POST") {
      const email = String(body.email || "").toLowerCase();
      if (email.endsWith("@outside.test")) return fail(res, 400, "email_address_not_authorized", "Email address not authorized");
      // like Supabase: the same answer whether or not the account exists
      if (users.has(email)) {
        const token = crypto.randomBytes(16).toString("hex");
        recoveries.set(token, { email, redirect: url.searchParams.get("redirect_to"), challenge: body.code_challenge, method: body.code_challenge_method, used: false });
        lastLink = `${BASE}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${encodeURIComponent(url.searchParams.get("redirect_to") || "")}`;
        lastHash = crypto.createHash("sha256").update(token).digest("hex");
      }
      return send(res, 200, {});
    }

    // Velocity's email templates link to /auth/callback?token_hash=…; the server then calls verifyOtp (POST /verify)
    if (p === "/auth/v1/verify" && req.method === "POST") {
      const r = [...recoveries.entries()].find(([t]) => crypto.createHash("sha256").update(t).digest("hex") === body.token_hash);
      if (!r || r[1].used) return fail(res, 403, "otp_expired", "Email link is invalid or has expired");
      r[1].used = true;
      return send(res, 200, session(r[1].email, "recovery"));
    }
    if (p === "/auth/v1/verify" && req.method === "GET") {
      const r = recoveries.get(url.searchParams.get("token"));
      const to = new URL(url.searchParams.get("redirect_to") || "http://localhost:3111/");
      if (!r || r.used) {
        to.hash = "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
      } else {
        r.used = true;
        const code = crypto.randomUUID();
        codes.set(code, { email: r.email, challenge: r.challenge, method: r.method });
        to.searchParams.set("code", code);
      }
      res.writeHead(303, { Location: to.toString() });
      return res.end();
    }

    if (p === "/auth/v1/user") {
      const email = bearer(req);
      if (!email) return fail(res, 401, "no_authorization", "This endpoint requires a valid Bearer token");
      if (req.method === "PUT") {
        if (body.password) {
          if (String(body.password).length < 8) return fail(res, 422, "weak_password", "Password should be at least 8 characters.");
          if (body.password === users.get(email).password) return fail(res, 422, "same_password", "New password should be different from the old password.");
          users.get(email).password = body.password;
        }
      }
      return send(res, 200, userOf(email));
    }
    if (p === "/auth/v1/signup" && req.method === "POST") {
      const email = String(body.email || "").toLowerCase();
      if (users.has(email)) return fail(res, 422, "user_already_exists", "User already registered");
      users.set(email, { id: crypto.randomUUID(), email, password: body.password });
      return send(res, 200, session(email)); // "Confirm email" off: signed in straight away
    }
    if (p === "/auth/v1/logout") { sessions.delete(String(req.headers.authorization || "").replace(/^Bearer /i, "")); return send(res, 204); }
    // the one row rule that matters for sign-up: a profile can only be written by its own user (Supabase answers 403)
    if (p === "/rest/v1/profiles" && (req.method === "POST" || req.method === "PATCH")) {
      const email = bearer(req);
      const rows = Array.isArray(body) ? body : [body];
      writes.push({ method: req.method, as: email ?? "anon", ids: rows.map((r) => r.id) });
      if (!email || rows.some((r) => r.id && r.id !== users.get(email).id)) return send(res, 403, { code: "42501", message: 'new row violates row-level security policy for table "profiles"' });
      return send(res, 201, []);
    }
    if (p === "/debug/writes") return send(res, 200, writes);
    if (p.startsWith("/rest/v1/rpc/")) return send(res, 200, false);
    if (p.startsWith("/rest/v1")) return send(res, 200, req.headers.accept?.includes("vnd.pgrst.object") ? null : []);
    return fail(res, 404, "not_found", "Not found");
  });
}).listen(PORT, () => console.log(`mock Supabase Auth on ${BASE}`));
