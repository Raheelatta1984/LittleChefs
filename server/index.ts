import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createDatabase, migrate } from "./db/index.js";
import { seedBuiltinCatalogue } from "./db/seed.js";

async function main() {
  const db = await createDatabase();
  const ran = await migrate(db);
  if (ran.length > 0) console.log(`[db] applied migrations: ${ran.join(", ")}`);

  if (process.env.SEED_BUILTINS !== "false") {
    const seeded = await seedBuiltinCatalogue(db);
    if (seeded.inserted > 0) {
      console.log(`[db] seeded ${seeded.inserted} built-in recipes into the shared catalogue`);
    }
  }

  const app = createApp(db);
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[api] Chef Universe listening on http://0.0.0.0:${config.port}`);
    console.log(`[api] database driver: ${config.db.driver}${config.llm.apiKey ? " · AI import: on" : " · AI import: heuristic only"}`);
  });

  const shutdown = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[api] failed to start", error);
  process.exit(1);
});
