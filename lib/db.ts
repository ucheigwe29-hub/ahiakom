import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
export interface DB {
  query<T = Record<string, any>>(
    sql: string,
    args?: any[],
  ): Promise<{ rows: T[] }>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
}
const globalDB = globalThis as unknown as { ahiakomDB?: Promise<DB> };
export function database(): Promise<DB> {
  return (globalDB.ahiakomDB ??= (async () => {
    if (process.env.DATABASE_DRIVER === "postgres") {
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
      });
      const wrap = (client: any): DB => ({
        query: (s, a) => client.query(s, a),
        transaction: async (fn) => {
          const c = await pool.connect();
          try {
            await c.query("BEGIN");
            const r = await fn(wrap(c));
            await c.query("COMMIT");
            return r;
          } catch (e) {
            await c.query("ROLLBACK");
            throw e;
          } finally {
            c.release();
          }
        },
      });
      return wrap(pool);
    }
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_LOCAL_DB !== "true"
    )
      throw new Error("Production requires PostgreSQL");
    const dataPath =
      process.env.DATABASE_PATH ?? path.join(process.cwd(), ".data/ahiakom");
    if (dataPath !== "memory://")
      await mkdir(path.dirname(dataPath), { recursive: true });
    const pg = new PGlite(dataPath);
    await pg.waitReady;
    const wrap = (x: any): DB => ({
      query: (s, a = []) => x.query(s, a),
      transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    });
    return wrap(pg);
  })());
}
export async function migrate() {
  const db = await database();
  const schema = await readFile(
    path.join(process.cwd(), "db/schema.sql"),
    "utf8",
  );
  await db.transaction(async (tx) => {
    for (const statement of schema.split(";").filter((s) => s.trim()))
      await tx.query(statement);
  });
}
export async function audit(
  db: DB,
  actor: string | undefined,
  action: string,
  entity: string,
) {
  await db.query(
    "INSERT INTO audit(id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)",
    [crypto.randomUUID(), actor ?? null, action, entity],
  );
}
