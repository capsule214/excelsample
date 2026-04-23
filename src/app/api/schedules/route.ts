import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"
import { randomUUID } from "crypto"

const SELECT_SQL = `
  SELECT s.id, s.device_id, s.task_id, t.task_name, t.color_bg, t.color_fg,
         s.start_date, s.end_date, s.assignee_id, a.name as assignee_name
  FROM schedules s
  JOIN tasks    t ON s.task_id     = t.task_id
  JOIN assignees a ON s.assignee_id = a.assignee_id
  ORDER BY s.start_date
`

function toRow(r: Record<string, string>) {
  return {
    id:           r.id,
    deviceId:     r.device_id,
    taskId:       r.task_id,
    taskName:     r.task_name,
    colorBg:      r.color_bg,
    colorFg:      r.color_fg,
    startDate:    r.start_date,
    endDate:      r.end_date,
    assigneeId:   r.assignee_id,
    assigneeName: r.assignee_name,
  }
}

export function GET() {
  const rows = db.prepare(SELECT_SQL).all() as Record<string, string>[]
  return NextResponse.json(rows.map(toRow))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id   = randomUUID()
  db.prepare(
    "INSERT INTO schedules (id, device_id, task_id, assignee_id, start_date, end_date) VALUES (?,?,?,?,?,?)"
  ).run(id, body.deviceId, body.taskId, body.assigneeId, body.startDate, body.endDate)

  const inserted = db.prepare(`
    SELECT s.id, s.device_id, s.task_id, t.task_name, t.color_bg, t.color_fg,
           s.start_date, s.end_date, s.assignee_id, a.name as assignee_name
    FROM schedules s
    JOIN tasks t ON s.task_id = t.task_id
    JOIN assignees a ON s.assignee_id = a.assignee_id
    WHERE s.id = ?
  `).get(id) as Record<string, string>

  return NextResponse.json(toRow(inserted), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json() as { ids: string[] }
  const del = db.prepare("DELETE FROM schedules WHERE id = ?")
  const tx  = db.transaction((idList: string[]) => { for (const id of idList) del.run(id) })
  tx(ids)
  return NextResponse.json({ deleted: ids.length })
}
