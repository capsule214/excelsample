import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"
import { randomUUID } from "crypto"

function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

export async function POST(req: NextRequest) {
  const { count = 1000, baseDate, months = 4, seedNum = 42 } = await req.json()

  const base = baseDate ? new Date(baseDate) : new Date()
  base.setHours(0, 0, 0, 0)
  const endDate = new Date(base)
  endDate.setMonth(endDate.getMonth() + months)
  const cols = Math.round((endDate.getTime() - base.getTime()) / 86400000)

  const devices   = db.prepare("SELECT device_id FROM devices ORDER BY CAST(SUBSTR(device_id,2) AS INTEGER)").all() as { device_id: string }[]
  const tasks     = db.prepare("SELECT task_id FROM tasks ORDER BY sort_order").all() as { task_id: string }[]
  const assignees = db.prepare("SELECT assignee_id FROM assignees ORDER BY assignee_id").all() as { assignee_id: string }[]

  const rand = makeLCG(seedNum)
  const rows: [string,string,string,string,string,string][] = []
  let id = 0

  for (const dev of devices) {
    let dayOffset = Math.floor(rand() * 10)
    for (let j = 0; j < 10; j++) {
      const task = tasks[j % tasks.length]
      const len  = 3 + Math.floor(rand() * 12)
      const sc   = Math.min(dayOffset, cols - 2)
      const ec   = Math.min(sc + len, cols - 1)
      const asgn = assignees[(++id) % assignees.length]
      const sd   = new Date(base); sd.setDate(base.getDate() + sc)
      const ed   = new Date(base); ed.setDate(base.getDate() + ec)
      rows.push([
        randomUUID(), dev.device_id, task.task_id, asgn.assignee_id,
        sd.toISOString().slice(0, 10), ed.toISOString().slice(0, 10),
      ])
      dayOffset = ec + 1 + Math.floor(rand() * 5)
      if (dayOffset >= cols) break
    }
  }

  const insert = db.prepare(
    "INSERT INTO schedules (id, device_id, task_id, assignee_id, start_date, end_date) VALUES (?,?,?,?,?,?)"
  )
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM schedules").run()
    for (const row of rows.slice(0, count)) insert.run(...row)
  })
  tx()

  return NextResponse.json({ seeded: Math.min(rows.length, count) })
}
