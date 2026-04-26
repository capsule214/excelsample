import { NextRequest, NextResponse } from "next/server"
import { Op } from "sequelize"
import { initDb, LocationSchedule, Location, Device } from "@/lib/sequelize"
import { randomUUID } from "crypto"

const INCLUDE = [
  { model: Location, as: "location", attributes: ["name"] },
  { model: Device,   as: "device",   attributes: ["serial_number", "model_id"] },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any) {
  return {
    id:           r.id,
    locationId:   r.location_id,
    locationName: r.location?.name ?? "",
    deviceId:     r.device_id,
    serialNumber: r.device?.serial_number ?? "",
    startDate:    r.start_date,
    endDate:      r.end_date,
  }
}

export async function GET(req: NextRequest) {
  await initDb()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to   = searchParams.get("to")
  const where = from && to ? { start_date: { [Op.lte]: to }, end_date: { [Op.gte]: from } } : {}
  const rows = await LocationSchedule.findAll({ include: INCLUDE, where, order: [["start_date", "ASC"]] })
  return NextResponse.json(rows.map(r => toRow(r.toJSON())))
}

export async function POST(req: NextRequest) {
  await initDb()
  const body = await req.json()
  const id   = randomUUID()
  await LocationSchedule.create({
    id,
    location_id: body.locationId,
    device_id:   body.deviceId,
    start_date:  body.startDate,
    end_date:    body.endDate,
  })
  const inserted = await LocationSchedule.findOne({ where: { id }, include: INCLUDE })
  return NextResponse.json(toRow(inserted!.toJSON()), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  await initDb()
  const { ids } = await req.json() as { ids: string[] }
  await LocationSchedule.destroy({ where: { id: ids } })
  return NextResponse.json({ deleted: ids.length })
}
