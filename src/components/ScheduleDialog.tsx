"use client"

import { useState } from "react"
import { DatePicker } from "./DatePicker"

export interface TaskInfo     { id: string; name: string; colorBg: string; colorFg: string }
export interface AssigneeInfo { id: string; name: string }
export interface DeviceInfo   {
  id: string; modelId: string; modelName: string
  serialNumber: string; requiredDeliveryDate: string | null
}

export interface DialogFormData {
  deviceId:   string
  taskId:     string
  taskName:   string
  startDate:  Date
  endDate:    Date
  assigneeId: string
  assigneeName: string
}

interface Props {
  mode: "new" | "edit"
  initial:   DialogFormData
  devices:   DeviceInfo[]
  tasks:     TaskInfo[]
  assignees: AssigneeInfo[]
  minDate:   Date
  maxDate:   Date
  onSave:  (data: DialogFormData) => void
  onClose: () => void
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

export function ScheduleDialog({ mode, initial, devices, tasks, assignees, minDate, maxDate, onSave, onClose }: Props) {
  const [deviceId,     setDeviceId    ] = useState(initial.deviceId)
  const [taskId,       setTaskId      ] = useState(initial.taskId)
  const [startDate,    setStartDate   ] = useState<Date>(initial.startDate)
  const [endDate,      setEndDate     ] = useState<Date>(initial.endDate)
  const [assigneeId,   setAssigneeId  ] = useState(initial.assigneeId)
  const [error,        setError       ] = useState("")
  const [activeField,  setActiveField ] = useState<"start" | "end">("start")

  const handleSave = () => {
    if (startDate > endDate) { setError("終了日は開始日以降にしてください"); return }
    const task    = tasks.find(t => t.id === taskId)
    const asgn    = assignees.find(a => a.id === assigneeId)
    onSave({
      deviceId,
      taskId,
      taskName:    task?.name    ?? "",
      startDate,
      endDate,
      assigneeId,
      assigneeName: asgn?.name  ?? "",
    })
  }

  const handleDateChange = (d: Date) => {
    setError("")
    if (activeField === "start") {
      setStartDate(d)
      if (d > endDate) setEndDate(d)
      setActiveField("end")
    } else {
      setEndDate(d)
      if (d < startDate) setStartDate(d)
    }
  }

  const label = "block text-xs font-semibold text-gray-500 mb-1"
  const sel   = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[900]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-[340px] flex flex-col gap-4 p-6">
        <h2 className="text-base font-bold text-gray-800">
          {mode === "new" ? "予定を追加" : "予定を編集"}
        </h2>

        {/* 装置 */}
        <div>
          <label className={label}>装置</label>
          <select className={sel} value={deviceId} onChange={e => setDeviceId(e.target.value)}>
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.modelName} / {d.serialNumber}</option>
            ))}
          </select>
        </div>

        {/* タスク */}
        <div>
          <label className={label}>工程</label>
          <select className={sel} value={taskId} onChange={e => setTaskId(e.target.value)}>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* 日付選択 */}
        <div>
          <div className="flex gap-2 mb-3">
            {(["start", "end"] as const).map(field => {
              const isActive = activeField === field
              const date     = field === "start" ? startDate : endDate
              return (
                <button key={field} type="button" onClick={() => setActiveField(field)}
                  className={[
                    "flex-1 rounded-xl border px-3 py-2 text-left transition-colors",
                    isActive ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                             : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                  ].join(" ")}
                >
                  <div className={`text-[10px] font-semibold mb-0.5 ${isActive ? "text-blue-500" : "text-gray-400"}`}>
                    {field === "start" ? "開始日" : "終了日"}
                  </div>
                  <div className={`text-sm font-bold ${isActive ? "text-blue-700" : "text-gray-600"}`}>
                    {fmtDate(date)}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <DatePicker
              value={activeField === "start" ? startDate : endDate}
              onChange={handleDateChange}
              minDate={minDate} maxDate={maxDate}
              rangeStart={startDate} rangeEnd={endDate}
            />
          </div>
        </div>

        {/* 担当者 */}
        <div>
          <label className={label}>担当者</label>
          <select className={sel} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>
            キャンセル
          </button>
          <button className="px-5 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
