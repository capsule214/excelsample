import { NextRequest, NextResponse } from "next/server"
import { initDb, Schedule, Task, Assignee } from "@/lib/sequelize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any) {
  return {
    id:           r.id,
    deviceId:     r.device_id,
    taskId:       r.task_id,
    taskName:     r.task?.task_name,
    colorBg:      r.task?.color_bg,
    colorFg:      r.task?.color_fg,
    startDate:    r.start_date,
    endDate:      r.end_date,
    assigneeId:   r.assignee_id,
    assigneeName: r.assignee?.name,
  }
}

const INCLUDE = [
  { model: Task,     as: "task",     attributes: ["task_name", "color_bg", "color_fg"] },
  { model: Assignee, as: "assignee", attributes: ["name"] },
]

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const body   = await req.json()

  await Schedule.update(
    { device_id: body.deviceId, task_id: body.taskId, assignee_id: body.assigneeId, start_date: body.startDate, end_date: body.endDate },
    { where: { id } }
  )

  const updated = await Schedule.findOne({ where: { id }, include: INCLUDE })
  return NextResponse.json(toRow(updated!.toJSON()))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  await Schedule.destroy({ where: { id } })
  return NextResponse.json({ deleted: id })
}
