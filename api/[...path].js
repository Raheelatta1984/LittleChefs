// Vercel catch-all API function: every /api/* request runs the full
// Chef Universe Express app (compiled by `npm run build:api`).
// Without this file the deployment is static-only and /api/* 404s.
import handler from "../dist-server/server/vercel.js";

export const config = { maxDuration: 60 };

export default handler;
