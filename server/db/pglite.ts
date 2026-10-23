import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Database, Queryable, QueryResult, Row } from "./index.js";

/**
 * PGlite = actual PostgreSQL compiled to WASM, persisted to disk.
 * Same SQL, same RLS, same extensions as a hosted Postgres — only the driver
 * changes when DATABASE_URL points at a real server.
 *
 * PGlite has a single connection, so transactions are serialised through a
 * mutex: overlapping withChef() calls can never see each other's app.chef_id.
 */
export async function createDatabase(): Promise<Database> {
  const { config } = await import("../config.js");
  if (config.db.pgliteDir !== "memory") {
    mkdirSync(config.db.pgliteDir, { recursive: true });
  }
  const client =
    config.db.pgliteDir === "memory"
      ? await PGlite.create()
      : await PGlite.create(config.db.pgliteDir);
  let lock: Promise<unknown> = Promise.resolve();

  const run = (sql: string, params?: unknown[]) => client.query(sql, params as unknown[] | undefined);

  const serialise = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = lock.then(fn, fn);
    lock = next.catch(() => undefined);
    return next;
  };

  const txRunner = (role: string | null) =>
    <T>(fn: (tx: Queryable) => Promise<T>): Promise<T> =>
      serialise(async () => {
        await client.exec("begin");
        try {
          if (role) {
            await client.exec("set local role chef_app");
          }
          const tx: Queryable = {
            query: async <R extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
              const result = await run(sql, params);
              return { rows: result.rows as R[] };
            },
            exec: async (sql: string) => {
              await client.exec(sql);
            },
          };
          const value = await fn(tx);
          await client.exec("commit");
          return value;
        } catch (error) {
          try {
            await client.exec("rollback");
          } catch {
            /* connection already closed */
          }
          throw error;
        }
      });

  return {
    query: async <R extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
      const result = await run(sql, params);
      return { rows: result.rows as R[] };
    },
    exec: async (sql: string) => {
      await client.exec(sql);
    },
    transaction: (fn) => txRunner(null)(fn),
    withChef: async <T>(chefId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> =>
      txRunner("chef_app")(async (tx) => {
        await tx.query("select set_config('app.chef_id', $1, true)", [chefId]);
        return fn(tx);
      }),
    close: async () => {
      await client.close();
    },
  };
}
