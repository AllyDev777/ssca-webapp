import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

/**
 * MySQL access layer. Rules (see CLAUDE.md §4):
 * - Every statement goes through `execute` with `?` placeholders — never concatenate values into SQL.
 * - Any dynamic identifier (ORDER BY column, direction) must come from a hard-coded whitelist.
 */

export type SqlParam = string | number | boolean | Date | null;
export type Db = Pool | PoolConnection;

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing environment variable ${name}`);
  return value;
}

function createPool(): Pool {
  const pool = mysql.createPool({
    host: env("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: env("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    database: env("DB_NAME"),
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    waitForConnections: true,
    enableKeepAlive: true,
    charset: "utf8mb4_unicode_ci",
    multipleStatements: false,
    // DATETIME columns are UTC; DATE columns (week_start) stay as 'YYYY-MM-DD' strings
    // so they are never shifted by the Node process's local timezone.
    timezone: "Z",
    dateStrings: ["DATE"],
  });

  // CURRENT_TIMESTAMP / UTC_TIMESTAMP defaults must be UTC regardless of the server's zone.
  // The promise wrapper re-emits the core connection, so listen on the core pool.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });

  return pool;
}

// Reuse one pool across hot reloads in dev; created lazily so builds don't need DB env vars.
const globalForDb = globalThis as typeof globalThis & { __sscaPool?: Pool };

export function getPool(): Pool {
  globalForDb.__sscaPool ??= createPool();
  return globalForDb.__sscaPool;
}

/** SELECT returning all rows. Pass a transaction connection as `db` to run inside it. */
export async function query<T>(sql: string, params: SqlParam[] = [], db: Db = getPool()): Promise<T[]> {
  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

/** SELECT returning the first row, or null. */
export async function queryOne<T>(sql: string, params: SqlParam[] = [], db: Db = getPool()): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE. */
export async function execute(sql: string, params: SqlParam[] = [], db: Db = getPool()): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}

/** Runs `fn` in a transaction; commits on success, rolls back on any throw. */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}
