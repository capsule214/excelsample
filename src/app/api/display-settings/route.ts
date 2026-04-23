import { NextRequest, NextResponse } from "next/server"
import { initDb, Device, Assignee, DisplaySetting } from "@/lib/sequelize"

export async function GET() {
  await initDb()
  const [devRow, asgnRow] = await Promise.all([
    DisplaySetting.findOne({ where: { setting_key: "visible_devices" } }),
    DisplaySetting.findOne({ where: { setting_key: "visible_assignees" } }),
  ])

  const deviceIds: string[] = devRow
    ? JSON.parse((devRow.toJSON() as { value: string }).value)
    : (await Device.findAll()).map(d => (d.toJSON() as { device_id: string }).device_id)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))

  const assigneeIds: string[] = asgnRow
    ? JSON.parse((asgnRow.toJSON() as { value: string }).value)
    : (await Assignee.findAll({ order: [["assignee_id", "ASC"]] }))
        .map(a => (a.toJSON() as { assignee_id: string }).assignee_id)

  return NextResponse.json({ deviceIds, assigneeIds })
}

export async function PUT(req: NextRequest) {
  await initDb()
  const body = await req.json()

  await Promise.all([
    body.deviceIds  !== undefined && DisplaySetting.upsert({ setting_key: "visible_devices",   value: JSON.stringify(body.deviceIds) }),
    body.assigneeIds !== undefined && DisplaySetting.upsert({ setting_key: "visible_assignees", value: JSON.stringify(body.assigneeIds) }),
  ])

  return NextResponse.json({ ok: true })
}
