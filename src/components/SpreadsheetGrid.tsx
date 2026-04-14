"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import { ContextMenu } from "./ContextMenu"
import { ScheduleDialog, type ProcessName, type DialogFormData } from "./ScheduleDialog"
import { BarTooltip, type TooltipBarInfo } from "./BarTooltip"

/* ─── 定数 ──────────────────────────────────────── */
const COLS        = 120   // 約4ヶ月
const CELL_SIZE   = 20
const ROW_HDR_W   = 64
const HDR_H       = 20
const DATA_TOP    = HDR_H * 3
const MIN_ROWS    = 3
const BUFFER_ROWS = 12   // 上下バッファ行数

/* ─── 日付 ──────────────────────────────────────── */
function generateDates(): Date[] {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  return Array.from({ length: COLS }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i); return d
  })
}
const DATES = generateDates()
const WEEKEND_COLS = new Set(DATES.map((d, i) => (d.getDay() === 0 || d.getDay() === 6) ? i : -1).filter(i => i >= 0))
function colToDate(col: number): Date { return DATES[Math.max(0, Math.min(COLS - 1, col))] }
function dateToCol(date: Date) { return Math.round((date.getTime() - DATES[0].getTime()) / 86400000) }

/* ─── 固定データ ─────────────────────────────────── */
const DEVICES = Array.from({ length: 100 }, (_, i) => ({ id: `d${i+1}`, name: `装置${i+1}` }))
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
interface RowMeta { deviceId: string; deviceIdx: number; deviceName: string; isFirst: boolean; isLast: boolean }
interface DragSel { startRow: number; startCol: number; curRow: number; curCol: number; active: boolean }

type ContextMenuState =
  | { type: "cell"; x: number; y: number; row: number; col: number }
  | { type: "bar";  x: number; y: number; barId: string }
type DialogState =
  | { mode: "new";  deviceId: string; startDate: Date; endDate: Date }
  | { mode: "edit"; barId: string }
interface TooltipState { barId: string; anchorX: number; anchorY: number }

/* ─── サンプルデータ生成 (100装置×1000件) ─────────── */
// シード付き LCG 擬似乱数 — Math.random() の代わりに使用して決定論的にする
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

function generateSampleBars(): BarDef[] {
  const procs: ProcessName[] = ["工程A", "工程B", "検査", "出荷"]
  const rand = makeLCG(42)   // 固定シード → 毎回同じデータ
  const bars: BarDef[] = []
  let id = 0
  for (const dev of DEVICES) {
    let col = Math.floor(rand() * 10)
    for (let j = 0; j < 10; j++) {
      const proc = procs[j % 4]
      const len = 3 + Math.floor(rand() * 12)
      const sc = Math.min(col, COLS - 2)
      const ec = Math.min(sc + len, COLS - 1)
      bars.push({ id: `s${++id}`, deviceId: dev.id, process: proc,
        startCol: sc, endCol: ec, assignee: ASSIGNEES[id % ASSIGNEES.length] })
      col = ec + 1 + Math.floor(rand() * 5)
      if (col >= COLS) break
    }
  }
  return bars.slice(0, 1000)
}
const INITIAL_BARS = generateSampleBars()

/* ─── レイアウト計算 ─────────────────────────────── */
function computeLayout(bars: BarDef[]): { placedBars: PlacedBar[]; rowMetas: RowMeta[]; totalRows: number } {
  const placedBars: PlacedBar[] = []
  const rowMetas: RowMeta[] = []
  let currentRow = 0
  for (const [di, device] of DEVICES.entries()) {
    const dBars = bars.filter(b => b.deviceId === device.id).sort((a, b) => a.startCol - b.startCol)
    const subRowEnds: number[] = []
    for (const bar of dBars) {
      let sub = subRowEnds.findIndex(e => e < bar.startCol)
      if (sub === -1) { sub = subRowEnds.length; subRowEnds.push(-Infinity) }
      subRowEnds[sub] = bar.endCol
      placedBars.push({ ...bar, absoluteRow: currentRow + sub })
    }
    const rowCount = Math.max(MIN_ROWS, subRowEnds.length)
    for (let i = 0; i < rowCount; i++)
      rowMetas.push({ deviceId: device.id, deviceIdx: di, deviceName: device.name,
        isFirst: i === 0, isLast: i === rowCount - 1 })
    currentRow += rowCount
  }
  return { placedBars, rowMetas, totalRows: currentRow }
}

