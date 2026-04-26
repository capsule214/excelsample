import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET() {
  const modelRow  = db.prepare("SELECT value FROM display_settings WHERE setting_key = 'visible_models'").get()   as { value: string } | undefined
  const asgnRow   = db.prepare("SELECT value FROM display_settings WHERE setting_key = 'visible_assignees'").get() as { value: string } | undefined
  const locRowRow = db.prepare("SELECT value FROM display_settings WHERE setting_key = 'show_location_row'").get() as { value: string } | undefined

  // 設定未保存の場合は全件を返す
  const modelIds: string[] = modelRow
    ? JSON.parse(modelRow.value)
    : (db.prepare("SELECT DISTINCT model_id FROM devices ORDER BY CAST(SUBSTR(model_id,2) AS INTEGER)").all() as { model_id: string }[]).map(d => d.model_id)

  const assigneeIds: string[] = asgnRow
    ? JSON.parse(asgnRow.value)
    : (db.prepare("SELECT assignee_id FROM assignees ORDER BY assignee_id").all() as { assignee_id: string }[]).map(a => a.assignee_id)

  const showLocationRowInDevice: boolean = locRowRow ? JSON.parse(locRowRow.value) : false

  return NextResponse.json({ modelIds, assigneeIds, showLocationRowInDevice })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()

  const upsert = db.prepare(
    "INSERT INTO display_settings (setting_key, value) VALUES (?,?) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value"
  )

  db.transaction(() => {
    if (body.modelIds              !== undefined) upsert.run("visible_models",       JSON.stringify(body.modelIds))
    if (body.assigneeIds           !== undefined) upsert.run("visible_assignees",    JSON.stringify(body.assigneeIds))
    if (body.showLocationRowInDevice !== undefined) upsert.run("show_location_row",  JSON.stringify(body.showLocationRowInDevice))
  })()

  return NextResponse.json({ ok: true })
}
