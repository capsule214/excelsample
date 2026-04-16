"use client"

import { useState, useMemo } from "react"
import type { DeviceInfo, AssigneeInfo } from "./ScheduleDialog"

interface Props {
  devices:            DeviceInfo[]
  assignees:          AssigneeInfo[]
  selectedDeviceIds:  string[]
  selectedAssigneeIds: string[]
  onSave:  (deviceIds: string[], assigneeIds: string[]) => void
  onClose: () => void
}

type Tab = "device" | "assignee"

export function DisplaySettingsDialog({
  devices, assignees, selectedDeviceIds, selectedAssigneeIds, onSave, onClose,
}: Props) {
  const [tab,      setTab     ] = useState<Tab>("device")
  const [devSel,   setDevSel  ] = useState<Set<string>>(() => new Set(selectedDeviceIds))
  const [asgnSel,  setAsgnSel ] = useState<Set<string>>(() => new Set(selectedAssigneeIds))
  const [devQuery, setDevQuery] = useState("")
  const [asgnQuery,setAsgnQuery] = useState("")

  /* ── フィルタリング ── */
  const filteredDevices = useMemo(() => {
    const q = devQuery.trim().toLowerCase()
    if (!q) return devices
    return devices.filter(d =>
      d.modelName.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      (d.requiredDeliveryDate ?? "").includes(q)
    )
  }, [devices, devQuery])

  const filteredAssignees = useMemo(() => {
    const q = asgnQuery.trim().toLowerCase()
    if (!q) return assignees
    return assignees.filter(a => a.name.toLowerCase().includes(q))
  }, [assignees, asgnQuery])

  /* ── 全選択 / 全解除 ── */
  const toggleAllDevices = (select: boolean) =>
    setDevSel(select ? new Set(filteredDevices.map(d => d.id)) : new Set(
      [...devSel].filter(id => !filteredDevices.some(d => d.id === id))
    ))

  const toggleAllAssignees = (select: boolean) =>
    setAsgnSel(select ? new Set(filteredAssignees.map(a => a.id)) : new Set(
      [...asgnSel].filter(id => !filteredAssignees.some(a => a.id === id))
    ))

  const toggleDev  = (id: string) => setDevSel (prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAsgn = (id: string) => setAsgnSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleSave = () => onSave([...devSel], [...asgnSel])

  /* ── スタイル定数 ── */
  const tabCls = (t: Tab) => [
    "px-5 py-2 text-sm font-semibold border-b-2 transition-colors",
    tab === t
      ? "border-blue-500 text-blue-600"
      : "border-transparent text-gray-500 hover:text-gray-700",
  ].join(" ")

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-[480px] max-h-[80vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 shrink-0">
          <h2 className="text-base font-bold text-gray-800">表示設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 px-5 shrink-0">
          <button className={tabCls("device")}   onClick={() => setTab("device")}>
            装置 <span className="ml-1 text-[10px] text-gray-400">({devSel.size}/{devices.length})</span>
          </button>
          <button className={tabCls("assignee")} onClick={() => setTab("assignee")}>
            担当者 <span className="ml-1 text-[10px] text-gray-400">({asgnSel.size}/{assignees.length})</span>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 gap-2">

          {/* ── 装置タブ ── */}
          {tab === "device" && (
            <>
              {/* 検索・ボタン行 */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="機種名・製番で絞り込み"
                  value={devQuery}
                  onChange={e => setDevQuery(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => toggleAllDevices(true)}
                  className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 font-medium transition-colors whitespace-nowrap"
                >全選択</button>
                <button
                  onClick={() => toggleAllDevices(false)}
                  className="px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 font-medium transition-colors whitespace-nowrap"
                >全解除</button>
              </div>

              {/* リスト */}
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredDevices.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">該当なし</div>
                ) : (
                  filteredDevices.map(d => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={devSel.has(d.id)}
                        onChange={() => toggleDev(d.id)}
                        className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700 truncate">{d.modelName}</div>
                        <div className="text-[10px] text-gray-400">{d.serialNumber}</div>
                      </div>
                      {d.requiredDeliveryDate && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(d.requiredDeliveryDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>

              <div className="text-[11px] text-gray-400 shrink-0">
                {filteredDevices.filter(d => devSel.has(d.id)).length} / {filteredDevices.length} 件表示（全 {devices.length} 件）
              </div>
            </>
          )}

          {/* ── 担当者タブ ── */}
          {tab === "assignee" && (
            <>
              {/* 検索・ボタン行 */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="担当者名で絞り込み"
                  value={asgnQuery}
                  onChange={e => setAsgnQuery(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => toggleAllAssignees(true)}
                  className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 font-medium transition-colors whitespace-nowrap"
                >全選択</button>
                <button
                  onClick={() => toggleAllAssignees(false)}
                  className="px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 font-medium transition-colors whitespace-nowrap"
                >全解除</button>
              </div>

              {/* リスト */}
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredAssignees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">該当なし</div>
                ) : (
                  filteredAssignees.map(a => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={asgnSel.has(a.id)}
                        onChange={() => toggleAsgn(a.id)}
                        className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-700">{a.name}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="text-[11px] text-gray-400 shrink-0">
                {filteredAssignees.filter(a => asgnSel.has(a.id)).length} / {filteredAssignees.length} 件表示（全 {assignees.length} 件）
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
