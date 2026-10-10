import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import { toUtcDate } from "@/db/sql"

/**
 * The profile row — a single `users` projection, scoped by the session's own
 * id. Rider and staff reads both land here because they are the same table;
 * the route guard decides which audience may call it.
 */

export type UserProfileRecord = {
  id: string
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string
}

const PROFILE_COLUMNS = `id, name, email, phone, avatar_url, created_at`

function profileRow(row: Record<string, unknown>): UserProfileRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone === null ? null : String(row.phone),
    avatarUrl: row.avatar_url === null ? null : String(row.avatar_url),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
  }
}

export async function selectUserProfile(
  db: Pool,
  userId: string,
): Promise<UserProfileRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [
    userId,
  ])
  return rows[0] ? profileRow(rows[0]) : null
}

export async function updateUserProfile(
  db: Pool,
  userId: string,
  input: { name?: string; avatarUrl?: string | null },
): Promise<UserProfileRecord | null> {
  const sets: string[] = []
  const params: (string | null)[] = []

  if (input.name !== undefined) {
    sets.push("name = ?")
    params.push(input.name)
  }
  if (input.avatarUrl !== undefined) {
    sets.push("avatar_url = ?")
    params.push(input.avatarUrl)
  }

  if (sets.length === 0) return selectUserProfile(db, userId)

  params.push(userId)
  await db.execute<OkPacket>(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params)

  return selectUserProfile(db, userId)
}