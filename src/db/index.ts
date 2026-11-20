import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// One client per server process. In dev, hot reload re-runs this module; caching on globalThis stops each
// reload opening another pool. Keyed by URL so changing DATABASE_URL gets a fresh client.
// Use Supabase's *session* pooler (port 5432) for this long-running server; the transaction pooler (6543)
// is for serverless and left half-finished queries wedging the pool under `next dev`.
type Client = ReturnType<typeof postgres>;
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing: add Supabase's session pooler URL (port 5432) to .env.local");
const g = globalThis as unknown as { dbClient?: { url: string; client: Client } };
if (g.dbClient?.url !== url) {
  g.dbClient?.client.end({ timeout: 1 }).catch(() => {});
  // prepare: false keeps it working on either pooler mode
  g.dbClient = { url, client: postgres(url, { prepare: false, idle_timeout: 20, connect_timeout: 10, max: 5 }) };
}

export const db = drizzle(g.dbClient.client, { schema });
