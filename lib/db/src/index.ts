import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function normalizeDatabaseUrl(raw?: string) {
  if (!raw) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return raw.trim().replace(/^['"]|['"]$/g, "");
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const isNeonConnection = databaseUrl.includes("neon.tech");

export const pool = new Pool({
  connectionString: databaseUrl,
  ...(isNeonConnection ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
