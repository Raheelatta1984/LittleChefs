import "dotenv/config";
import { createDatabase, migrate } from "../db/index.js";
import { seedBuiltinCatalogue } from "../db/seed.js";

const db = await createDatabase();
await migrate(db);
const result = await seedBuiltinCatalogue(db);
console.log(`Seeded ${result.inserted} new built-in recipes (${result.total} in catalogue).`);
await db.close();
