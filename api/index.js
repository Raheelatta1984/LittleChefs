// Vercel serverless function for the whole Chef Universe API.
//
// Every `/api/*` request is routed here by the rewrite in vercel.json:
//
//   { "source": "/api/(.*)", "destination": "/api?__path=/$1" }
//
// Why a flat `api/index.js` and an explicit rewrite instead of a bracketed
// catch-all file such as `api/[...path].js`?
//
// Vercel's file-system routing only supports **single-segment** parameters in
// the `api/` directory: `[...path].js` is compiled to `^/api/([^/]+)$`, so
// nested routes like `/api/chefs/sign-in`, `/api/recipes/:id` and
// `/api/catalogue/:id/claim` never match and the platform answers with a bare
// 404 — exactly the "The recipe kitchen isn't responding (404)" bug. A plain
// `api/index.js` matches only `/api` exactly, so the rewrite in vercel.json is
// what sends every depth of path to it, carrying the real path in `__path`
// (Vercel hands a function its rewrite *destination*, not the requested URL).
// server/vercel.ts rebuilds the `/api/...` URL from `__path` before Express
// sees the request.
//
// There must be exactly ONE function file in api/: a second function would get
// its own cold start, its own in-memory app and (with the PGlite demo driver)
// its own database, splitting chefs and recipes across two isolated instances.
import handler from "../dist-server/server/vercel.js";

export const config = { maxDuration: 60 };

export default handler;
