import { NextResponse } from "next/server"
import { initDb, Location } from "@/lib/sequelize"

export async function GET() {
  try {
    await initDb()
    const rows = await Location.findAll({ order: [["sort_order", "ASC"]] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json((rows.map(r => r.toJSON()) as any[]).map(r => ({
      id:        r.location_id,
      name:      r.name,
      sortOrder: r.sort_order,
    })))
  } catch (err) {
    console.error("/api/locations error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
