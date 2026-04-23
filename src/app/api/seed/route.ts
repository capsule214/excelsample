import { NextRequest, NextResponse } from "next/server"
import { initDb, Device, Task, Assignee, Schedule } from "@/lib/sequelize"
import { randomUUID } from "crypto"

function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

export async function POST(req: NextRequest) {
  await initDb()
  const { count = 1000, baseDate, months = 4, seedNum = 42 } = await req.json()

  const base = baseDate ? new Date(baseDate) : new Date()
  base.setHours(0, 0, 0, 0)
  const endDate = new Date(base)
  endDate.setMonth(endDate.getMonth() + months)
  const cols = Math.round((endDate.getTime() - base.getTime()) / 86400000)

  const [devices, tasks, assignees] = await Promise.all([
    Device.findAll(),
    Task.findAll({ order: [["sort_order", "ASC"]] }),
    Assignee.findAll({ order: [["assignee_id", "ASC"]] }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devList  = devices.map(d => (d.toJSON() as any).device_id as string)
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskList = tasks.map(t => (t.toJSON() as any).task_id as string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asgnList = assignees.map(a => (a.toJSON() as any).assignee_id as string)

  const rand = makeLCG(seedNum)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []
  let id = 0

  for (const devId of devList) {
    let dayOffset = Math.floor(rand() * 10)
    for (let j = 0; j < 10; j++) {
      const task = taskList[j % taskList.length]
      const len  = 3 + Math.floor(rand() * 12)
      const sc   = Math.min(dayOffset, cols - 2)
      const ec   = Math.min(sc + len, cols - 1)
      const asgn = asgnList[(++id) % asgnList.length]
      const sd   = new Date(base); sd.setDate(base.getDate() + sc)
      const ed   = new Date(base); ed.setDate(base.getDate() + ec)
      rows.push({ id: randomUUID(), device_id: devId, task_id: task, assignee_id: asgn, start_date: sd.toISOString().slice(0, 10), end_date: ed.toISOString().slice(0, 10) })
      dayOffset = ec + 1 + Math.floor(rand() * 5)
      if (dayOffset >= cols) break
    }
  }

  await Schedule.destroy({ truncate: true })
  await Schedule.bulkCreate(rows.slice(0, count))

  return NextResponse.json({ seeded: Math.min(rows.length, count) })
}
