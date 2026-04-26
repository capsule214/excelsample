"use client"

import { useState } from "react"
import type { DeviceInfo, LocationInfo } from "./ScheduleDialog"

export interface LocationScheduleFormData {
  locationId: string
  deviceId:   string
  startDate:  Date
  endDate:    Date
}

interface Props {
  mode:      "new" | "edit"
  initial:   LocationScheduleFormData
  locations: LocationInfo[]
  devices:   DeviceInfo[]
  minDate?:  Date
  maxDate?:  Date
  onSave:    (data: LocationScheduleFormData) => void
  onClose:   () => void
}

function toInputStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
function fromInputStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number); return new Date(y, m-1, d)
}

export function LocationScheduleDialog({
  mode, initial, locations, devices, minDate, maxDate, onSave, onClose,
}: Props) {
  const [locationId, setLocationId] = useState(initial.locationId)
  const [deviceId,   setDeviceId  ] = useState(initial.deviceId)
  const [startStr,   setStartStr  ] = useState(toInputStr(initial.startDate))
  const [endStr,     setEndStr    ] = useState(toInputStr(initial.endDate))

  const handleSave = () => {
    const startDate = fromInputStr(startStr)
    const endDate   = fromInputStr(endStr)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return
    if (startDate > endDate) return
    onSave({ locationId, deviceId, startDate, endDate })
  }

  const minStr = minDate ? toInputStr(minDate) : undefined
  const maxStr = maxDate ? toInputStr(maxDate) : undefined

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-[400px]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <h2 className="text-base font-bold text-gray-800">
              場所使用予定 — {mode === "new" ? "新規追加" : "編集"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* フォーム */}
        <div className="px-5 py-4 flex flex-col gap-4">

          {/* 場所 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">場所</label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* 装置 (製番) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">装置 (製番)</label>
            <select
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.serialNumber}　{d.modelName}</option>
              ))}
            </select>
          </div>

          {/* 期間 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600">開始日</label>
              <input
                type="date"
                value={startStr}
                min={minStr}
                max={maxStr}
                onChange={e => setStartStr(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600">終了日</label>
              <input
                type="date"
                value={endStr}
                min={startStr || minStr}
                max={maxStr}
                onChange={e => setEndStr(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg"
          >
            保存
          </button>
        </div>

      </div>
    </div>
  )
}
