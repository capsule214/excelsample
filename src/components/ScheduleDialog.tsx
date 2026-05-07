"use client"

import { useState } from "react"
import { DatePicker } from "./DatePicker"

export interface TaskInfo     { id: string; name: string; colorBg: string; colorFg: string }
export interface AssigneeInfo { id: string; name: string }
export interface LocationInfo { id: string; name: string }
export interface DeviceInfo   {
  id: string; modelId: string; modelName: string
  serialNumber: string; requiredDeliveryDate: string | null
}

export interface DialogFormData {
  deviceId:     string
  taskId:       string
  taskName:     string
  startDate:    Date
  endDate:      Date
  assigneeId:   string
  assigneeName: string
  locationId:   string
  locationName: string
}

interface Props {
  mode:      "new" | "edit"
  gridMode?: "device" | "assignee" | "location"
  initial:   DialogFormData
  devices:   DeviceInfo[]
  tasks:     TaskInfo[]
  assignees: AssigneeInfo[]
  locations: LocationInfo[]
  minDate:   Date
  maxDate:   Date
  onSave:  (data: DialogFormData) => void
  onClose: () => void
}

// 開始時刻・終了時刻のペア定義
const TIME_SLOTS = [
  { label: "午前1", startH: 8,  startM: 0,  endH: 10, endM: 0  },
  { label: "午前2", startH: 10, startM: 0,  endH: 12, endM: 0  },
  { label: "午後1", startH: 13, startM: 0,  endH: 15, endM: 0  },
  { label: "午後2", startH: 15, startM: 0,  endH: 17, endM: 0  },
  { label: "残業1", startH: 17, startM: 0,  endH: 19, endM: 0  },
  { label: "残業2", startH: 19, startM: 0,  endH: 21, endM: 0  },
] as const

function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function fmtDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

export function ScheduleDialog({
  mode, gridMode, initial, devices, tasks, assignees, locations, minDate, maxDate, onSave, onClose,
}: Props) {
  const [deviceId,   setDeviceId  ] = useState(initial.deviceId)
  const [taskId,     setTaskId    ] = useState(initial.taskId)
  const [startDate,  setStartDate ] = useState<Date>(initial.startDate)
  const [endDate,    setEndDate   ] = useState<Date>(initial.endDate)
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId)
  const [locationId, setLocationId] = useState(initial.locationId)
  const [error,      setError     ] = useState("")

  const isDeviceMode = gridMode === "device"
  const fixedDevice  = devices.find(d => d.id === deviceId)

  const handleSave = () => {
    if (startDate > endDate) { setError("終了日は開始日以降にしてください"); return }
    const task = tasks.find(t => t.id === taskId)
    const asgn = assignees.find(a => a.id === assigneeId)
    const loc  = isDeviceMode ? undefined : locations.find(l => l.id === locationId)
    onSave({
      deviceId, taskId,
      taskName:     task?.name ?? "",
      startDate, endDate,
      assigneeId,
      assigneeName: asgn?.name ?? "",
      locationId:   isDeviceMode ? "" : locationId,
      locationName: loc?.name ?? "",
    })
  }

  // 開始日カレンダーで日付を選択
  const handleStartDateChange = (d: Date) => {
    setError("")
    const next = new Date(d)
    next.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)
    setStartDate(next)
    if (next > endDate) {
      const adj = new Date(next)
      adj.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0)
      setEndDate(adj)
    }
  }

  // 終了日カレンダーで日付を選択
  const handleEndDateChange = (d: Date) => {
    setError("")
    const next = new Date(d)
    next.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0)
    setEndDate(next)
    if (next < startDate) {
      const adj = new Date(next)
      adj.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)
      setStartDate(adj)
    }
  }

  // 開始時刻ボタン
  const handleStartSlot = (h: number, m: number) => {
    const next = new Date(startDate); next.setHours(h, m, 0, 0); setStartDate(next); setError("")
  }
  // 終了時刻ボタン
  const handleEndSlot = (h: number, m: number) => {
    const next = new Date(endDate);   next.setHours(h, m, 0, 0); setEndDate(next);   setError("")
  }

  const label = "block text-xs font-semibold text-gray-500 mb-1"
  const sel   = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[900]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto"
        style={{ width: 600 }}>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">
            {mode === "new" ? "予定を追加" : "予定を編集"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* ── カレンダー 2 列 ── */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 shrink-0">

          {/* 開始日 */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-blue-600 tracking-wide">開始日</span>
              <span className="text-sm font-semibold text-blue-700 ml-auto">
                {fmtDate(startDate)}
              </span>
            </div>

            <DatePicker
              value={startDate}
              onChange={handleStartDateChange}
              minDate={minDate} maxDate={maxDate}
              rangeStart={startDate} rangeEnd={endDate}
            />

            {/* 開始時刻 */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400">開始時刻</span>
                <span className="text-xs font-bold text-blue-700">{fmtTime(startDate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TIME_SLOTS.map(slot => {
                  const active = startDate.getHours() === slot.startH && startDate.getMinutes() === slot.startM
                  return (
                    <button key={slot.label} type="button"
                      onClick={() => handleStartSlot(slot.startH, slot.startM)}
                      className={[
                        "py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        active
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300",
                      ].join(" ")}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 終了日 */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-orange-500 tracking-wide">終了日</span>
              <span className="text-sm font-semibold text-orange-600 ml-auto">
                {fmtDate(endDate)}
              </span>
            </div>

            <DatePicker
              value={endDate}
              onChange={handleEndDateChange}
              minDate={minDate} maxDate={maxDate}
              rangeStart={startDate} rangeEnd={endDate}
            />

            {/* 終了時刻 */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-gray-400">終了時刻</span>
                <span className="text-xs font-bold text-orange-600">{fmtTime(endDate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TIME_SLOTS.map(slot => {
                  const active = endDate.getHours() === slot.endH && endDate.getMinutes() === slot.endM
                  return (
                    <button key={slot.label} type="button"
                      onClick={() => handleEndSlot(slot.endH, slot.endM)}
                      className={[
                        "py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        active
                          ? "bg-orange-400 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-300",
                      ].join(" ")}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── フォーム欄 ── */}
        <div className="px-6 py-4 flex flex-col gap-3 border-t border-gray-100 shrink-0">

          {/* 装置: device mode では固定表示、他モードはドロップダウン */}
          <div>
            <label className={label}>装置</label>
            {isDeviceMode ? (
              <div className="px-2.5 py-1.5 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md">
                {fixedDevice ? `${fixedDevice.modelName} / ${fixedDevice.serialNumber}` : "─"}
              </div>
            ) : (
              <select className={sel} value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.modelName} / {d.serialNumber}</option>
                ))}
              </select>
            )}
          </div>

          {/* 工程 */}
          <div>
            <label className={label}>工程</label>
            <select className={sel} value={taskId} onChange={e => setTaskId(e.target.value)}>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* 担当者 */}
          <div>
            <label className={label}>担当者</label>
            <select className={sel} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* 場所: device mode では非表示 */}
          {!isDeviceMode && (
            <div>
              <label className={label}>場所</label>
              <select className={sel} value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">─ 選択なし ─</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
