import { describe, expect, test } from "bun:test"
import type { Connection } from "mysql2/promise"

import { replaceTransferManifest } from "./transfers.repository"

describe("replaceTransferManifest", () => {
  test("binds the transfer id once for every parcel row", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const db = {
      execute: async (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        return [{ affectedRows: 0 }, []]
      },
    } as unknown as Connection

    await replaceTransferManifest(db, "2", ["2", "1"])

    expect(calls).toHaveLength(2)
    expect(calls[1]?.sql).toContain("VALUES (?, ?), (?, ?)")
    expect(calls[1]?.params).toEqual(["2", "2", "2", "1"])
  })
})
