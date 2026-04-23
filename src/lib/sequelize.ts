import { Sequelize, DataTypes } from "sequelize"
import path from "path"
import fs from "fs"

type G = typeof globalThis & { _seq?: Sequelize; _seqReady?: Promise<void> }
const g = global as G

const dataDir = path.join(process.cwd(), "data")
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const sequelize: Sequelize =
  g._seq ?? new Sequelize({ dialect: "sqlite", storage: path.join(dataDir, "schedule.db"), logging: false })
if (!g._seq) g._seq = sequelize

// ─── Models ───────────────────────────────────────────────────────────────────

export const ModelMaster = sequelize.define("ModelMaster", {
  model_id:   { type: DataTypes.TEXT, primaryKey: true },
  model_name: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "models", timestamps: false })

export const Device = sequelize.define("Device", {
  device_id:              { type: DataTypes.TEXT, primaryKey: true },
  model_id:               { type: DataTypes.TEXT, allowNull: false },
  serial_number:          { type: DataTypes.TEXT, allowNull: false },
  required_delivery_date: { type: DataTypes.TEXT },
}, { tableName: "devices", timestamps: false })

export const Assignee = sequelize.define("Assignee", {
  assignee_id: { type: DataTypes.TEXT, primaryKey: true },
  name:        { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "assignees", timestamps: false })

export const Task = sequelize.define("Task", {
  task_id:    { type: DataTypes.TEXT, primaryKey: true },
  task_name:  { type: DataTypes.TEXT, allowNull: false },
  color_bg:   { type: DataTypes.TEXT, allowNull: false },
  color_fg:   { type: DataTypes.TEXT, allowNull: false },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: "tasks", timestamps: false })

export const Schedule = sequelize.define("Schedule", {
  id:          { type: DataTypes.TEXT, primaryKey: true },
  device_id:   { type: DataTypes.TEXT, allowNull: false },
  task_id:     { type: DataTypes.TEXT, allowNull: false },
  assignee_id: { type: DataTypes.TEXT, allowNull: false },
  start_date:  { type: DataTypes.TEXT, allowNull: false },
  end_date:    { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "schedules", timestamps: false })

export const DisplaySetting = sequelize.define("DisplaySetting", {
  setting_key: { type: DataTypes.TEXT, primaryKey: true },
  value:       { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
}, { tableName: "display_settings", timestamps: false })

// ─── Associations ─────────────────────────────────────────────────────────────

Device.belongsTo(ModelMaster, { foreignKey: "model_id",    as: "model" })
Schedule.belongsTo(Task,      { foreignKey: "task_id",     as: "task" })
Schedule.belongsTo(Assignee,  { foreignKey: "assignee_id", as: "assignee" })
Schedule.belongsTo(Device,    { foreignKey: "device_id",   as: "device" })

// ─── Seed ─────────────────────────────────────────────────────────────────────

function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

async function seedDb() {
  const models = [
    { model_id: "m1", model_name: "機種A" },
    { model_id: "m2", model_name: "機種B" },
    { model_id: "m3", model_name: "機種C" },
    { model_id: "m4", model_name: "機種D" },
    { model_id: "m5", model_name: "機種E" },
  ]
  await ModelMaster.bulkCreate(models)

  const baseDelivery = new Date("2026-07-01")
  const devices = Array.from({ length: 100 }, (_, i) => {
    const delDate = new Date(baseDelivery)
    delDate.setDate(delDate.getDate() + i * 3)
    return {
      device_id:              `d${i + 1}`,
      model_id:               models[i % models.length].model_id,
      serial_number:          `SN-${String(i + 1).padStart(3, "0")}`,
      required_delivery_date: delDate.toISOString().slice(0, 10),
    }
  })
  await Device.bulkCreate(devices)

  const assigneeList = [
    { assignee_id: "a1", name: "山田太郎" },
    { assignee_id: "a2", name: "鈴木花子" },
    { assignee_id: "a3", name: "田中一郎" },
    { assignee_id: "a4", name: "佐藤美咲" },
    { assignee_id: "a5", name: "高橋健太" },
  ]
  await Assignee.bulkCreate(assigneeList)

  const taskList = [
    { task_id: "t1", task_name: "工程A", color_bg: "#3b82f6", color_fg: "#fff", sort_order: 1 },
    { task_id: "t2", task_name: "工程B", color_bg: "#10b981", color_fg: "#fff", sort_order: 2 },
    { task_id: "t3", task_name: "検査",  color_bg: "#f59e0b", color_fg: "#fff", sort_order: 3 },
    { task_id: "t4", task_name: "出荷",  color_bg: "#8b5cf6", color_fg: "#fff", sort_order: 4 },
  ]
  await Task.bulkCreate(taskList)

  const base = new Date("2026-04-16"); base.setHours(0, 0, 0, 0)
  const cols = 120
  const rand = makeLCG(42)
  let id = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schedules: any[] = []

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
      schedules.push({
        id:          `s${id}`,
        device_id:   `d${di}`,
        task_id:     taskList[taskIdx].task_id,
        assignee_id: assigneeList[aIdx].assignee_id,
        start_date:  sd.toISOString().slice(0, 10),
        end_date:    ed.toISOString().slice(0, 10),
      })
      dayOffset = ec + 1 + Math.floor(rand() * 5)
      if (dayOffset >= cols) break
    }
  }

  await Schedule.bulkCreate(schedules.slice(0, 1000))
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  if (g._seqReady) return g._seqReady
  g._seqReady = (async () => {
    await sequelize.query("PRAGMA journal_mode = WAL")
    await sequelize.query("PRAGMA foreign_keys = ON")
    await sequelize.sync()
    const count = await ModelMaster.count()
    if (count === 0) await seedDb()
  })()
  return g._seqReady
}
