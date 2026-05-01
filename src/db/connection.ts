import { Sequelize } from "sequelize"
import path from "path"
import fs from "fs"

type G = typeof globalThis & { _seq?: Sequelize }
const g = global as G

const dataDir = path.join(process.cwd(), "data")
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

export const sequelize: Sequelize =
  g._seq ?? new Sequelize({ dialect: "sqlite", storage: path.join(dataDir, "schedule.db"), logging: false })
if (!g._seq) g._seq = sequelize
