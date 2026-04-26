import { NextRequest, NextResponse } from "next/server"
import { initDb, LocationSchedule, Location, Device } from "@/lib/sequelize"

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  const body   = await req.json()
  await LocationSchedule.update(
    {
      location_id: body.locationId,
      device_id:   body.deviceId,
      start_date:  body.startDate,
      end_date:    body.endDate,
    },
    { where: { id } }
  )
  const updated = await LocationSchedule.findOne({ where: { id }, include: INCLUDE })
  return NextResponse.json(toRow(updated!.toJSON()))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb()
  const { id } = await params
  await LocationSchedule.destroy({ where: { id } })
  return NextResponse.json({ deleted: id })
}
