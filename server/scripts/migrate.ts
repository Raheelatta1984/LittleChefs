import "dotenv/config";
import { createDatabase, migrate } from "../db/index.js";

const db = await createDatabase();
const ran = await migrate(db);
console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database already up to date.");
await db.close();
