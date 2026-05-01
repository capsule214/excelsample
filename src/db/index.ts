export { sequelize }        from "./connection"
export * from "./models/index"
export { LOCATION_LIST }    from "./seed"

import { sequelize }        from "./connection"
import { ModelMaster }      from "./models/model-master"
import { Location }         from "./models/location"
import { seedDb, LOCATION_LIST } from "./seed"

// association side-effects
import "./models/index"

type G = typeof globalThis & { _seqReady?: Promise<void> }
const g = global as G

export async function initDb(): Promise<void> {
  if (g._seqReady) return g._seqReady
  g._seqReady = (async () => {
    await sequelize.query("PRAGMA journal_mode = WAL")
    await sequelize.query("PRAGMA foreign_keys = ON")
    await sequelize.sync()

    // マイグレーション: locations テーブルが未作成の場合に作成
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS locations (
        location_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)
    // マイグレーション: location_id カラムが未追加の場合に追加
    try {
      await sequelize.query("ALTER TABLE schedules ADD COLUMN location_id TEXT")
    } catch { /* already exists */ }

    // マイグレーション: location_schedules テーブル作成
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS location_schedules (
        id          TEXT PRIMARY KEY,
        location_id TEXT NOT NULL REFERENCES locations(location_id),
        device_id   TEXT NOT NULL REFERENCES devices(device_id),
        start_date  TEXT NOT NULL,
        end_date    TEXT NOT NULL
      )
    `)

    const count = await ModelMaster.count()
    if (count === 0) await seedDb()

    // ロケーションが未シードの場合のみ追加
    const locCount = await Location.count()
    if (locCount === 0) await Location.bulkCreate(LOCATION_LIST)
  })().catch(err => {
    g._seqReady = undefined  // 失敗時はキャッシュをクリアして再試行可能にする
    throw err
  })
  return g._seqReady
}
