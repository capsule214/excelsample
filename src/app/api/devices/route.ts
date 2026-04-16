import { NextResponse } from "next/server"
import db from "@/lib/db"

export function GET() {
  const rows = db.prepare(`
    SELECT d.device_id, d.model_id, m.model_name, d.serial_number, d.required_delivery_date
    FROM devices d
    JOIN models m ON d.model_id = m.model_id
    ORDER BY CAST(SUBSTR(d.device_id, 2) AS INTEGER)
  `).all() as {
    device_id: string; model_id: string; model_name: string
    serial_number: string; required_delivery_date: string | null
  }[]

  return NextResponse.json(rows.map(r => ({
    id:                   r.device_id,
    modelId:              r.model_id,
    modelName:            r.model_name,
    serialNumber:         r.serial_number,
    requiredDeliveryDate: r.required_delivery_date,
  })))
}
