import { NextResponse } from "next/server"
import { initDb, Assignee } from "@/lib/sequelize"

export async function GET() {
  await initDb()
  const rows = await Assignee.findAll({ order: [["assignee_id", "ASC"]] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((rows.map(r => r.toJSON()) as any[]).map(r => ({ id: r.assignee_id, name: r.name })))
}
