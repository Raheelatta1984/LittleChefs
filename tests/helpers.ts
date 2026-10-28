import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Database } from "../server/db/index.js";

export async function freshDatabase(): Promise<Database> {
  const { createDatabase, migrate } = await import("../server/db/index.js");
  const db = await createDatabase();
  await migrate(db);
  return db;
}

export type TestChef = { id: string; token: string; name: string; role: string };

export async function createChef(
  db: Database,
  name: string,
  role: "junior" | "teen" | "adult" | "master" = "teen",
): Promise<TestChef> {
  const { createSession } = await import("../server/lib/auth.js");
  const inserted = await db.query<{ id: string }>(
    `insert into chefs (display_name, role_id) values ($1,$2) returning id`,
    [name, role],
  );
  const id = inserted.rows[0].id;
  const session = await createSession(db, id);
  return { id, token: session.token, name, role };
}

export async function startTestServer(
  db: Database,
  deps: import("../server/app.js").AppDeps = {},
): Promise<{ base: string; close: () => Promise<void> }> {
  const { createApp } = await import("../server/app.js");
  const app = createApp(db, deps);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export async function api<T = unknown>(
  base: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "x-auth-transport": "bearer",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: response.status, body: body as T };
}
