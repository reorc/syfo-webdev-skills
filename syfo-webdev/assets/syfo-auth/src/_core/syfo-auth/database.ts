import 'server-only';
import { randomUUID } from 'node:crypto';
import { type Pool, type RowDataPacket, createPool } from 'mysql2/promise';
import type { AppUser } from './types';

type AppUserRow = RowDataPacket & {
  id: string;
  issuer: string;
  subject: string;
  syfo_server_id: string;
  email: string | null;
  email_verified: number | boolean | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string;
};

type AppUserIdentity = {
  issuer: string;
  subject: string;
  serverId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
};

let pool: Pool | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Syfo App database`);
  return value;
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function syfoAppDatabase(): Pool {
  if (pool) return pool;
  const deployed = process.env.NODE_ENV === 'production';
  const allowInsecureLocal = process.env.SYFO_ALLOW_INSECURE_LOCAL_TIDB === '1';
  if (deployed && allowInsecureLocal) {
    throw new Error('SYFO_ALLOW_INSECURE_LOCAL_TIDB is forbidden in production');
  }
  pool = createPool({
    host: required('TIDB_HOST'),
    port: boundedInteger('TIDB_PORT', 4000, 1, 65_535),
    user: required('TIDB_USER'),
    password: required('TIDB_PASSWORD'),
    database: required('TIDB_DATABASE'),
    ...(allowInsecureLocal ? {} : { ssl: { minVersion: 'TLSv1.2' as const } }),
    connectionLimit: boundedInteger('TIDB_POOL_SIZE', 4, 1, 10),
    maxIdle: boundedInteger('TIDB_POOL_SIZE', 4, 1, 10),
    idleTimeout: 60_000,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    dateStrings: true,
  });
  return pool;
}

function optional(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(`${value}Z`).toISOString();
}

function mapAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    issuer: row.issuer,
    subject: row.subject,
    serverId: row.syfo_server_id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.email_verified === null
      ? {}
      : { emailVerified: row.email_verified === true || row.email_verified === 1 }),
    ...(row.display_name ? { name: row.display_name } : {}),
    ...(row.avatar_url ? { picture: row.avatar_url } : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

export async function upsertAppUser(identity: AppUserIdentity): Promise<AppUser> {
  const connection = await syfoAppDatabase().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO app_users (
         id, issuer, subject, syfo_server_id, email, email_verified,
         display_name, avatar_url, created_at, updated_at, last_login_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         syfo_server_id = VALUES(syfo_server_id),
         email = COALESCE(VALUES(email), email),
         email_verified = COALESCE(VALUES(email_verified), email_verified),
         display_name = COALESCE(VALUES(display_name), display_name),
         avatar_url = COALESCE(VALUES(avatar_url), avatar_url),
         updated_at = CURRENT_TIMESTAMP(3),
         last_login_at = CURRENT_TIMESTAMP(3)`,
      [
        randomUUID(),
        identity.issuer,
        identity.subject,
        identity.serverId,
        optional(identity.email),
        identity.emailVerified ?? null,
        optional(identity.name),
        optional(identity.picture),
      ],
    );
    const [rows] = await connection.execute<AppUserRow[]>(
      `SELECT id, issuer, subject, syfo_server_id, email, email_verified,
              display_name, avatar_url, created_at, updated_at, last_login_at
         FROM app_users
        WHERE issuer = ? AND subject = ?
        LIMIT 1`,
      [identity.issuer, identity.subject],
    );
    if (rows.length !== 1) throw new Error('app_user_upsert_missing');
    await connection.commit();
    return mapAppUser(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCurrentAppUser(id: string): Promise<AppUser | null> {
  const [rows] = await syfoAppDatabase().execute<AppUserRow[]>(
    `SELECT id, issuer, subject, syfo_server_id, email, email_verified,
            display_name, avatar_url, created_at, updated_at, last_login_at
       FROM app_users
      WHERE id = ?
      LIMIT 1`,
    [id],
  );
  return rows[0] ? mapAppUser(rows[0]) : null;
}

export async function requireAppUser(id: string): Promise<AppUser> {
  const user = await getCurrentAppUser(id);
  if (!user) throw new Error('app_user_not_found');
  return user;
}
