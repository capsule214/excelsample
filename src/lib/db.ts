import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

/* ─── シングルトン (Next.js HMR 対策) ─── */
const globalWithDb = global as typeof globalThis & { _scheduleDb?: Database.Database }

function getDb(): Database.Database {
  if (globalWithDb._scheduleDb) return globalWithDb._scheduleDb

  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const db = new Database(path.join(dataDir, "schedule.db"))
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  /* ─── スキーマ作成 ─── */
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      model_id   TEXT PRIMARY KEY,
      model_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id              TEXT PRIMARY KEY,
      model_id               TEXT NOT NULL REFERENCES models(model_id),
      serial_number          TEXT NOT NULL,
      required_delivery_date TEXT
    );

    CREATE TABLE IF NOT EXISTS assignees (
      assignee_id TEXT PRIMARY KEY,
      name        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id    TEXT PRIMARY KEY,
      task_name  TEXT NOT NULL,
      color_bg   TEXT NOT NULL,
      color_fg   TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id          TEXT PRIMARY KEY,
      device_id   TEXT NOT NULL REFERENCES devices(device_id),
      task_id     TEXT NOT NULL REFERENCES tasks(task_id),
      assignee_id TEXT NOT NULL REFERENCES assignees(assignee_id),
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL
    );
  `)

  /* ─── 初回シード ─── */
  const seeded = (db.prepare("SELECT COUNT(*) as n FROM models").get() as { n: number }).n
  if (seeded === 0) seed(db)

  globalWithDb._scheduleDb = db
  return db
}

/* ─── LCG 疑似乱数 (クライアント側と同じシード) ─── */
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

function seed(db: Database.Database) {
  const insertModel    = db.prepare("INSERT INTO models VALUES (?,?)")
  const insertDevice   = db.prepare("INSERT INTO devices VALUES (?,?,?,?)")
  const insertAssignee = db.prepare("INSERT INTO assignees VALUES (?,?)")
  const insertTask     = db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?)")
  const insertSchedule = db.prepare("INSERT INTO schedules VALUES (?,?,?,?,?,?)")

  /* 機種マスタ */
  const models = [
    ["m1", "機種A"], ["m2", "機種B"], ["m3", "機種C"],
    ["m4", "機種D"], ["m5", "機種E"],
  ]
  for (const m of models) insertModel.run(...m)

  /* 装置マスタ (100台) */
  const baseDelivery = new Date("2026-07-01")
  for (let i = 1; i <= 100; i++) {
    const modelId = models[(i - 1) % models.length][0]
    const serial  = `SN-${String(i).padStart(3, "0")}`
    const delDate = new Date(baseDelivery)
    delDate.setDate(delDate.getDate() + (i - 1) * 3)
    insertDevice.run(`d${i}`, modelId, serial, delDate.toISOString().slice(0, 10))
  }

  /* 担当者マスタ */
  const assigneeList = [
    ["a1", "山田太郎"], ["a2", "鈴木花子"], ["a3", "田中一郎"],
    ["a4", "佐藤美咲"], ["a5", "高橋健太"],
  ]
  for (const a of assigneeList) insertAssignee.run(...a)

  /* タスクマスタ */
  const taskList = [
    ["t1", "工程A", "#3b82f6", "#fff", 1],
    ["t2", "工程B", "#10b981", "#fff", 2],
    ["t3", "検査",  "#f59e0b", "#fff", 3],
    ["t4", "出荷",  "#8b5cf6", "#fff", 4],
  ]
  for (const t of taskList) insertTask.run(...t)

  /* 予定データ (1000件) */
  const base = new Date("2026-04-16"); base.setHours(0, 0, 0, 0)
  const cols = 120
  const rand = makeLCG(42)
  let id = 0
  const schedules: [string,string,string,string,string,string][] = []

  for (let di = 1; di <= 100; di++) {
    let dayOffset = Math.floor(rand() * 10)
    for (let j = 0; j < 10; j++) {
      const taskIdx = j % 4
      const len     = 3 + Math.floor(rand() * 12)
      const sc      = Math.min(dayOffset, cols - 2)
      const ec      = Math.min(sc + len,  cols - 1)
      const aIdx    = (++id) % assigneeList.length
      const sd      = new Date(base); sd.setDate(base.getDate() + sc)
      const ed      = new Date(base); ed.setDate(base.getDate() + ec)
      schedules.push([
        `s${id}`,
        `d${di}`,
        taskList[taskIdx][0] as string,
        assigneeList[aIdx][0] as string,
        sd.toISOString().slice(0, 10),
        ed.toISOString().slice(0, 10),
      ])
      dayOffset = ec + 1 + Math.floor(rand() * 5)
      if (dayOffset >= cols) break
    }
  }

  const doSeed = db.transaction(() => {
    for (const row of schedules.slice(0, 1000)) insertSchedule.run(...row)
  })
  doSeed()
}

export default getDb()
