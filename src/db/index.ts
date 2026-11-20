import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// One client per server process. In dev, hot reload re-runs this module; caching on globalThis stops each
// reload opening another pool. Keyed by URL so changing DATABASE_URL gets a fresh client.
// Locally use Supabase's *session* pooler (port 5432): the transaction pooler (6543) left half-finished queries
// wedging the pool under `next dev`. On Vercel (serverless) use the transaction pooler (6543).
type DB = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as unknown as { dbClient?: { url: string; client: ReturnType<typeof postgres>; db: DB } };

function getDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing: set Supabase's pooler URL in .env.local (port 5432) or in Vercel (port 6543)");
  if (g.dbClient?.url !== url) {
    g.dbClient?.client.end({ timeout: 1 }).catch(() => {});
    // prepare: false keeps it working on either pooler mode
    const client = postgres(url, { prepare: false, idle_timeout: 20, connect_timeout: 10, max: 5 });
    g.dbClient = { url, client, db: drizzle(client, { schema }) };
  }
  return g.dbClient.db;
}

// Lazy: `next build` imports every route to collect config, and must not need a database URL to do that.
// The first real query creates the client (and reports a missing URL clearly).
export const db = new Proxy({} as DB, { get: (_target, key) => Reflect.get(getDb(), key) });
