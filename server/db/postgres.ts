import pg from "pg";
import type { Database, Queryable, QueryResult, Row } from "./index.js";

const { Pool } = pg;

/**
 * Hosted / containerised PostgreSQL driver.
 * The API connects as the owner for migrations and as `chef_app` (RLS-enforced)
 * inside withChef().
 */
export async function createDatabase(): Promise<Database> {
  const { config } = await import("../config.js");
  const pool = new Pool({
    connectionString: config.db.url,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

  const runner = (client: pg.PoolClient | pg.Pool) =>
    async <R extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<R>> => {
      const result = await client.query(sql, params as unknown[] | undefined);
      return { rows: result.rows as R[] };
    };

  const scoped = (role: string | null) =>
    async <T>(fn: (tx: Queryable) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (role) await client.query(`set local role ${role}`);
        const tx: Queryable = {
          query: runner(client),
          exec: async (sql: string) => {
            await client.query(sql);
          },
        };
        const value = await fn(tx);
        await client.query("commit");
        return value;
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          /* ignore */
        }
        throw error;
      } finally {
        client.release();
      }
    };

  const query = runner(pool);

  return {
    query,
    exec: async (sql: string) => {
      await pool.query(sql);
    },
    transaction: scoped(null),
    withChef: async <T>(chefId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> =>
      scoped("chef_app")(async (tx) => {
        await tx.query("select set_config('app.chef_id', $1, true)", [chefId]);
        return fn(tx);
      }),
    close: async () => {
      await pool.end();
    },
  };
}
