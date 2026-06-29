import pg from "pg";
import { apiConfig } from "./config.mjs";

const { Pool } = pg;
let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: apiConfig.DATABASE_URL,
      ssl: apiConfig.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: apiConfig.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  const result = await query("SELECT now() AS now");
  return result.rows[0];
}
