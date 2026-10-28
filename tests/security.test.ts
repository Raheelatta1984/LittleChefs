import "./setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import type { Database } from "../server/db/index.js";
import { freshDatabase, startTestServer } from "./helpers.js";

let db: Database;
let server: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
  db = await freshDatabase();
  server = await startTestServer(db);
});

after(async () => {
  await server.close();
  await db.close();
});

describe("browser session hardening", () => {
  it("emits the central browser security headers", async () => {
    const response = await fetch(`${server.base}/health`);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.match(response.headers.get("content-security-policy-report-only") ?? "", /script-src 'self'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("uses an HttpOnly SameSite cookie for browsers and does not expose the token in JSON", async () => {
    const response = await fetch(`${server.base}/chefs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Cookie Chef", role: "teen" }),
    });
    assert.equal(response.status, 201);
    const body = await response.json() as Record<string, unknown>;
    assert.equal("token" in body, false);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);

    const cookie = setCookie.split(";", 1)[0];
    const me = await fetch(`${server.base}/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal(me.headers.get("cache-control"), "no-store");

    const foreign = await fetch(`${server.base}/chefs/sign-out`, {
      method: "POST",
      headers: { cookie, origin: "https://evil.example" },
    });
    assert.equal(foreign.status, 403);

    const missing = await fetch(`${server.base}/chefs/sign-out`, { method: "POST", headers: { cookie } });
    assert.equal(missing.status, 403);

    const ownOrigin = new URL(server.base).origin;
    const logout = await fetch(`${server.base}/chefs/sign-out`, {
      method: "POST",
      headers: { cookie, origin: ownOrigin },
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") ?? "", /^session=;/);
  });

  it("does not reflect unconfigured origins or allow credentialed wildcard CORS", async () => {
    const response = await fetch(`${server.base}/health`, { headers: { origin: "https://evil.example" } });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(response.headers.get("access-control-allow-credentials"), null);

    const preflight = await fetch(`${server.base}/health`, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "GET" },
    });
    assert.equal(preflight.status, 403);
  });

  it("does not expose documentation or playground routes in the production server", async () => {
    for (const path of ["/docs", "/api/docs", "/swagger", "/graphql"]) {
      const response = await fetch(`${new URL(server.base).origin}${path}`);
      assert.equal(response.status, 404, `${path} should not be exposed`);
    }
  });

  it("uses the __Host- cookie contract in production", () => {
    const script = `process.env.NODE_ENV='production'; import('./server/lib/auth.ts').then(({SESSION_COOKIE_NAME,sessionCookieOptions}) => console.log(JSON.stringify({name:SESSION_COOKIE_NAME,options:sessionCookieOptions()})))`;
    const output = execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    const value = JSON.parse(output) as { name: string; options: Record<string, unknown> };
    assert.equal(value.name, "__Host-session");
    assert.equal(value.options.httpOnly, true);
    assert.equal(value.options.secure, true);
    assert.equal(value.options.sameSite, "lax");
    assert.equal(value.options.path, "/");
    assert.equal("domain" in value.options, false);
  });
});
