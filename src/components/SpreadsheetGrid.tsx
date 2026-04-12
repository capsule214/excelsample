"use client"

import React, { useState, useMemo } from "react"
import { ContextMenu } from "./ContextMenu"
import { ScheduleDialog, type ProcessName, type DialogFormData } from "./ScheduleDialog"
import { BarTooltip, type TooltipBarInfo } from "./BarTooltip"

/* ─── グリッド定数 ──────────────────────────────── */
const COLS       = 100
const CELL_SIZE  = 20
const ROW_HDR_W  = 64
const HDR_H      = 20
const DATA_TOP   = HDR_H * 3
const MIN_ROWS   = 3

/* ─── 日付生成 ──────────────────────────────────── */
function generateDates(): Date[] {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  return Array.from({ length: COLS }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
}
const DATES = generateDates()

function isWeekend(d: Date) { const n = d.getDay(); return n === 0 || n === 6 }

function colToDate(col: number): Date { return DATES[Math.max(0, Math.min(COLS - 1, col))] }

function dateToCol(date: Date): number {
  return Math.round((date.getTime() - DATES[0].getTime()) / 86400000)
}

/* ─── 固定データ ─────────────────────────────────── */
const DEVICES = [
  { id: "d1", name: "装置1" },
  { id: "d2", name: "装置2" },
  { id: "d3", name: "装置3" },
  { id: "d4", name: "装置4" },
  { id: "d5", name: "装置5" },
]

const ASSIGNEES = ["山田太郎", "鈴木花子", "田中一郎", "佐藤美咲", "高橋健太"]

const PROCESS_COLOR: Record<ProcessName, { bg: string; fg: string }> = {
  "工程A": { bg: "#3b82f6", fg: "#fff" },
  "工程B": { bg: "#10b981", fg: "#fff" },
  "検査":  { bg: "#f59e0b", fg: "#fff" },
  "出荷":  { bg: "#8b5cf6", fg: "#fff" },
}

const DEVICE_BG = ["#f8fafc","#f0f9ff","#fefce8","#fdf4ff","#f0fdf4",
                   "#fff7ed","#ecfdf5","#fef2f2","#f5f3ff","#f0fdfa"]

/* ─── データ型 ───────────────────────────────────── */
interface BarDef {
  id: string
  deviceId: string
  process: ProcessName
  startCol: number
  endCol: number
  assignee: string
}

interface PlacedBar extends BarDef { absoluteRow: number }

interface RowMeta {
  deviceId: string
  deviceIdx: number
  deviceName: string
  isFirst: boolean
  isLast: boolean
}

/* ─── 初期サンプルデータ ─────────────────────────── */
const INITIAL_BARS: BarDef[] = [
  { id: "1a", deviceId:"d1", process:"工程A", startCol:0,  endCol:8,  assignee:"山田太郎" },
  { id: "1b", deviceId:"d1", process:"工程B", startCol:10, endCol:22, assignee:"鈴木花子" },
  { id: "1c", deviceId:"d1", process:"検査",  startCol:14, endCol:19, assignee:"田中一郎" }, // 1b と重複
  { id: "1d", deviceId:"d1", process:"検査",  startCol:24, endCol:28, assignee:"田中一郎" },
  { id: "1e", deviceId:"d1", process:"出荷",  startCol:30, endCol:31, assignee:"山田太郎" },
  { id: "2a", deviceId:"d2", process:"工程A", startCol:2,  endCol:12, assignee:"佐藤美咲" },
  { id: "2b", deviceId:"d2", process:"工程B", startCol:2,  endCol:8,  assignee:"高橋健太" }, // 2a と重複
  { id: "2c", deviceId:"d2", process:"工程B", startCol:14, endCol:26, assignee:"高橋健太" },
  { id: "2d", deviceId:"d2", process:"検査",  startCol:28, endCol:33, assignee:"田中一郎" },
  { id: "2e", deviceId:"d2", process:"出荷",  startCol:35, endCol:36, assignee:"佐藤美咲" },
  { id: "3a", deviceId:"d3", process:"工程A", startCol:5,  endCol:16, assignee:"山田太郎" },
  { id: "3b", deviceId:"d3", process:"工程B", startCol:18, endCol:32, assignee:"鈴木花子" },
  { id: "3c", deviceId:"d3", process:"検査",  startCol:34, endCol:39, assignee:"田中一郎" },
  { id: "3d", deviceId:"d3", process:"出荷",  startCol:41, endCol:42, assignee:"山田太郎" },
  { id: "4a", deviceId:"d4", process:"工程A", startCol:0,  endCol:7,  assignee:"高橋健太" },
  { id: "4b", deviceId:"d4", process:"工程A", startCol:3,  endCol:10, assignee:"田中一郎" }, // 4a と重複
  { id: "4c", deviceId:"d4", process:"工程A", startCol:5,  endCol:12, assignee:"佐藤美咲" }, // さらに重複
  { id: "4d", deviceId:"d4", process:"工程B", startCol:14, endCol:24, assignee:"鈴木花子" },
  { id: "4e", deviceId:"d4", process:"検査",  startCol:26, endCol:30, assignee:"田中一郎" },
  { id: "4f", deviceId:"d4", process:"出荷",  startCol:32, endCol:33, assignee:"山田太郎" },
  { id: "5a", deviceId:"d5", process:"工程A", startCol:3,  endCol:13, assignee:"山田太郎" },
  { id: "5b", deviceId:"d5", process:"工程B", startCol:15, endCol:28, assignee:"鈴木花子" },
  { id: "5c", deviceId:"d5", process:"検査",  startCol:30, endCol:35, assignee:"田中一郎" },
  { id: "5d", deviceId:"d5", process:"出荷",  startCol:37, endCol:38, assignee:"佐藤美咲" },
]

/* ─── レイアウト計算 ─────────────────────────────── */
function computeLayout(bars: BarDef[]): {
  placedBars: PlacedBar[]
  rowMetas: RowMeta[]
  totalRows: number
} {
  const placedBars: PlacedBar[] = []
  const rowMetas: RowMeta[] = []
  let currentRow = 0

  for (const [deviceIdx, device] of DEVICES.entries()) {
    const deviceBars = bars
      .filter((b) => b.deviceId === device.id)
      .sort((a, b) => a.startCol - b.startCol)

    const subRowEnds: number[] = []

    for (const bar of deviceBars) {
      let sub = subRowEnds.findIndex((end) => end < bar.startCol)
      if (sub === -1) { sub = subRowEnds.length; subRowEnds.push(-Infinity) }
      subRowEnds[sub] = bar.endCol
      placedBars.push({ ...bar, absoluteRow: currentRow + sub })
    }

    const rowCount = Math.max(MIN_ROWS, subRowEnds.length)
    for (let i = 0; i < rowCount; i++) {
      rowMetas.push({
        deviceId: device.id,
        deviceIdx,
        deviceName: device.name,
        isFirst: i === 0,
        isLast: i === rowCount - 1,
      })
    }
    currentRow += rowCount
  }

  return { placedBars, rowMetas, totalRows: currentRow }
}

/* ─── UI 状態型 ──────────────────────────────────── */
type ContextMenuState =
  | { type: "cell"; x: number; y: number; row: number; col: number }
  | { type: "bar";  x: number; y: number; barId: string }

type DialogState =
  | { mode: "new";  deviceId: string; startDate: Date; endDate: Date }
  | { mode: "edit"; barId: string }

interface TooltipState { barId: string; anchorX: number; anchorY: number }

/* ─── コンポーネント ──────────────────────────────── */
export default function SpreadsheetGrid() {
  const [bars,        setBars       ] = useState<BarDef[]>(INITIAL_BARS)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dialog,      setDialog     ] = useState<DialogState | null>(null)
  const [tooltip,     setTooltip    ] = useState<TooltipState | null>(null)

  const { placedBars, rowMetas, totalRows } = useMemo(() => computeLayout(bars), [bars])

  const TOTAL_W = ROW_HDR_W + CELL_SIZE * COLS
  const TOTAL_H = DATA_TOP  + CELL_SIZE * totalRows

  /* ─ バー管理 ─ */
  const addBar = (data: DialogFormData) => {
    const startCol = Math.max(0, Math.min(COLS - 1, dateToCol(data.startDate)))
    const endCol   = Math.max(0, Math.min(COLS - 1, dateToCol(data.endDate)))
    setBars((prev) => [...prev, {
      id: crypto.randomUUID(),
      deviceId: data.deviceId,
      process: data.process,
      startCol,
      endCol,
      assignee: data.assignee,
    }])
    setDialog(null)
  }

  const editBar = (barId: string, data: DialogFormData) => {
    const startCol = Math.max(0, Math.min(COLS - 1, dateToCol(data.startDate)))
    const endCol   = Math.max(0, Math.min(COLS - 1, dateToCol(data.endDate)))
    setBars((prev) => prev.map((b) => b.id === barId
      ? { ...b, deviceId: data.deviceId, process: data.process, startCol, endCol, assignee: data.assignee }
      : b
    ))
    setDialog(null)
  }

  const deleteBar = (barId: string) => {
    setBars((prev) => prev.filter((b) => b.id !== barId))
  }

  /* ─ ダイアログ用の initial データ ─ */
  const dialogInitial = (): DialogFormData | null => {
    if (!dialog) return null
    if (dialog.mode === "new") {
      return {
        deviceId: dialog.deviceId,
        process: "工程A",
        startDate: dialog.startDate,
        endDate: dialog.endDate,
        assignee: ASSIGNEES[0],
      }
    }
    const bar = bars.find((b) => b.id === dialog.barId)
    if (!bar) return null
    return {
      deviceId: bar.deviceId,
      process: bar.process,
      startDate: colToDate(bar.startCol),
      endDate:   colToDate(bar.endCol),
      assignee: bar.assignee,
    }
  }

  /* ─ ツールチップ用データ ─ */
  const tooltipInfo = (): TooltipBarInfo | null => {
    if (!tooltip) return null
    const bar    = bars.find((b) => b.id === tooltip.barId)
    const device = DEVICES.find((d) => d.id === bar?.deviceId)
    if (!bar || !device) return null
    return {
      process:    bar.process,
      deviceName: device.name,
      assignee:   bar.assignee,
      startDate:  colToDate(bar.startCol),
      endDate:    colToDate(bar.endCol),
      days:       bar.endCol - bar.startCol + 1,
    }
  }

  /* ─ スタイルヘルパー ─ */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE, height: HDR_H,
    position: "sticky", top: topPx, zIndex: 20,
    borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db",
    backgroundColor: isWeekend(DATES[col]) ? "#fff1f2" : "#f3f4f6",
  })

  const cornerStyle = (topPx: number): React.CSSProperties => ({
    width: ROW_HDR_W, height: HDR_H,
    position: "sticky", top: topPx, left: 0, zIndex: 30,
    backgroundColor: "#e5e7eb",
    borderRight: "1px solid #9ca3af", borderBottom: "1px solid #9ca3af",
  })

  const init = dialogInitial()
  const tipInfo = tooltipInfo()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">

      {/* ── ツールバー ── */}
      <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 shrink-0">
        <span className="text-sm font-semibold text-gray-700">スケジュール管理</span>
        <span className="ml-4 text-xs text-gray-500">
          {DATES[0].toLocaleDateString("ja-JP")} 〜 {DATES[COLS-1].toLocaleDateString("ja-JP")}
        </span>
        <div className="ml-auto flex items-center gap-3 mr-2">
          {(Object.entries(PROCESS_COLOR) as [ProcessName, {bg:string}][]).map(([name, c]) => (
            <div key={name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg }} />
              <span className="text-xs text-gray-600">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── グリッド ── */}
      <div
        className="flex-1 overflow-auto"
        onClick={() => { setContextMenu(null); setTooltip(null) }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${ROW_HDR_W}px repeat(${COLS}, ${CELL_SIZE}px)`,
            width: TOTAL_W, height: TOTAL_H,
            position: "relative",
          }}
        >
          {/* ━━━ 年ヘッダー ━━━ */}
          <div style={cornerStyle(0)} />
          {DATES.map((date, col) => {
            const show = col === 0 || DATES[col-1].getFullYear() !== date.getFullYear()
            return (
              <div key={`y-${col}`} style={colHdrStyle(col, 0)} className="relative">
                {show && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-bold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>
                    {date.getFullYear()}
                  </span>
                )}
              </div>
            )
          })}

          {/* ━━━ 月ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {DATES.map((date, col) => {
            const show = col === 0 || DATES[col-1].getMonth() !== date.getMonth()
            return (
              <div key={`m-${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {show && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>
                    {date.getMonth()+1}月
                  </span>
                )}
              </div>
            )
          })}

          {/* ━━━ 日ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H*2)} />
          {DATES.map((date, col) => {
            const weekend = isWeekend(date)
            return (
              <div key={`d-${col}`} style={colHdrStyle(col, HDR_H*2)} className="flex items-center justify-center">
                <span className={["text-[9px] font-medium", weekend ? "text-red-500 font-bold" : "text-gray-600"].join(" ")}>
                  {date.getDate()}
                </span>
              </div>
            )
          })}

          {/* ━━━ データ行 ━━━ */}
          {rowMetas.map((meta, row) => {
            const bg = DEVICE_BG[meta.deviceIdx % DEVICE_BG.length]
            const bb = meta.isLast ? "2px solid #94a3b8" : "1px solid #e5e7eb"
            const bt = meta.isFirst ? "2px solid #94a3b8" : undefined
            return (
              <React.Fragment key={`row-${row}`}>
                {/* 行ヘッダー */}
                <div
                  style={{
                    width: ROW_HDR_W, height: CELL_SIZE,
                    position: "sticky", left: 0, zIndex: 10,
                    backgroundColor: bg,
                    borderRight: "2px solid #94a3b8",
                    borderBottom: bb, borderTop: bt,
                    display: "flex", alignItems: "center", paddingLeft: 6,
                  }}
                >
                  {meta.isFirst && (
                    <span className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">
                      {meta.deviceName}
                    </span>
                  )}
                </div>

                {/* データセル */}
                {DATES.map((date, col) => {
                  const weekend = isWeekend(date)
                  return (
                    <div
                      key={`${row},${col}`}
                      style={{
                        width: CELL_SIZE, height: CELL_SIZE,
                        backgroundColor: weekend ? "#fff1f2" : bg,
                        borderRight: "1px solid #e5e7eb",
                        borderBottom: bb, borderTop: bt,
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setTooltip(null)
                        setContextMenu({ type: "cell", x: e.clientX, y: e.clientY, row, col })
                      }}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* ━━━ スケジュールバー ━━━ */}
          {placedBars.map((bar) => {
            const c = PROCESS_COLOR[bar.process]
            return (
              <div
                key={bar.id}
                style={{
                  position: "absolute",
                  left:   ROW_HDR_W + bar.startCol * CELL_SIZE,
                  top:    DATA_TOP  + bar.absoluteRow * CELL_SIZE + 1,
                  width:  (bar.endCol - bar.startCol + 1) * CELL_SIZE,
                  height: CELL_SIZE - 2,
                  backgroundColor: c.bg,
                  color: c.fg,
                  zIndex: 5,
                  borderRadius: 3,
                  display: "flex", alignItems: "center", paddingLeft: 4,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  cursor: "pointer",
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setTooltip(null)
                  setContextMenu({ type: "bar", x: e.clientX, y: e.clientY, barId: bar.id })
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                  {bar.process}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ステータスバー ── */}
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300 text-[11px] text-gray-500 flex items-center gap-4">
        <span>{DEVICES.length} 装置 / {totalRows} 行 × {COLS} 列 / 予定 {bars.length} 件</span>
        <span className="text-gray-400">セルを右クリックで予定追加 / 予定バーを右クリックで操作</span>
      </div>

      {/* ── コンテキストメニュー ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onNewSchedule={() => {
            if (contextMenu.type !== "cell") return
            setDialog({
              mode: "new",
              deviceId: rowMetas[contextMenu.row]?.deviceId ?? DEVICES[0].id,
              startDate: colToDate(contextMenu.col),
              endDate:   colToDate(contextMenu.col),
            })
          }}
          onDetail={() => {
            if (contextMenu.type !== "bar") return
            setTooltip({ barId: contextMenu.barId, anchorX: contextMenu.x, anchorY: contextMenu.y })
          }}
          onEdit={() => {
            if (contextMenu.type !== "bar") return
            setDialog({ mode: "edit", barId: contextMenu.barId })
          }}
          onDelete={() => {
            if (contextMenu.type !== "bar") return
            deleteBar(contextMenu.barId)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* ── 予定入力ダイアログ ── */}
      {dialog && init && (
        <ScheduleDialog
          mode={dialog.mode}
          initial={init}
          devices={DEVICES}
          assignees={ASSIGNEES}
          minDate={DATES[0]}
          maxDate={DATES[COLS-1]}
          onSave={(data) => {
            if (dialog.mode === "new") addBar(data)
            else editBar(dialog.barId, data)
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {/* ── 吹き出し詳細表示 ── */}
      {tooltip && tipInfo && (
        <BarTooltip
          bar={tipInfo}
          anchorX={tooltip.anchorX}
          anchorY={tooltip.anchorY}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}
