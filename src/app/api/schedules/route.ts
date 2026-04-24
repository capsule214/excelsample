import { NextRequest, NextResponse } from "next/server"
import { Op } from "sequelize"
import { initDb, Schedule, Task, Assignee, Location } from "@/lib/sequelize"
import { randomUUID } from "crypto"

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
    locationId:   r.location_id   ?? "",
    locationName: r.location?.name ?? "",
  }
}

const INCLUDE = [
  { model: Task,     as: "task",     attributes: ["task_name", "color_bg", "color_fg"] },
  { model: Assignee, as: "assignee", attributes: ["name"] },
  { model: Location, as: "location", attributes: ["name"], required: false },
]

export async function GET(req: NextRequest) {
  await initDb()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to   = searchParams.get("to")

  const where = from && to
    ? { start_date: { [Op.lte]: to }, end_date: { [Op.gte]: from } }
    : {}

  const rows = await Schedule.findAll({ include: INCLUDE, where, order: [["start_date", "ASC"]] })
  return NextResponse.json(rows.map(r => toRow(r.toJSON())))
}

export async function POST(req: NextRequest) {
  await initDb()
  const body = await req.json()
  const id   = randomUUID()
  await Schedule.create({
    id,
    device_id:   body.deviceId,
    task_id:     body.taskId,
    assignee_id: body.assigneeId,
    location_id: body.locationId || null,
    start_date:  body.startDate,
    end_date:    body.endDate,
  })
  const inserted = await Schedule.findOne({ where: { id }, include: INCLUDE })
  return NextResponse.json(toRow(inserted!.toJSON()), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  await initDb()
  const { ids } = await req.json() as { ids: string[] }
  await Schedule.destroy({ where: { id: ids } })
  return NextResponse.json({ deleted: ids.length })
}
