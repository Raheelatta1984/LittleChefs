# Credential storage and browser security review — 2026-10-28

## Scope and applicability gate (written before implementation)

Stack: React 19 browser SPA built by Vite, with a same-origin Express 5 API and PostgreSQL/PGlite session store (`package.json:7-18`, `vite.config.ts:7-12`, `server/app.ts:19-23`). This is a browser front-end, API, and static/serverless deployment; it is not a mobile application or a CLI/library.

- **Tier A — APPLICABLE.** The browser persists the bearer credential in local storage and reconstructs an `Authorization` header (`src/lib/api.ts:9-12,27-40,77`). The API also enables credentialed CORS while treating an empty allowlist as permission to reflect any origin (`server/app.ts:29-44`, `server/config.ts:114-120`). Authentication is therefore exposed to any successful XSS or compromised front-end dependency, and the CORS default is unsafe for cookie authentication.
- **Tier B — APPLICABLE.** The project serves HTML and an API. Only a route-specific `Cache-Control: no-store` was found (`server/app.ts:50-51`, `server/routes/auth.ts:115-116,149-150`); no central CSP, nosniff, referrer, frame, permissions, or HSTS mechanism was found.
- **Tier C — APPLICABLE.** The project has npm dependencies and a tracked lockfile (`package-lock.json`), but no CI workflow, dependency audit step, dependency update configuration, or credential-storage regression guard was found (search of `.github/workflows`, `.github/dependabot.yml`, `renovate.json`).

## Findings and planned actions

| # | Severity | Finding | Evidence | Recommended action | Tier |
|---|---|---|---|---|---|
| 1 | High | Session bearer token is returned to browser JavaScript, persisted in `localStorage`, and copied into every authenticated request header. | `server/routes/auth.ts:50,89`; `src/lib/api.ts:9-12,27-40,77` | Issue an opaque server-side session in a production `__Host-session` HttpOnly cookie; purge the legacy key; use same-origin cookies in the SPA; retain explicit bearer transport for non-browser clients. | A |
| 2 | High | Empty `CORS_ORIGINS` means any supplied Origin is reflected while credentials are allowed. | `server/app.ts:29-44`; `server/config.ts:114-120`; `.env.example:67-68` | Default to no CORS. Emit CORS headers only for exact configured origins; never reflect an unconfigured origin. | A |
| 3 | High | Moving the browser to cookie auth would expose unsafe methods to CSRF; no Origin/Referer validation exists. | Search for `csrf`, `origin`, and `referer`; only CORS handling at `server/app.ts:33-44` was found. | For cookie-authenticated POST/PUT/PATCH/DELETE requests, require Origin (or Referer fallback) to match the request origin or exact configured allowlist. Preserve bearer auth for non-browser clients. | A |
| 4 | Medium | No central browser security headers or CSP are emitted. | Search for `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and `Strict-Transport-Security`; no application/config matches were found. | Add central headers for API/server HTML and Vercel static responses. Enforce the CSP safe subset and report the full policy because the single-file build emits inline script/style. | B |
| 5 | Medium | The HTML preview sanitizer injects an inline script into sandboxed `srcDoc`; escaping is hand-written and therefore merits regression coverage. | `server/services/browser.ts:18-27,30-59`; sanitizer tests at `tests/browser.test.ts:159-164` | Keep the sandbox boundary and sanitizer; expand tests for hostile attribute payloads and document that full top-level CSP is report-only pending a nonce/hash-compatible build. | B |
| 6 | Medium | Dependency audit baseline reports four high-severity advisories. | `npm ci` on 2026-10-28: `7 vulnerabilities (1 low, 2 moderate, 4 high)` | Run `npm audit --audit-level=high`, apply non-breaking lockfile upgrades where available, and record any transitive exception. | C |
| 7 | Low | No automated dependency updates, deterministic CI, audit gate, or web-storage credential guard exists. | No `.github` workflow or Dependabot/Renovate config found; `package-lock.json` is tracked. | Add CI using `npm ci`, tests/typecheck/build/audit, a focused web-storage credential guard, and Dependabot. Pin Actions by immutable SHA. | C |
| 8 | Info | No third-party `<script src>` tags, tracked secret `.env` file, JWT implementation, JS-set cookie, IndexedDB credential store, or auth persisted-state library was found. | Searches across `src`, `server`, `api`, `public`, and `index.html` for those constructs returned no matches; only `.env.example` is tracked. | No action. Continue using opaque random sessions stored hash-only server-side (`server/lib/auth.ts:55-64`). | A/C |

## Exact implementation plan

1. `server/lib/auth.ts`, `server/routes/auth.ts`, `server/app.ts`, `server/config.ts`: support HttpOnly session cookies, exact-origin CORS, cookie-auth CSRF checks, server-side logout invalidation, and sensitive-response no-store. Production cookie: `__Host-session; HttpOnly; Secure; SameSite=Lax; Path=/`; development uses a non-prefixed, non-Secure cookie because plain HTTP cannot satisfy the `__Host-` contract.
2. `src/lib/api.ts` and SPA call sites: delete browser bearer handling and credential persistence, purge `chefUniverseAuth` once, bootstrap from `/me`, and rely on same-origin cookie defaults. A deliberately requested `X-Auth-Transport: bearer` response remains available for non-browser clients.
3. `server/app.ts` and `vercel.json`: add security headers. Because `vite-plugin-singlefile` produces inline application script/style and the preview `srcDoc` intentionally injects an isolated bridge script, enforce the safe CSP subset and ship the strict full CSP as Report-Only; do not add `unsafe-inline` or `unsafe-eval` to `script-src`.
4. `tests`: assert production cookie attributes, CSRF rejection, exact CORS behavior, security headers, logout clearing, and legacy-storage purge behavior where practical.
5. `.github/workflows/security.yml`, `.github/dependabot.yml`, `.security-storage-allowlist`: deterministic install, verification, high-severity audit, credential-storage guard, and dependency updates.
6. Re-run tests, typecheck, build, scans, runtime header/cookie/CSRF probes, and audit; append evidence below.

## Discovery notes / not applicable

- **JWT design:** not applicable. Search for JWT libraries and decode/verify calls found none. Authentication uses 256-bit random opaque values and stores only SHA-256 hashes (`server/lib/auth.ts:32-33,55-64`).
- **Cookie attributes before change:** not applicable because no authentication cookie existed; searches for cookie setters and cookie attributes returned no matches.
- **CDN SRI:** not applicable. No external `<script src="https://…">` exists in source HTML.
- **Exposed docs/debug tooling:** no Swagger/OpenAPI/GraphQL playground or debug toolbar was found. Vite source maps are not enabled (`vite.config.ts`).
- **Other local storage:** gameplay, “what’s new”, and finder-history values exist (`src/App.tsx:74-87,160`; `src/data/whatsNew.ts:30-38`; `src/components/SmartRecipeFinder.tsx:112-127`) but are non-credential preferences and are outside Tier A.

## Baseline verification (before edits)

- `npm ci`: pass; 203 packages audited; 7 vulnerabilities (1 low, 2 moderate, 4 high).
- `npm test`: pass; 143/143 tests.
- `npm run typecheck`: pass.
- `npm run build`: pass; Vite build, API TypeScript build, migration copy, and API wiring verification all succeeded.

## Changes applied

- Browser auth no longer reads, writes, or sends a bearer credential. `src/lib/api.ts:25-42` only removes the legacy `chefUniverseAuth` key; `src/lib/api.ts:68-77` sends same-origin requests without an Authorization header. `src/App.tsx` restores the profile from `/me`.
- The server issues browser sessions through production `__Host-session` cookies with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`, and a 30-day default maximum age (`server/lib/auth.ts:14-29`; `server/routes/auth.ts:14-21`). Logout revokes the database session and clears the same cookie (`server/routes/auth.ts:105-114`).
- Explicit non-browser clients retain bearer support by requesting `X-Auth-Transport: bearer`; this is documented in `docs/API.md`. Authentication accepts either transport (`server/lib/auth.ts:206-227`).
- Cookie-authenticated unsafe methods require a same-origin/configured Origin or Referer, while bearer requests retain their custom-header CSRF property (`server/app.ts:105-123`).
- Empty CORS configuration now means no CORS; only exact configured origins receive credentialed CORS headers (`server/app.ts:71-89`).
- Central security headers, authenticated-response `no-store`, blocked production tooling routes, and Vercel static headers are present (`server/app.ts:57-69,109-110,140-150`; `vercel.json`). CSP's safe subset is enforced; the strict full policy is Report-Only because the current single-file Vite output contains inline script/style. Neither policy grants `unsafe-inline` or `unsafe-eval` to scripts.
- CI, Dependabot, SHA-pinned Actions, deterministic `npm ci`, a web-storage guard, and a high-severity audit gate were added (`.github/workflows/security.yml`, `.github/dependabot.yml`, `.security-storage-allowlist`). Vite and transitive lockfile dependencies were updated to patched versions (`package.json`, `package-lock.json`).
- Security regression coverage is in `tests/security.test.ts`, `tests/browser.test.ts`, and `tests/vercel-config.test.ts`.

