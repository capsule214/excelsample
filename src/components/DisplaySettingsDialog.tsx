"use client"

import { useState, useMemo } from "react"
import type { DeviceInfo, AssigneeInfo } from "./ScheduleDialog"

interface ModelInfo { id: string; name: string; deviceCount: number }

interface Props {
  devices:                 DeviceInfo[]
  assignees:               AssigneeInfo[]
  selectedModelIds:        string[]
  selectedAssigneeIds:     string[]
  showLocationRowInDevice: boolean
  onSave:  (modelIds: string[], assigneeIds: string[], showLocationRowInDevice: boolean) => void
  onClose: () => void
}

type Tab = "device" | "assignee"

export function DisplaySettingsDialog({
  devices, assignees,
  selectedModelIds, selectedAssigneeIds, showLocationRowInDevice,
  onSave, onClose,
}: Props) {
  const [tab,        setTab       ] = useState<Tab>("device")
  const [modelSel,   setModelSel  ] = useState<Set<string>>(() => new Set(selectedModelIds))
  const [asgnSel,    setAsgnSel   ] = useState<Set<string>>(() => new Set(selectedAssigneeIds))
  const [showLocRow, setShowLocRow] = useState(showLocationRowInDevice)
  const [modelQuery, setModelQuery] = useState("")
  const [asgnQuery,  setAsgnQuery ] = useState("")

  /* ── 機種リスト (devices から一意抽出) ── */
  const models = useMemo<ModelInfo[]>(() => {
    const map = new Map<string, ModelInfo>()
    for (const d of devices) {
      if (!map.has(d.modelId)) map.set(d.modelId, { id: d.modelId, name: d.modelName, deviceCount: 0 })
      map.get(d.modelId)!.deviceCount++
    }
    return [...map.values()]
  }, [devices])

  /* ── フィルタリング ── */
  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase()
    return q ? models.filter(m => m.name.toLowerCase().includes(q)) : models
  }, [models, modelQuery])

  const filteredAssignees = useMemo(() => {
    const q = asgnQuery.trim().toLowerCase()
    return q ? assignees.filter(a => a.name.toLowerCase().includes(q)) : assignees
  }, [assignees, asgnQuery])

  /* ── 全選択 / 全解除 ── */
  const toggleAllModels = (select: boolean) =>
    setModelSel(select
      ? new Set(filteredModels.map(m => m.id))
      : new Set([...modelSel].filter(id => !filteredModels.some(m => m.id === id)))
    )

  const toggleAllAssignees = (select: boolean) =>
    setAsgnSel(select
      ? new Set(filteredAssignees.map(a => a.id))
      : new Set([...asgnSel].filter(id => !filteredAssignees.some(a => a.id === id)))
    )

  const toggleModel = (id: string) =>
    setModelSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAsgn = (id: string) =>
    setAsgnSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleSave = () => onSave([...modelSel], [...asgnSel], showLocRow)

  /* ── スタイル ── */
  const tabCls = (t: Tab) => [
    "px-5 py-2 text-sm font-semibold border-b-2 transition-colors",
    tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700",
  ].join(" ")

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-[400px] max-h-[80vh]">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 shrink-0">
          <h2 className="text-base font-bold text-gray-800">表示設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 px-5 shrink-0">
          <button className={tabCls("device")} onClick={() => setTab("device")}>
            機種 <span className="ml-1 text-[10px] text-gray-400">({modelSel.size}/{models.length})</span>
          </button>
          <button className={tabCls("assignee")} onClick={() => setTab("assignee")}>
            担当者 <span className="ml-1 text-[10px] text-gray-400">({asgnSel.size}/{assignees.length})</span>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 py-3 gap-2">

          {/* ── 機種タブ ── */}
          {tab === "device" && (
            <>
              {/* 「場所予定も表示」トグル */}
              <label className="flex items-center gap-2 shrink-0 px-1 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocRow}
                  onChange={e => setShowLocRow(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">場所予定も表示</span>
                <span className="text-[10px] text-gray-400 ml-1">（各装置の最下行に場所予定行を追加）</span>
              </label>

              <div className="border-t border-gray-100 shrink-0" />

              {/* 検索・ボタン行 */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="機種名で絞り込み"
                  value={modelQuery}
                  onChange={e => setModelQuery(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => toggleAllModels(true)}
                  className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 font-medium whitespace-nowrap"
                >全選択</button>
                <button
                  onClick={() => toggleAllModels(false)}
                  className="px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 font-medium whitespace-nowrap"
                >全解除</button>
              </div>

              {/* 機種リスト */}
              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredModels.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">該当なし</div>
                ) : (
                  filteredModels.map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={modelSel.has(m.id)}
                        onChange={() => toggleModel(m.id)}
                        className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                      />
                      <span className="flex-1 text-sm font-semibold text-gray-700">{m.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{m.deviceCount} 台</span>
                    </label>
                  ))
                )}
              </div>

              <div className="text-[11px] text-gray-400 shrink-0">
                {filteredModels.filter(m => modelSel.has(m.id)).length} / {filteredModels.length} 機種表示
              </div>
            </>
          )}

          {/* ── 担当者タブ ── */}
          {tab === "assignee" && (
            <>
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
                  className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 font-medium whitespace-nowrap"
                >全選択</button>
                <button
                  onClick={() => toggleAllAssignees(false)}
                  className="px-2.5 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 font-medium whitespace-nowrap"
                >全解除</button>
              </div>

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
                {filteredAssignees.filter(a => asgnSel.has(a.id)).length} / {filteredAssignees.length} 件表示
              </div>
            </>
          )}
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
            className="px-5 py-1.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
