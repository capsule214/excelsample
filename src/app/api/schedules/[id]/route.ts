import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body   = await req.json()

  db.prepare(
    "UPDATE schedules SET device_id=?, task_id=?, assignee_id=?, start_date=?, end_date=? WHERE id=?"
  ).run(body.deviceId, body.taskId, body.assigneeId, body.startDate, body.endDate, id)

  const updated = db.prepare(`
    SELECT s.id, s.device_id, s.task_id, t.task_name, t.color_bg, t.color_fg,
           s.start_date, s.end_date, s.assignee_id, a.name as assignee_name
    FROM schedules s
    JOIN tasks t ON s.task_id = t.task_id
    JOIN assignees a ON s.assignee_id = a.assignee_id
    WHERE s.id = ?
  `).get(id) as Record<string, string>

  return NextResponse.json({
    id:           updated.id,
    deviceId:     updated.device_id,
    taskId:       updated.task_id,
    taskName:     updated.task_name,
    colorBg:      updated.color_bg,
    colorFg:      updated.color_fg,
    startDate:    updated.start_date,
    endDate:      updated.end_date,
    assigneeId:   updated.assignee_id,
    assigneeName: updated.assignee_name,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  db.prepare("DELETE FROM schedules WHERE id = ?").run(id)
  return NextResponse.json({ deleted: id })
}
