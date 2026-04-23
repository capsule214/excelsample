import { NextResponse } from "next/server"
import { initDb, Task } from "@/lib/sequelize"

export async function GET() {
  await initDb()
  const rows = await Task.findAll({ order: [["sort_order", "ASC"]] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((rows.map(r => r.toJSON()) as any[]).map(r => ({
    id:        r.task_id,
    name:      r.task_name,
    colorBg:   r.color_bg,
    colorFg:   r.color_fg,
    sortOrder: r.sort_order,
  })))
}
