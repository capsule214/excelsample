"use client"

import { useState } from "react"
import { DatePicker } from "./DatePicker"

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

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

export function ScheduleDialog({ mode, initial, devices, assignees, minDate, maxDate, onSave, onClose }: Props) {
  const [deviceId,  setDeviceId ] = useState(initial.deviceId)
  const [process,   setProcess  ] = useState<ProcessName>(initial.process)
  const [startDate, setStartDate] = useState<Date>(initial.startDate)
  const [endDate,   setEndDate  ] = useState<Date>(initial.endDate)
  const [assignee,  setAssignee ] = useState(initial.assignee)
  const [error,     setError    ] = useState("")
  /* 開始日/終了日 どちらを編集中か */
  const [activeField, setActiveField] = useState<"start" | "end">("start")

  const handleSave = () => {
    if (startDate > endDate) { setError("終了日は開始日以降にしてください"); return }
    onSave({ deviceId, process, startDate, endDate, assignee })
  }

  const handleDateChange = (d: Date) => {
    setError("")
    if (activeField === "start") {
      setStartDate(d)
      /* 開始日 > 終了日 になるなら終了日を揃える */
      if (d > endDate) setEndDate(d)
      /* 自動的に終了日フィールドへ進む */
      setActiveField("end")
    } else {
      setEndDate(d)
      if (d < startDate) setStartDate(d)
    }
  }

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

        {/* 日付選択: タブ + インラインカレンダー */}
        <div>
          {/* 開始日 / 終了日 タブ */}
          <div className="flex gap-2 mb-3">
            {(["start", "end"] as const).map((field) => {
              const isActive = activeField === field
              const date     = field === "start" ? startDate : endDate
              const fieldLabel = field === "start" ? "開始日" : "終了日"
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => setActiveField(field)}
                  className={[
                    "flex-1 rounded-xl border px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                  ].join(" ")}
                >
                  <div className={`text-[10px] font-semibold mb-0.5 ${isActive ? "text-blue-500" : "text-gray-400"}`}>
                    {fieldLabel}
                  </div>
                  <div className={`text-sm font-bold ${isActive ? "text-blue-700" : "text-gray-600"}`}>
                    {fmtDate(date)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* インラインカレンダー */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <DatePicker
              value={activeField === "start" ? startDate : endDate}
              onChange={handleDateChange}
              minDate={minDate}
              maxDate={maxDate}
              rangeStart={startDate}
              rangeEnd={endDate}
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
