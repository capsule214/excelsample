import { NextResponse } from "next/server"
import db from "@/lib/db"

export function GET() {
  const rows = db.prepare(
    "SELECT task_id, task_name, color_bg, color_fg, sort_order FROM tasks ORDER BY sort_order"
  ).all() as { task_id: string; task_name: string; color_bg: string; color_fg: string; sort_order: number }[]

  return NextResponse.json(rows.map(r => ({
    id:        r.task_id,
    name:      r.task_name,
    colorBg:   r.color_bg,
    colorFg:   r.color_fg,
    sortOrder: r.sort_order,
  })))
}
