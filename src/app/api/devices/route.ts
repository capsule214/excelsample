import { NextResponse } from "next/server"
import { initDb, Device, ModelMaster } from "@/lib/sequelize"

export async function GET() {
  await initDb()
  const rows = await Device.findAll({
    include: [{ model: ModelMaster, as: "model", attributes: ["model_name"] }],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = (rows.map(r => r.toJSON()) as any[]).sort(
    (a, b) => parseInt(a.device_id.slice(1)) - parseInt(b.device_id.slice(1))
  )

  return NextResponse.json(sorted.map(d => ({
    id:                   d.device_id,
    modelId:              d.model_id,
    modelName:            d.model?.model_name,
    serialNumber:         d.serial_number,
    requiredDeliveryDate: d.required_delivery_date,
  })))
}
