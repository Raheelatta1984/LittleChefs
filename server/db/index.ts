import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

export type Row = Record<string, unknown>;
export type QueryResult<T extends Row = Row> = { rows: T[] };

export interface Queryable {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Runs a multi-statement SQL batch (migrations, DDL). */
  exec?(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  exec(sql: string): Promise<void>;
  /** Runs fn inside a transaction as the table owner (bypasses RLS). Use sparingly. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /**
   * Runs fn inside a transaction scoped to one chef:
   *   BEGIN; SET LOCAL ROLE chef_app; set_config('app.chef_id', …);
   * Every statement in fn is subject to Postgres row-level security.
   */
  withChef<T>(chefId: string, fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function migrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith(".sql")).sort();
}

export async function migrate(db: Database): Promise<string[]> {
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const applied = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name),
  );
  const ran: string[] = [];
  for (const file of await migrationFiles()) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      // PGlite lacks a full DO-block-free path for some statements, so run the
      // whole file as one batch and record it in the same transaction.
      if (!tx.exec) throw new Error("database driver cannot run migration batches");
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}

export async function createDatabase(): Promise<Database> {
  const driver =
    config.db.driver === "postgres"
      ? await import("./postgres.js")
      : await import("./pglite.js");
  return driver.createDatabase();
}