/* ─── コンポーネント ──────────────────────────────── */
export default function SpreadsheetGrid() {
  /* ── DOM refs (直接操作 → 再レンダリングなし) ── */
  const containerRef       = useRef<HTMLDivElement>(null)
  const selCellRef         = useRef<HTMLDivElement>(null)
  const dragRectRef        = useRef<HTMLDivElement>(null)
  const dragSelRef         = useRef<DragSel | null>(null)
  const selectedCellRef    = useRef<{ row: number; col: number } | null>(null)
  const rectCacheRef       = useRef<DOMRect | null>(null)

  /* ── React state (再レンダリングが必要なもののみ) ── */
  const [bars,          setBars         ] = useState<BarDef[]>(INITIAL_BARS)
  const [selectedBarIds,setSelectedBarIds] = useState<Set<string>>(new Set())
  const [copiedBar,     setCopiedBar    ] = useState<BarDef | null>(null)
  const [contextMenu,   setContextMenu  ] = useState<ContextMenuState | null>(null)
  const [dialog,        setDialog       ] = useState<DialogState | null>(null)
  const [tooltip,       setTooltip      ] = useState<TooltipState | null>(null)
  /* 仮想スクロール: 表示行範囲のみ */
  const [visibleRows,   setVisibleRows  ] = useState({ start: 0, end: 79 })

  const { placedBars, rowMetas, totalRows } = useMemo(() => computeLayout(bars), [bars])

  /* totalRows 変化時に visibleRows を補正 */
  useEffect(() => {
    setVisibleRows(prev => ({ start: prev.start, end: Math.min(totalRows - 1, prev.end) }))
  }, [totalRows])

  /* ── ユーティリティ ── */
  const getRect = () => {
    if (!rectCacheRef.current && containerRef.current)
      rectCacheRef.current = containerRef.current.getBoundingClientRect()
    return rectCacheRef.current
  }

  const getGridPos = (clientX: number, clientY: number) => {
    const c = containerRef.current; if (!c) return null
    const rect = getRect(); if (!rect) return null
    const relX = clientX - rect.left, relY = clientY - rect.top
    if (relX < ROW_HDR_W || relY < DATA_TOP) return null
    const col = Math.floor((relX + c.scrollLeft - ROW_HDR_W) / CELL_SIZE)
    const row = Math.floor((relY + c.scrollTop  - DATA_TOP ) / CELL_SIZE)
    if (col < 0 || col >= COLS || row < 0 || row >= totalRows) return null
    return { row, col }
  }

  /* 選択セルオーバーレイを直接 DOM 更新 */
  const showSelCell = (row: number, col: number) => {
    selectedCellRef.current = { row, col }
    const el = selCellRef.current; if (!el) return
    el.style.display = "block"
    el.style.left   = `${ROW_HDR_W + col * CELL_SIZE}px`
    el.style.top    = `${DATA_TOP  + row * CELL_SIZE}px`
    el.style.width  = `${CELL_SIZE}px`
    el.style.height = `${CELL_SIZE}px`
  }
  const hideSelCell = () => {
    selectedCellRef.current = null
    const el = selCellRef.current; if (el) el.style.display = "none"
  }

  /* ドラッグ矩形を直接 DOM 更新 */
  const updateDragRect = (drag: DragSel | null) => {
    const el = dragRectRef.current; if (!el) return
    if (!drag?.active) { el.style.display = "none"; return }
    const r0 = Math.min(drag.startRow, drag.curRow), r1 = Math.max(drag.startRow, drag.curRow)
    const c0 = Math.min(drag.startCol, drag.curCol), c1 = Math.max(drag.startCol, drag.curCol)
    el.style.display = "block"
    el.style.left   = `${ROW_HDR_W + c0 * CELL_SIZE}px`
    el.style.top    = `${DATA_TOP  + r0 * CELL_SIZE}px`
    el.style.width  = `${(c1 - c0 + 1) * CELL_SIZE}px`
    el.style.height = `${(r1 - r0 + 1) * CELL_SIZE}px`
  }

  /* ── スクロール: 表示行範囲を更新 ── */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget
    rectCacheRef.current = null  // 座標キャッシュ無効化
    const dataTop = Math.max(0, scrollTop - DATA_TOP)
    const start = Math.max(0, Math.floor(dataTop / CELL_SIZE) - BUFFER_ROWS)
    const end   = Math.min(totalRows - 1, Math.ceil((dataTop + clientHeight) / CELL_SIZE) + BUFFER_ROWS)
    setVisibleRows(prev => (prev.start === start && prev.end === end) ? prev : { start, end })
  }

  /* ── ポインタハンドラ (state 更新なし → 再レンダリングなし) ── */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragSelRef.current = { startRow: pos.row, startCol: pos.col,
      curRow: pos.row, curCol: pos.col, active: false }
    if (contextMenu) setContextMenu(null)
    if (tooltip)     setTooltip(null)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragSelRef.current; if (!drag) return
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    drag.curRow = pos.row; drag.curCol = pos.col
    drag.active = drag.active || pos.row !== drag.startRow || pos.col !== drag.startCol
    updateDragRect(drag)  // 直接 DOM 操作 → 再レンダリングなし
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const drag = dragSelRef.current; dragSelRef.current = null
    updateDragRect(null)
    if (!drag) return
    if (drag.active) {
      /* ドラッグ選択: 矩形と重なるバーを選択 */
      const r0 = Math.min(drag.startRow, drag.curRow), r1 = Math.max(drag.startRow, drag.curRow)
      const c0 = Math.min(drag.startCol, drag.curCol), c1 = Math.max(drag.startCol, drag.curCol)
      const ids = new Set(placedBars.filter(b =>
        b.absoluteRow >= r0 && b.absoluteRow <= r1 && b.startCol <= c1 && b.endCol >= c0
      ).map(b => b.id))
      setSelectedBarIds(ids)
      hideSelCell()
    } else {
      /* クリック: セル選択 (直接 DOM 操作) */
      showSelCell(drag.startRow, drag.startCol)
      setSelectedBarIds(prev => prev.size > 0 ? new Set() : prev)
    }
  }

  /* ── コンテキストメニュー (セル: コンテナ委譲) ── */
  const handleContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    setTooltip(null)
    setContextMenu({ type: "cell", x: e.clientX, y: e.clientY, row: pos.row, col: pos.col })
  }

  /* ── バー操作 ── */
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
  const deleteBar    = (id: string) => { setBars(prev => prev.filter(b => b.id !== id)); setSelectedBarIds(prev => { const n = new Set(prev); n.delete(id); return n }) }
  const deleteSelected = () => { setBars(prev => prev.filter(b => !selectedBarIds.has(b.id))); setSelectedBarIds(new Set()) }
  const pasteBar = (row: number, col: number) => {
    if (!copiedBar) return
    const dur = copiedBar.endCol - copiedBar.startCol
    const sc = Math.max(0, Math.min(COLS-1, col))
    const ec = Math.max(0, Math.min(COLS-1, col + dur))
    setBars(prev => [...prev, { id: crypto.randomUUID(),
      deviceId: rowMetas[row]?.deviceId ?? DEVICES[0].id,
      process: copiedBar.process, startCol: sc, endCol: ec, assignee: copiedBar.assignee }])
    setContextMenu(null)
  }

  /* ── ダイアログ初期値 ── */
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

  /* ── 表示バー (可視行範囲のみ) ── */
  const visibleBars = useMemo(
    () => placedBars.filter(b => b.absoluteRow >= visibleRows.start && b.absoluteRow <= visibleRows.end),
    [placedBars, visibleRows]
  )

  /* ── スタイルヘルパー ── */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE, height: HDR_H, position: "sticky", top: topPx, zIndex: 20,
    borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db",
    backgroundColor: WEEKEND_COLS.has(col) ? "#fff1f2" : "#f3f4f6",
  })
  const cornerStyle = (topPx: number): React.CSSProperties => ({
    width: ROW_HDR_W, height: HDR_H, position: "sticky", top: topPx, left: 0, zIndex: 30,
    backgroundColor: "#e5e7eb", borderRight: "1px solid #9ca3af", borderBottom: "1px solid #9ca3af",
  })

  const init     = dialogInitial()
  const tipInfo  = tooltipInfo()
  const barId    = contextMenu?.type === "bar" ? contextMenu.barId : ""
  const multiSel = selectedBarIds.size > 1 && selectedBarIds.has(barId)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">

      {/* ツールバー */}
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

      {/* グリッド (仮想スクロール) */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContainerContextMenu}
        onClick={() => { setContextMenu(null); setTooltip(null) }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${ROW_HDR_W}px repeat(${COLS}, ${CELL_SIZE}px)`,
            width: ROW_HDR_W + CELL_SIZE * COLS,
            position: "relative",
          }}
        >
          {/* ━━━ 年ヘッダー ━━━ */}
          <div style={cornerStyle(0)} />
          {DATES.map((date, col) => {
            const show = col === 0 || DATES[col-1].getFullYear() !== date.getFullYear()
            return (
              <div key={`y${col}`} style={colHdrStyle(col, 0)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-bold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getFullYear()}</span>}
              </div>
            )
          })}

          {/* ━━━ 月ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {DATES.map((date, col) => {
            const show = col === 0 || DATES[col-1].getMonth() !== date.getMonth()
            return (
              <div key={`m${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getMonth()+1}月</span>}
              </div>
            )
          })}

          {/* ━━━ 日ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H*2)} />
          {DATES.map((date, col) => (
            <div key={`d${col}`} style={colHdrStyle(col, HDR_H*2)} className="flex items-center justify-center">
              <span className={`text-[9px] font-medium ${WEEKEND_COLS.has(col) ? "text-red-500 font-bold" : "text-gray-600"}`}>{date.getDate()}</span>
            </div>
          ))}

          {/* ━━━ 上部スペーサー ━━━ */}
          {visibleRows.start > 0 && (
            <div style={{ gridColumn: "1 / -1", height: visibleRows.start * CELL_SIZE }} />
          )}

          {/* ━━━ 可視データ行のみ描画 ━━━ */}
          {Array.from({ length: visibleRows.end - visibleRows.start + 1 }, (_, i) => {
            const row = visibleRows.start + i
            if (row >= totalRows) return null
            const meta = rowMetas[row]
            const bg   = DEVICE_BG[meta.deviceIdx % DEVICE_BG.length]
            const bbW  = meta.isLast ? "2px" : "1px"
            const bbC  = meta.isLast ? "#94a3b8" : "#e5e7eb"
            const btW  = meta.isFirst ? "2px" : undefined
            const btC  = meta.isFirst ? "#94a3b8" : undefined
            return (
              <React.Fragment key={`row-${row}`}>
                {/* 行ヘッダー */}
                <div style={{
                  width: ROW_HDR_W, height: CELL_SIZE,
                  position: "sticky", left: 0, zIndex: 10,
                  backgroundColor: bg,
                  borderRight: "2px solid #94a3b8",
                  borderBottom: `${bbW} solid ${bbC}`,
                  borderTop: btW ? `${btW} solid ${btC}` : undefined,
                  display: "flex", alignItems: "center", paddingLeft: 6,
                }}>
                  {meta.isFirst && <span className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">{meta.deviceName}</span>}
                </div>

                {/* データセル (イベントハンドラなし → 高速) */}
                {DATES.map((_, col) => (
                  <div
                    key={`${row},${col}`}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE,
                      backgroundColor: WEEKEND_COLS.has(col) ? "#fff1f2" : bg,
                      borderRight: "1px solid #e5e7eb",
                      borderBottom: `${bbW} solid ${bbC}`,
                      borderTop: btW ? `${btW} solid ${btC}` : undefined,
                    }}
                  />
                ))}
              </React.Fragment>
            )
          })}

          {/* ━━━ 下部スペーサー ━━━ */}
          {visibleRows.end < totalRows - 1 && (
            <div style={{ gridColumn: "1 / -1", height: (totalRows - visibleRows.end - 1) * CELL_SIZE }} />
          )}

          {/* ━━━ 可視バーのみ描画 ━━━ */}
          {visibleBars.map(bar => {
            const c   = PROCESS_COLOR[bar.process]
            const sel = selectedBarIds.has(bar.id)
            return (
              <div
                key={bar.id}
                style={{
                  position: "absolute",
                  left:   ROW_HDR_W + bar.startCol * CELL_SIZE,
                  top:    DATA_TOP  + bar.absoluteRow * CELL_SIZE + 1,
                  width:  (bar.endCol - bar.startCol + 1) * CELL_SIZE,
                  height: CELL_SIZE - 2,
                  backgroundColor: c.bg, color: c.fg,
                  zIndex: sel ? 7 : 5,
                  borderRadius: 3,
                  display: "flex", alignItems: "center", paddingLeft: 4,
                  overflow: "hidden", cursor: "pointer",
                  outline: sel ? "2px solid #1e3a8a" : "none",
                  outlineOffset: sel ? "1px" : "0",
                  boxShadow: sel ? "0 0 0 2px #1e3a8a,0 2px 6px rgba(0,0,0,.3)" : "0 1px 3px rgba(0,0,0,.25)",
                }}
                onPointerDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  hideSelCell()
                  setContextMenu(null); setTooltip(null)
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    setSelectedBarIds(prev => { const n = new Set(prev); n.has(bar.id) ? n.delete(bar.id) : n.add(bar.id); return n })
                  } else if (!selectedBarIds.has(bar.id)) {
                    setSelectedBarIds(new Set([bar.id]))
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault(); e.stopPropagation()
                  setTooltip(null)
                  if (!selectedBarIds.has(bar.id)) setSelectedBarIds(new Set([bar.id]))
                  setContextMenu({ type: "bar", x: e.clientX, y: e.clientY, barId: bar.id })
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                  {bar.process}
                </span>
              </div>
            )
          })}

          {/* ━━━ 選択セルオーバーレイ (直接 DOM 制御) ━━━ */}
          <div ref={selCellRef} style={{
            display: "none", position: "absolute", zIndex: 11, pointerEvents: "none",
            border: "2px solid #3b82f6", backgroundColor: "rgba(191,219,254,0.4)", boxSizing: "border-box",
          }} />

          {/* ━━━ ドラッグ選択矩形 (直接 DOM 制御) ━━━ */}
          <div ref={dragRectRef} style={{
            display: "none", position: "absolute", zIndex: 8, pointerEvents: "none",
            border: "1.5px solid #3b82f6", backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 2,
          }} />
        </div>
      </div>

      {/* ステータスバー */}
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300 text-[11px] text-gray-500 flex items-center gap-4">
        <span>{DEVICES.length} 装置 / {totalRows} 行 × {COLS} 列 / 予定 {bars.length} 件</span>
        {selectedBarIds.size > 0 && <span className="text-blue-600 font-semibold">{selectedBarIds.size} 件選択中</span>}
        {copiedBar && <span className="text-purple-600">📋 {copiedBar.process} コピー済み</span>}
        <span className="text-gray-400 ml-auto">右クリック: メニュー｜ドラッグ: 複数選択｜Shift/Ctrl: 追加選択</span>
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} type={contextMenu.type}
          hasClipboard={copiedBar !== null} isMultiSelect={multiSel} selectedCount={selectedBarIds.size}
          onNewSchedule={() => {
            if (contextMenu.type !== "cell") return
            setDialog({ mode: "new", deviceId: rowMetas[contextMenu.row]?.deviceId ?? DEVICES[0].id,
              startDate: colToDate(contextMenu.col), endDate: colToDate(contextMenu.col) })
          }}
          onPaste={() => { if (contextMenu.type === "cell") pasteBar(contextMenu.row, contextMenu.col) }}
          onDetail={() => { if (contextMenu.type === "bar") setTooltip({ barId, anchorX: contextMenu.x, anchorY: contextMenu.y }) }}
          onEdit={() => { if (contextMenu.type === "bar") setDialog({ mode: "edit", barId }) }}
          onCopy={() => { if (contextMenu.type === "bar") { const b = bars.find(b => b.id === barId); if (b) setCopiedBar(b) } }}
          onDelete={() => { if (contextMenu.type === "bar") deleteBar(barId) }}
          onDeleteSelected={deleteSelected}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 予定入力ダイアログ */}
      {dialog && init && (
        <ScheduleDialog
          mode={dialog.mode} initial={init} devices={DEVICES} assignees={ASSIGNEES}
          minDate={DATES[0]} maxDate={DATES[COLS-1]}
          onSave={data => dialog.mode === "new" ? addBar(data) : editBar(dialog.barId, data)}
          onClose={() => setDialog(null)}
        />
      )}

      {/* 吹き出し詳細 */}
      {tooltip && tipInfo && (
        <BarTooltip bar={tipInfo} anchorX={tooltip.anchorX} anchorY={tooltip.anchorY}
          onClose={() => setTooltip(null)} />
      )}
    </div>
  )
}
