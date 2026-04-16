import { NextResponse } from "next/server"
import db from "@/lib/db"

export function GET() {
  const rows = db.prepare("SELECT assignee_id, name FROM assignees ORDER BY assignee_id").all() as {
    assignee_id: string; name: string
  }[]
  return NextResponse.json(rows.map(r => ({ id: r.assignee_id, name: r.name })))
}
