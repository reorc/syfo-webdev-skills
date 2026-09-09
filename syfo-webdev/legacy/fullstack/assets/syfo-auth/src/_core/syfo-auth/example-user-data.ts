import 'server-only';
import type { RowDataPacket } from 'mysql2/promise';
import { syfoAppDatabase } from './database';

type PreferenceRow = RowDataPacket & { preferences: unknown };

export async function getUserPreferences(appUserId: string): Promise<Record<string, unknown>> {
  const [rows] = await syfoAppDatabase().execute<PreferenceRow[]>(
    'SELECT preferences FROM app_user_preferences WHERE app_user_id = ? LIMIT 1',
    [appUserId],
  );
  const value = rows[0]?.preferences;
  if (!value) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

export async function setUserPreferences(
  appUserId: string,
  preferences: Record<string, unknown>,
): Promise<void> {
  await syfoAppDatabase().execute(
    `INSERT INTO app_user_preferences (app_user_id, preferences, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE preferences = VALUES(preferences), updated_at = CURRENT_TIMESTAMP(3)`,
    [appUserId, JSON.stringify(preferences)],
  );
}
