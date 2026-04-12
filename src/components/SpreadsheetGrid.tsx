"use client"

import React, { useState, useMemo, useRef, useCallback } from "react"
import { ContextMenu } from "./ContextMenu"
import { ScheduleDialog, type ProcessName, type DialogFormData } from "./ScheduleDialog"
import { BarTooltip, type TooltipBarInfo } from "./BarTooltip"

/* ─── グリッド定数 ──────────────────────────────── */
const COLS      = 100
const CELL_SIZE = 20
const ROW_HDR_W = 64
const HDR_H     = 20
const DATA_TOP  = HDR_H * 3   // 60px
const MIN_ROWS  = 3

/* ─── 日付 ──────────────────────────────────────── */
function generateDates(): Date[] {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  return Array.from({ length: COLS }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d })
}
const DATES = generateDates()
function isWeekend(d: Date) { const n = d.getDay(); return n === 0 || n === 6 }
function colToDate(col: number): Date { return DATES[Math.max(0, Math.min(COLS - 1, col))] }
function dateToCol(date: Date): number {
  return Math.round((date.getTime() - DATES[0].getTime()) / 86400000)
}

/* ─── 固定データ ─────────────────────────────────── */
const DEVICES = [
  { id: "d1", name: "装置1" }, { id: "d2", name: "装置2" },
  { id: "d3", name: "装置3" }, { id: "d4", name: "装置4" },
  { id: "d5", name: "装置5" },
]
const ASSIGNEES = ["山田太郎", "鈴木花子", "田中一郎", "佐藤美咲", "高橋健太"]
const PROCESS_COLOR: Record<ProcessName, { bg: string; fg: string }> = {
  "工程A": { bg: "#3b82f6", fg: "#fff" }, "工程B": { bg: "#10b981", fg: "#fff" },
  "検査":  { bg: "#f59e0b", fg: "#fff" }, "出荷":  { bg: "#8b5cf6", fg: "#fff" },
}
const DEVICE_BG = ["#f8fafc","#f0f9ff","#fefce8","#fdf4ff","#f0fdf4",
                   "#fff7ed","#ecfdf5","#fef2f2","#f5f3ff","#f0fdfa"]

/* ─── 型 ────────────────────────────────────────── */
interface BarDef {
  id: string; deviceId: string; process: ProcessName
  startCol: number; endCol: number; assignee: string
}
interface PlacedBar extends BarDef { absoluteRow: number }
interface RowMeta {
  deviceId: string; deviceIdx: number; deviceName: string
  isFirst: boolean; isLast: boolean
}

type ContextMenuState =
  | { type: "cell"; x: number; y: number; row: number; col: number }
  | { type: "bar";  x: number; y: number; barId: string }

type DialogState =
  | { mode: "new";  deviceId: string; startDate: Date; endDate: Date }
  | { mode: "edit"; barId: string }

interface TooltipState { barId: string; anchorX: number; anchorY: number }

interface DragSel {
  startRow: number; startCol: number
  curRow:   number; curCol:   number
  active:   boolean   // マウスが動いたら true
}