## Post-change verification evidence

Commands were run from the repository root on 2026-10-28.

- `npm test`: **pass**, 150/150 tests (baseline 143/143; seven security/sanitizer tests added).
- `npm run typecheck`: **pass**, both client and server TypeScript projects.
- `npm run build`: **pass**, Vite 7.3.7 client build, API TypeScript build, migration copy, and serverless rewrite verification.
- Credential-storage CI grep: **clean**. The only remaining `chefUniverseAuth` reference is the one-time `localStorage.removeItem` migration at `src/lib/api.ts:10,25-42`; there are no credential `setItem`/`getItem` matches in client source.
- `npm audit --audit-level=high`: **pass, 0 vulnerabilities** (baseline: 7 total, including 4 high).
- Production runtime probe (`NODE_ENV=production npm start`, local port 8787): root response included enforced CSP, CSP Report-Only, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy`. HSTS was correctly omitted over local plain HTTP; Vercel HTTPS config includes it.
- Runtime browser sign-up returned `__Host-session=<redacted>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`, and its JSON body contained no token.
- Runtime cookie-authenticated `POST /api/chefs/sign-out` with `Origin: https://evil.example`: **403**.
- Runtime `/docs`, `/api/docs`, `/swagger`, and `/graphql`: **404**.
- No Playwright or Cypress harness exists. Node integration tests exercised the HTTP behavior, but an automated real-browser CSP-console smoke test remains unavailable.

## Behaviour change and follow-up

- **Forced one-time re-login:** existing browser bearer tokens are deleted from local storage and cannot be migrated into HttpOnly cookies from JavaScript. Users sign in once to establish the new cookie.
- **CORS default changed:** cross-origin API callers must be explicitly listed in `CORS_ORIGINS`; the same-origin SPA is unaffected.
- **CSP follow-up:** replace or configure the single-file build with a nonce/hash-compatible deployment, remove inline styles where practical, inspect Report-Only telemetry, then promote the full CSP to enforcement. This review intentionally did not weaken `script-src` to make the current build pass.
