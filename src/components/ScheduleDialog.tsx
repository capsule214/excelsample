"use client"

import { useState } from "react"

export type ProcessName = "工程A" | "工程B" | "検査" | "出荷"
const PROCESS_NAMES: ProcessName[] = ["工程A", "工程B", "検査", "出荷"]

interface Device { id: string; name: string }

export interface DialogFormData {
  deviceId: string
  process: ProcessName
  startDate: Date
  endDate: Date
  assignee: string
}

interface Props {
  mode: "new" | "edit"
  initial: DialogFormData
  devices: Device[]
  assignees: string[]
  minDate: Date
  maxDate: Date
  onSave: (data: DialogFormData) => void
  onClose: () => void
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function fromStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function ScheduleDialog({ mode, initial, devices, assignees, minDate, maxDate, onSave, onClose }: Props) {
  const [deviceId, setDeviceId] = useState(initial.deviceId)
  const [process,  setProcess ] = useState<ProcessName>(initial.process)
  const [startStr, setStartStr] = useState(toStr(initial.startDate))
  const [endStr,   setEndStr  ] = useState(toStr(initial.endDate))
  const [assignee, setAssignee] = useState(initial.assignee)
  const [error,    setError   ] = useState("")

  const handleSave = () => {
    const start = fromStr(startStr)
    const end   = fromStr(endStr)
    if (start > end) { setError("終了日は開始日以降にしてください"); return }
    onSave({ deviceId, process, startDate: start, endDate: end, assignee })
  }

  const minStr = toStr(minDate)
  const maxStr = toStr(maxDate)

  const label = "block text-xs font-semibold text-gray-500 mb-1"
  const input = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[900]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[340px] flex flex-col gap-4 p-6">

        {/* タイトル */}
        <h2 className="text-base font-bold text-gray-800">
          {mode === "new" ? "予定を追加" : "予定を編集"}
        </h2>

        {/* 装置 */}
        <div>
          <label className={label}>装置</label>
          <select className={input} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* 予定種別 */}
        <div>
          <label className={label}>予定種別</label>
          <select className={input} value={process} onChange={(e) => setProcess(e.target.value as ProcessName)}>
            {PROCESS_NAMES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* 開始日・終了日 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={label}>開始日</label>
            <input
              type="date" className={input}
              value={startStr} min={minStr} max={maxStr}
              onChange={(e) => { setStartStr(e.target.value); setError("") }}
            />
          </div>
          <div className="flex-1">
            <label className={label}>終了日</label>
            <input
              type="date" className={input}
              value={endStr} min={minStr} max={maxStr}
              onChange={(e) => { setEndStr(e.target.value); setError("") }}
            />
          </div>
        </div>

        {/* 作業担当者 */}
        <div>
          <label className={label}>作業担当者</label>
          <select className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* バリデーションエラー */}
        {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

        {/* ボタン */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="px-5 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