/* ─── サンプルデータ ─────────────────────────────── */
const INITIAL_BARS: BarDef[] = [
  { id:"1a", deviceId:"d1", process:"工程A", startCol:0,  endCol:8,  assignee:"山田太郎" },
  { id:"1b", deviceId:"d1", process:"工程B", startCol:10, endCol:22, assignee:"鈴木花子" },
  { id:"1c", deviceId:"d1", process:"検査",  startCol:14, endCol:19, assignee:"田中一郎" },
  { id:"1d", deviceId:"d1", process:"検査",  startCol:24, endCol:28, assignee:"田中一郎" },
  { id:"1e", deviceId:"d1", process:"出荷",  startCol:30, endCol:31, assignee:"山田太郎" },
  { id:"2a", deviceId:"d2", process:"工程A", startCol:2,  endCol:12, assignee:"佐藤美咲" },
  { id:"2b", deviceId:"d2", process:"工程B", startCol:2,  endCol:8,  assignee:"高橋健太" },
  { id:"2c", deviceId:"d2", process:"工程B", startCol:14, endCol:26, assignee:"高橋健太" },
  { id:"2d", deviceId:"d2", process:"検査",  startCol:28, endCol:33, assignee:"田中一郎" },
  { id:"2e", deviceId:"d2", process:"出荷",  startCol:35, endCol:36, assignee:"佐藤美咲" },
  { id:"3a", deviceId:"d3", process:"工程A", startCol:5,  endCol:16, assignee:"山田太郎" },
  { id:"3b", deviceId:"d3", process:"工程B", startCol:18, endCol:32, assignee:"鈴木花子" },
  { id:"3c", deviceId:"d3", process:"検査",  startCol:34, endCol:39, assignee:"田中一郎" },
  { id:"3d", deviceId:"d3", process:"出荷",  startCol:41, endCol:42, assignee:"山田太郎" },
  { id:"4a", deviceId:"d4", process:"工程A", startCol:0,  endCol:7,  assignee:"高橋健太" },
  { id:"4b", deviceId:"d4", process:"工程A", startCol:3,  endCol:10, assignee:"田中一郎" },
  { id:"4c", deviceId:"d4", process:"工程A", startCol:5,  endCol:12, assignee:"佐藤美咲" },
  { id:"4d", deviceId:"d4", process:"工程B", startCol:14, endCol:24, assignee:"鈴木花子" },
  { id:"4e", deviceId:"d4", process:"検査",  startCol:26, endCol:30, assignee:"田中一郎" },
  { id:"4f", deviceId:"d4", process:"出荷",  startCol:32, endCol:33, assignee:"山田太郎" },
  { id:"5a", deviceId:"d5", process:"工程A", startCol:3,  endCol:13, assignee:"山田太郎" },
  { id:"5b", deviceId:"d5", process:"工程B", startCol:15, endCol:28, assignee:"鈴木花子" },
  { id:"5c", deviceId:"d5", process:"検査",  startCol:30, endCol:35, assignee:"田中一郎" },
  { id:"5d", deviceId:"d5", process:"出荷",  startCol:37, endCol:38, assignee:"佐藤美咲" },
]

/* ─── レイアウト計算 ─────────────────────────────── */
function computeLayout(bars: BarDef[]): {
  placedBars: PlacedBar[]; rowMetas: RowMeta[]; totalRows: number
} {
  const placedBars: PlacedBar[] = []
  const rowMetas: RowMeta[] = []
  let currentRow = 0
  for (const [deviceIdx, device] of DEVICES.entries()) {
    const deviceBars = bars.filter((b) => b.deviceId === device.id)
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
      rowMetas.push({ deviceId: device.id, deviceIdx, deviceName: device.name,
        isFirst: i === 0, isLast: i === rowCount - 1 })
    }
    currentRow += rowCount
  }
  return { placedBars, rowMetas, totalRows: currentRow }
}

/* ─── コンポーネント ──────────────────────────────── */
export default function SpreadsheetGrid() {
  const containerRef = useRef<HTMLDivElement>(null)

  /* バーデータ */
  const [bars,        setBars       ] = useState<BarDef[]>(INITIAL_BARS)
  /* セル単体選択 */
  const [selectedCell,   setSelectedCell  ] = useState<{row:number;col:number}|null>(null)
  /* バー選択 (複数可) */
  const [selectedBarIds, setSelectedBarIds] = useState<Set<string>>(new Set())
  /* コピー済みバー */
  const [copiedBar,      setCopiedBar     ] = useState<BarDef|null>(null)
  /* ドラッグ選択 */
  const [dragSel,        setDragSel       ] = useState<DragSel|null>(null)
  /* UI オーバーレイ状態 */
  const [contextMenu,    setContextMenu   ] = useState<ContextMenuState|null>(null)
  const [dialog,         setDialog        ] = useState<DialogState|null>(null)
  const [tooltip,        setTooltip       ] = useState<TooltipState|null>(null)

  const { placedBars, rowMetas, totalRows } = useMemo(() => computeLayout(bars), [bars])
  const TOTAL_W = ROW_HDR_W + CELL_SIZE * COLS
  const TOTAL_H = DATA_TOP  + CELL_SIZE * totalRows

  /* ─ ポインタ → グリッド座標変換 ─ */
  const getGridPos = useCallback((clientX: number, clientY: number) => {
    const c = containerRef.current; if (!c) return null
    const rect = c.getBoundingClientRect()
    const relX = clientX - rect.left
    const relY = clientY - rect.top
    // スティッキーヘッダー領域は除外
    if (relX < ROW_HDR_W || relY < DATA_TOP) return null
    const col = Math.floor((relX + c.scrollLeft - ROW_HDR_W) / CELL_SIZE)
    const row = Math.floor((relY + c.scrollTop  - DATA_TOP ) / CELL_SIZE)
    if (col < 0 || col >= COLS || row < 0 || row >= totalRows) return null
    return { row, col }
  }, [totalRows])

  /* ─ バー管理 ─ */
  const addBar = (data: DialogFormData) => {
    const sc = Math.max(0, Math.min(COLS-1, dateToCol(data.startDate)))
    const ec = Math.max(0, Math.min(COLS-1, dateToCol(data.endDate)))
    setBars(prev => [...prev, { id: crypto.randomUUID(), deviceId: data.deviceId,
      process: data.process, startCol: sc, endCol: ec, assignee: data.assignee }])
    setDialog(null)
  }
  const editBar = (barId: string, data: DialogFormData) => {
    const sc = Math.max(0, Math.min(COLS-1, dateToCol(data.startDate)))
    const ec = Math.max(0, Math.min(COLS-1, dateToCol(data.endDate)))
    setBars(prev => prev.map(b => b.id === barId
      ? { ...b, deviceId: data.deviceId, process: data.process, startCol: sc, endCol: ec, assignee: data.assignee }
      : b))
    setDialog(null)
  }
  const deleteBar = (barId: string) => {
    setBars(prev => prev.filter(b => b.id !== barId))
    setSelectedBarIds(prev => { const n = new Set(prev); n.delete(barId); return n })
  }
  const deleteSelected = () => {
    setBars(prev => prev.filter(b => !selectedBarIds.has(b.id)))
    setSelectedBarIds(new Set())
  }
  const pasteBar = (row: number, col: number) => {
    if (!copiedBar) return
    const deviceId = rowMetas[row]?.deviceId ?? DEVICES[0].id
    const duration = copiedBar.endCol - copiedBar.startCol
    const sc = Math.max(0, Math.min(COLS-1, col))
    const ec = Math.max(0, Math.min(COLS-1, col + duration))
    setBars(prev => [...prev, { id: crypto.randomUUID(), deviceId,
      process: copiedBar.process, startCol: sc, endCol: ec, assignee: copiedBar.assignee }])
    setContextMenu(null)
  }

  /* ─ ドラッグ選択: ポインタハンドラ ─ */
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragSel({ startRow: pos.row, startCol: pos.col, curRow: pos.row, curCol: pos.col, active: false })
    // オーバーレイを閉じる
    setContextMenu(null); setTooltip(null)
  }, [getGridPos])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDragSel(prev => {
      if (!prev) return null
      const pos = getGridPos(e.clientX, e.clientY); if (!pos) return prev
      const moved = pos.row !== prev.startRow || pos.col !== prev.startCol
      return { ...prev, curRow: pos.row, curCol: pos.col, active: prev.active || moved }
    })
  }, [getGridPos])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragSel(prev => {
      if (!prev) return null
      if (prev.active) {
        // ドラッグ: 矩形内のバーを選択
        const rowMin = Math.min(prev.startRow, prev.curRow)
        const rowMax = Math.max(prev.startRow, prev.curRow)
        const colMin = Math.min(prev.startCol, prev.curCol)
        const colMax = Math.max(prev.startCol, prev.curCol)
        const ids = new Set(
          placedBars
            .filter(b => b.absoluteRow >= rowMin && b.absoluteRow <= rowMax
                      && b.startCol <= colMax && b.endCol >= colMin)
            .map(b => b.id)
        )
        setSelectedBarIds(ids)
        setSelectedCell(null)
      } else {
        // クリック: セル選択
        setSelectedCell({ row: prev.startRow, col: prev.startCol })
        setSelectedBarIds(new Set())
      }
      return null
    })
  }, [placedBars])

  /* ─ ダイアログ initial データ ─ */
  const dialogInitial = (): DialogFormData | null => {
    if (!dialog) return null
    if (dialog.mode === "new") return { deviceId: dialog.deviceId, process: "工程A",
      startDate: dialog.startDate, endDate: dialog.endDate, assignee: ASSIGNEES[0] }
    const bar = bars.find(b => b.id === dialog.barId); if (!bar) return null
    return { deviceId: bar.deviceId, process: bar.process,
      startDate: colToDate(bar.startCol), endDate: colToDate(bar.endCol), assignee: bar.assignee }
  }
  const tooltipInfo = (): TooltipBarInfo | null => {
    if (!tooltip) return null
    const bar = bars.find(b => b.id === tooltip.barId)
    const dev = DEVICES.find(d => d.id === bar?.deviceId)
    if (!bar || !dev) return null
    return { process: bar.process, deviceName: dev.name, assignee: bar.assignee,
      startDate: colToDate(bar.startCol), endDate: colToDate(bar.endCol),
      days: bar.endCol - bar.startCol + 1 }
  }

  /* ─ スタイルヘルパー ─ */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE, height: HDR_H, position:"sticky", top: topPx, zIndex: 20,
    borderRight:"1px solid #d1d5db", borderBottom:"1px solid #d1d5db",
    backgroundColor: isWeekend(DATES[col]) ? "#fff1f2" : "#f3f4f6",
  })
  const cornerStyle = (topPx: number): React.CSSProperties => ({
    width: ROW_HDR_W, height: HDR_H, position:"sticky", top: topPx, left:0, zIndex:30,
    backgroundColor:"#e5e7eb", borderRight:"1px solid #9ca3af", borderBottom:"1px solid #9ca3af",
  })

  /* ─ ドラッグ選択矩形 ─ */
  const dragRect = dragSel?.active ? (() => {
    const rowMin = Math.min(dragSel.startRow, dragSel.curRow)
    const rowMax = Math.max(dragSel.startRow, dragSel.curRow)
    const colMin = Math.min(dragSel.startCol, dragSel.curCol)
    const colMax = Math.max(dragSel.startCol, dragSel.curCol)
    return {
      left:   ROW_HDR_W + colMin * CELL_SIZE,
      top:    DATA_TOP  + rowMin * CELL_SIZE,
      width:  (colMax - colMin + 1) * CELL_SIZE,
      height: (rowMax - rowMin + 1) * CELL_SIZE,
    }
  })() : null

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

      {/* ── グリッドスクロール領域 ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ cursor: dragSel?.active ? "crosshair" : "default" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-bold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getFullYear()}</span>}
              </div>
            )
          })}

          {/* ━━━ 月ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {DATES.map((date, col) => {
            const show = col === 0 || DATES[col-1].getMonth() !== date.getMonth()
            return (
              <div key={`m-${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getMonth()+1}月</span>}
              </div>
            )
          })}

          {/* ━━━ 日ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H*2)} />
          {DATES.map((date, col) => {
            const weekend = isWeekend(date)
            return (
              <div key={`d-${col}`} style={colHdrStyle(col, HDR_H*2)} className="flex items-center justify-center">
                <span className={["text-[9px] font-medium", weekend ? "text-red-500 font-bold" : "text-gray-600"].join(" ")}>{date.getDate()}</span>
              </div>
            )
          })}

          {/* ━━━ データ行 ━━━ */}
          {rowMetas.map((meta, row) => {
            const bg  = DEVICE_BG[meta.deviceIdx % DEVICE_BG.length]
            const bb  = meta.isLast ? "2px solid #94a3b8" : "1px solid #e5e7eb"
            const bt  = meta.isFirst ? "2px solid #94a3b8" : undefined
            const selCell = selectedCell?.row === row

            return (
              <React.Fragment key={`row-${row}`}>
                {/* 行ヘッダー */}
                <div
                  style={{ width: ROW_HDR_W, height: CELL_SIZE, position:"sticky", left:0, zIndex:10,
                    backgroundColor: bg, borderRight:"2px solid #94a3b8",
                    borderBottom: bb, borderTop: bt,
                    display:"flex", alignItems:"center", paddingLeft:6 }}
                >
                  {meta.isFirst && <span className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">{meta.deviceName}</span>}
                </div>

                {/* データセル */}
                {DATES.map((date, col) => {
                  const weekend = isWeekend(date)
                  const isSel = selCell && selectedCell?.col === col
                  return (
                    <div
                      key={`${row},${col}`}
                      style={{
                        width: CELL_SIZE, height: CELL_SIZE,
                        backgroundColor: isSel ? "#bfdbfe" : weekend ? "#fff1f2" : bg,
                        borderRight: "1px solid #e5e7eb",
                        borderBottom: bb, borderTop: bt,
                        ...(isSel ? { outline:"2px solid #3b82f6", outlineOffset:"-2px",
                          position:"relative" as const, zIndex:11 } : {}),
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        setTooltip(null)
                        setContextMenu({ type:"cell", x:e.clientX, y:e.clientY, row, col })
                      }}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* ━━━ スケジュールバー ━━━ */}
          {placedBars.map((bar) => {
            const c   = PROCESS_COLOR[bar.process]
            const sel = selectedBarIds.has(bar.id)
            return (
              <div
                key={bar.id}
                data-bar-id={bar.id}
                style={{
                  position: "absolute",
                  left:   ROW_HDR_W + bar.startCol * CELL_SIZE,
                  top:    DATA_TOP  + bar.absoluteRow * CELL_SIZE + 1,
                  width:  (bar.endCol - bar.startCol + 1) * CELL_SIZE,
                  height: CELL_SIZE - 2,
                  backgroundColor: c.bg,
                  color: c.fg,
                  zIndex: sel ? 7 : 5,
                  borderRadius: 3,
                  display: "flex", alignItems: "center", paddingLeft: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  /* 選択枠 */
                  outline: sel ? "2px solid #1e3a8a" : "none",
                  outlineOffset: sel ? "1px" : "0",
                  boxShadow: sel
                    ? "0 0 0 2px #1e3a8a, 0 2px 6px rgba(0,0,0,0.3)"
                    : "0 1px 3px rgba(0,0,0,0.25)",
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.stopPropagation() // コンテナのドラッグ選択を抑制
                  setSelectedCell(null)
                  setContextMenu(null); setTooltip(null)
                  // Shift/Ctrl で追加選択、それ以外は単体選択
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    setSelectedBarIds(prev => {
                      const n = new Set(prev)
                      n.has(bar.id) ? n.delete(bar.id) : n.add(bar.id)
                      return n
                    })
                  } else if (!selectedBarIds.has(bar.id)) {
                    setSelectedBarIds(new Set([bar.id]))
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  setTooltip(null)
                  // 未選択バーを右クリック → そのバーだけ選択
                  if (!selectedBarIds.has(bar.id)) setSelectedBarIds(new Set([bar.id]))
                  setContextMenu({ type:"bar", x:e.clientX, y:e.clientY, barId:bar.id })
                }}
              >
                <span style={{ fontSize:9, fontWeight:700, whiteSpace:"nowrap", letterSpacing:"0.02em" }}>
                  {bar.process}
                </span>
              </div>
            )
          })}

          {/* ━━━ ドラッグ選択矩形 ━━━ */}
          {dragRect && (
            <div
              style={{
                position: "absolute",
                left:   dragRect.left,
                top:    dragRect.top,
                width:  dragRect.width,
                height: dragRect.height,
                backgroundColor: "rgba(59,130,246,0.08)",
                border: "1.5px solid #3b82f6",
                zIndex: 8,
                pointerEvents: "none",
                borderRadius: 2,
              }}
            />
          )}
        </div>
      </div>

      {/* ── ステータスバー ── */}
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300 text-[11px] text-gray-500 flex items-center gap-4">
        <span>{DEVICES.length} 装置 / {totalRows} 行 × {COLS} 列 / 予定 {bars.length} 件</span>
        {selectedBarIds.size > 0 && (
          <span className="text-blue-600 font-semibold">{selectedBarIds.size} 件選択中</span>
        )}
        {copiedBar && (
          <span className="text-purple-600">📋 {copiedBar.process} をコピー済み</span>
        )}
        <span className="text-gray-400 ml-auto">
          右クリック: メニュー｜ドラッグ: 複数選択｜Shift/Ctrl+クリック: 追加選択
        </span>
      </div>

      {/* ── コンテキストメニュー ── */}
      {contextMenu && (() => {
        const barId     = contextMenu.type === "bar" ? contextMenu.barId : ""
        const multiSel  = selectedBarIds.size > 1 && selectedBarIds.has(barId)
        return (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y}
            type={contextMenu.type}
            hasClipboard={copiedBar !== null}
            isMultiSelect={multiSel}
            selectedCount={selectedBarIds.size}
            onNewSchedule={() => {
              if (contextMenu.type !== "cell") return
              setDialog({ mode:"new",
                deviceId: rowMetas[contextMenu.row]?.deviceId ?? DEVICES[0].id,
                startDate: colToDate(contextMenu.col), endDate: colToDate(contextMenu.col) })
            }}
            onPaste={() => {
              if (contextMenu.type !== "cell") return
              pasteBar(contextMenu.row, contextMenu.col)
            }}
            onDetail={() => {
              if (contextMenu.type !== "bar") return
              setTooltip({ barId, anchorX: contextMenu.x, anchorY: contextMenu.y })
            }}
            onEdit={() => {
              if (contextMenu.type !== "bar") return
              setDialog({ mode:"edit", barId })
            }}
            onCopy={() => {
              if (contextMenu.type !== "bar") return
              const bar = bars.find(b => b.id === barId)
              if (bar) setCopiedBar(bar)
            }}
            onDelete={() => {
              if (contextMenu.type !== "bar") return
              deleteBar(barId)
            }}
            onDeleteSelected={deleteSelected}
            onClose={() => setContextMenu(null)}
          />
        )
      })()}

      {/* ── 予定入力ダイアログ ── */}
      {dialog && init && (
        <ScheduleDialog
          mode={dialog.mode} initial={init}
          devices={DEVICES} assignees={ASSIGNEES}
          minDate={DATES[0]} maxDate={DATES[COLS-1]}
          onSave={(data) => dialog.mode === "new" ? addBar(data) : editBar(dialog.barId, data)}
          onClose={() => setDialog(null)}
        />
      )}

      {/* ── 吹き出し詳細 ── */}
      {tooltip && tipInfo && (
        <BarTooltip
          bar={tipInfo}
          anchorX={tooltip.anchorX} anchorY={tooltip.anchorY}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}
