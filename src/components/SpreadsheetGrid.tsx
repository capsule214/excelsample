"use client"

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { ContextMenu } from "./ContextMenu"
import { ScheduleDialog, type ProcessName, type DialogFormData } from "./ScheduleDialog"
import { BarTooltip, type TooltipBarInfo } from "./BarTooltip"

/* ─── 固定定数 ──────────────────────────────────────── */
const CELL_SIZE   = 20
const ROW_HDR_W   = 64
const HDR_H       = 20
const DATA_TOP    = HDR_H * 3
const MIN_ROWS    = 3
const BUFFER_ROWS = 12

/* ─── デフォルト値 ──────────────────────────────────── */
const DEFAULT_MONTHS = 4
const DEFAULT_COUNT  = 1000

/* ─── 日付ユーティリティ ─────────────────────────────── */
function toInputStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
function fromInputStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
function addMonths(base: Date, n: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + n)
  return d
}

/* ─── 日付生成 (開始日・月数指定) ─────────────────────── */
function generateDates(months: number, startDate: Date): Date[] {
  const base = new Date(startDate); base.setHours(0, 0, 0, 0)
  const end = addMonths(base, months)
  const totalDays = Math.round((end.getTime() - base.getTime()) / 86400000)
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i); return d
  })
}

/* ─── 固定データ ─────────────────────────────────────── */
const DEVICES   = Array.from({ length: 100 }, (_, i) => ({ id: `d${i+1}`, name: `装置${i+1}` }))
const ASSIGNEES = ["山田太郎", "鈴木花子", "田中一郎", "佐藤美咲", "高橋健太"]
const PROCESS_COLOR: Record<ProcessName, { bg: string; fg: string }> = {
  "工程A": { bg: "#3b82f6", fg: "#fff" }, "工程B": { bg: "#10b981", fg: "#fff" },
  "検査":  { bg: "#f59e0b", fg: "#fff" }, "出荷":  { bg: "#8b5cf6", fg: "#fff" },
}
const DEVICE_BG = ["#f8fafc","#f0f9ff","#fefce8","#fdf4ff","#f0fdf4",
                   "#fff7ed","#ecfdf5","#fef2f2","#f5f3ff","#f0fdfa"]

/* ─── 型 ────────────────────────────────────────────── */
interface BarDef {
  id: string; deviceId: string; process: ProcessName
  startDate: Date; endDate: Date; assignee: string
}
interface PlacedBar extends BarDef { absoluteRow: number }
/** 描画用: ビュー開始日基準の列位置を付加 */
interface RenderedBar extends PlacedBar { viewStartCol: number; viewEndCol: number }
interface RowMeta { groupId: string; groupIdx: number; groupName: string; isFirst: boolean; isLast: boolean }
interface DragSel { startRow: number; startCol: number; curRow: number; curCol: number; active: boolean }

type ContextMenuState =
  | { type: "cell"; x: number; y: number; row: number; col: number }
  | { type: "bar";  x: number; y: number; barId: string }
type DialogState =
  | { mode: "new";  deviceId: string; defaultAssignee?: string; startDate: Date; endDate: Date }
  | { mode: "edit"; barId: string }
interface TooltipState { barId: string; anchorX: number; anchorY: number }

/* ─── サンプルデータ生成 ─────────────────────────────── */
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296 }
}

function generateSampleBars(count: number, baseDate: Date, cols: number, seed = 42): BarDef[] {
  const procs: ProcessName[] = ["工程A", "工程B", "検査", "出荷"]
  const rand = makeLCG(seed)
  const base = new Date(baseDate); base.setHours(0, 0, 0, 0)
  const bars: BarDef[] = []
  let id = 0
  for (const dev of DEVICES) {
    let dayOffset = Math.floor(rand() * 10)
    for (let j = 0; j < 10; j++) {
      const proc = procs[j % 4]
      const len  = 3 + Math.floor(rand() * 12)
      const sc   = Math.min(dayOffset, cols - 2)
      const ec   = Math.min(sc + len,  cols - 1)
      const startDate = new Date(base); startDate.setDate(base.getDate() + sc)
      const endDate   = new Date(base); endDate.setDate(base.getDate() + ec)
      bars.push({ id: `s${++id}`, deviceId: dev.id, process: proc,
        startDate, endDate, assignee: ASSIGNEES[id % ASSIGNEES.length] })
      dayOffset = ec + 1 + Math.floor(rand() * 5)
      if (dayOffset >= cols) break
    }
  }
  return bars.slice(0, count)
}

interface GroupDef { id: string; name: string }

/* ─── レイアウト計算 (絶対日付で行割り当て → ビュー非依存) ── */
function computeLayout(
  bars: BarDef[],
  groups: GroupDef[],
  getGroupId: (bar: BarDef) => string,
): { placedBars: PlacedBar[]; rowMetas: RowMeta[]; totalRows: number } {
  const placedBars: PlacedBar[] = []
  const rowMetas: RowMeta[] = []
  let currentRow = 0
  for (const [gi, group] of groups.entries()) {
    const gBars = bars
      .filter(b => getGroupId(b) === group.id)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    const subRowEnds: number[] = []
    for (const bar of gBars) {
      let sub = subRowEnds.findIndex(e => e < bar.startDate.getTime())
      if (sub === -1) { sub = subRowEnds.length; subRowEnds.push(-Infinity) }
      subRowEnds[sub] = bar.endDate.getTime()
      placedBars.push({ ...bar, absoluteRow: currentRow + sub })
    }
    const rowCount = Math.max(MIN_ROWS, subRowEnds.length)
    for (let i = 0; i < rowCount; i++)
      rowMetas.push({ groupId: group.id, groupIdx: gi, groupName: group.name,
        isFirst: i === 0, isLast: i === rowCount - 1 })
    currentRow += rowCount
  }
  return { placedBars, rowMetas, totalRows: currentRow }
}

/* ─── コンポーネント ──────────────────────────────────── */
interface SpreadsheetGridProps { mode: "device" | "assignee" }

export default function SpreadsheetGrid({ mode }: SpreadsheetGridProps) {
  /* ── ツールバー入力値 (フォーム用) ── */
  const [inputMonths,    setInputMonths   ] = useState(DEFAULT_MONTHS)
  const [inputCount,     setInputCount    ] = useState(DEFAULT_COUNT)
  const [inputStartDate, setInputStartDate] = useState<string>(() => toInputStr(new Date()))

  /* ── 適用済み値 (実際の描画に使用) ── */
  const [appliedMonths,    setAppliedMonths   ] = useState(DEFAULT_MONTHS)
  const [appliedStartDate, setAppliedStartDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })

  /* ── 日付・列数 (適用月数・開始日から導出) ── */
  const dates = useMemo(() => generateDates(appliedMonths, appliedStartDate), [appliedMonths, appliedStartDate])
  const cols  = dates.length
  const weekendCols = useMemo(
    () => new Set(dates.map((d, i) => (d.getDay() === 0 || d.getDay() === 6) ? i : -1).filter(i => i >= 0)),
    [dates]
  )

  /* ── 日付 ↔ 列変換 ── */
  const colToDate = useCallback((col: number): Date => dates[Math.max(0, Math.min(cols - 1, col))], [dates, cols])
  /** バーの絶対日付 → ビュー列位置 (クランプあり) */
  const barToViewCols = useCallback((bar: BarDef) => {
    const viewStartMs = dates[0].getTime()
    const sc = Math.round((bar.startDate.getTime() - viewStartMs) / 86400000)
    const ec = Math.round((bar.endDate.getTime()   - viewStartMs) / 86400000)
    return { sc, ec }
  }, [dates])

  /* ── DOM refs (直接操作 → 再レンダリングなし) ── */
  const containerRef    = useRef<HTMLDivElement>(null)
  const selCellRef      = useRef<HTMLDivElement>(null)
  const dragRectRef     = useRef<HTMLDivElement>(null)
  const dragSelRef      = useRef<DragSel | null>(null)
  const selectedCellRef = useRef<{ row: number; col: number } | null>(null)
  const rectCacheRef    = useRef<DOMRect | null>(null)

  /* ── グループ定義 (mode に応じて切り替え) ── */
  const groups     = useMemo<GroupDef[]>(
    () => mode === "device" ? DEVICES : ASSIGNEES.map(name => ({ id: name, name })),
    [mode]
  )
  const getGroupId = useCallback(
    (bar: BarDef) => mode === "device" ? bar.deviceId : bar.assignee,
    [mode]
  )
  const seed = mode === "device" ? 42 : 99

  /* ── React state ── */
  const [bars,           setBars          ] = useState<BarDef[]>(() => { const d = new Date(); d.setHours(0,0,0,0); return generateSampleBars(DEFAULT_COUNT, d, generateDates(DEFAULT_MONTHS, d).length, seed) })
  const [selectedBarIds, setSelectedBarIds] = useState<Set<string>>(new Set())
  const [copiedBars,     setCopiedBars    ] = useState<BarDef[]>([])
  const [contextMenu,    setContextMenu   ] = useState<ContextMenuState | null>(null)
  const [dialog,         setDialog        ] = useState<DialogState | null>(null)
  const [tooltip,        setTooltip       ] = useState<TooltipState | null>(null)
  const [visibleRows,    setVisibleRows   ] = useState({ start: 0, end: 79 })

  /* ── 適用ボタン: バー再生成 + ビュー更新 ── */
  const handleApply = () => {
    const months = Math.max(1, Math.min(24, inputMonths))
    const count  = Math.max(0, Math.min(5000, inputCount))
    setInputMonths(months)
    setInputCount(count)
    setAppliedMonths(months)

    let startDate = appliedStartDate
    try {
      const parsed = fromInputStr(inputStartDate)
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0)
        startDate = parsed
        setAppliedStartDate(parsed)
      }
    } catch { /* 不正な日付は無視 */ }

    // バーを明示的に再生成 (開始日・月数・件数すべて確定後)
    const newCols = generateDates(months, startDate).length
    setBars(generateSampleBars(count, startDate, newCols, seed))
    setSelectedBarIds(new Set())
    setCopiedBars([])
  }

  /* ── 開始日を n ヶ月シフト (ナビゲーションボタン) ── */
  /* バーは再生成しない。visibleBars が新しい dates[0] 基準で列位置を再計算する */
  const shiftStartDate = (n: number) => {
    setAppliedStartDate(prev => {
      const next = addMonths(prev, n)
      setInputStartDate(toInputStr(next))
      return next
    })
  }

  const { placedBars, rowMetas, totalRows } = useMemo(
    () => computeLayout(bars, groups, getGroupId),
    [bars, groups, getGroupId]
  )

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
    if (col < 0 || col >= cols || row < 0 || row >= totalRows) return null
    return { row, col }
  }

  const showSelCell = (row: number, col: number) => {
    selectedCellRef.current = { row, col }
    const el = selCellRef.current; if (!el) return
    el.style.display = "block"
    el.style.left    = `${ROW_HDR_W + col * CELL_SIZE}px`
    el.style.top     = `${DATA_TOP  + row * CELL_SIZE}px`
    el.style.width   = `${CELL_SIZE}px`
    el.style.height  = `${CELL_SIZE}px`
  }
  const hideSelCell = () => {
    selectedCellRef.current = null
    const el = selCellRef.current; if (el) el.style.display = "none"
  }

  const updateDragRect = (drag: DragSel | null) => {
    const el = dragRectRef.current; if (!el) return
    if (!drag?.active) { el.style.display = "none"; return }
    const r0 = Math.min(drag.startRow, drag.curRow), r1 = Math.max(drag.startRow, drag.curRow)
    const c0 = Math.min(drag.startCol, drag.curCol), c1 = Math.max(drag.startCol, drag.curCol)
    el.style.display = "block"
    el.style.left    = `${ROW_HDR_W + c0 * CELL_SIZE}px`
    el.style.top     = `${DATA_TOP  + r0 * CELL_SIZE}px`
    el.style.width   = `${(c1 - c0 + 1) * CELL_SIZE}px`
    el.style.height  = `${(r1 - r0 + 1) * CELL_SIZE}px`
  }

  /* ── スクロール ── */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget
    rectCacheRef.current = null
    const dataTop = Math.max(0, scrollTop - DATA_TOP)
    const start = Math.max(0, Math.floor(dataTop / CELL_SIZE) - BUFFER_ROWS)
    const end   = Math.min(totalRows - 1, Math.ceil((dataTop + clientHeight) / CELL_SIZE) + BUFFER_ROWS)
    setVisibleRows(prev => (prev.start === start && prev.end === end) ? prev : { start, end })
  }

  /* ── ポインタハンドラ ── */
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
    updateDragRect(drag)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const drag = dragSelRef.current; dragSelRef.current = null
    updateDragRect(null)
    if (!drag) return
    if (drag.active) {
      const r0 = Math.min(drag.startRow, drag.curRow), r1 = Math.max(drag.startRow, drag.curRow)
      const c0 = Math.min(drag.startCol, drag.curCol), c1 = Math.max(drag.startCol, drag.curCol)
      const ids = new Set(placedBars.filter(b => {
        const { sc, ec } = barToViewCols(b)
        return b.absoluteRow >= r0 && b.absoluteRow <= r1 && sc <= c1 && ec >= c0
      }).map(b => b.id))
      setSelectedBarIds(ids)
      hideSelCell()
    } else {
      showSelCell(drag.startRow, drag.startCol)
      setSelectedBarIds(prev => prev.size > 0 ? new Set() : prev)
    }
  }

  /* ── コンテキストメニュー ── */
  const handleContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    setTooltip(null)
    setContextMenu({ type: "cell", x: e.clientX, y: e.clientY, row: pos.row, col: pos.col })
  }

  /* ── バー操作 ── */
  const addBar = (data: DialogFormData) => {
    setBars(prev => [...prev, { id: crypto.randomUUID(), deviceId: data.deviceId,
      process: data.process, startDate: data.startDate, endDate: data.endDate, assignee: data.assignee }])
    setDialog(null)
  }
  const editBar = (barId: string, data: DialogFormData) => {
    setBars(prev => prev.map(b => b.id === barId
      ? { ...b, deviceId: data.deviceId, process: data.process,
          startDate: data.startDate, endDate: data.endDate, assignee: data.assignee }
      : b))
    setDialog(null)
  }
  const deleteBar = (id: string) => {
    setBars(prev => prev.filter(b => b.id !== id))
    setSelectedBarIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }
  const deleteSelected = () => { setBars(prev => prev.filter(b => !selectedBarIds.has(b.id))); setSelectedBarIds(new Set()) }
  const pasteBar = (row: number, col: number) => {
    if (copiedBars.length === 0) return
    const anchorMs = Math.min(...copiedBars.map(b => b.startDate.getTime()))
    const offsetMs = colToDate(col).getTime() - anchorMs
    const targetGroupId = rowMetas[row]?.groupId
    setBars(prev => [
      ...prev,
      ...copiedBars.map(b => ({
        id:        crypto.randomUUID(),
        deviceId:  mode === "device"   ? (targetGroupId ?? DEVICES[0].id)   : b.deviceId,
        assignee:  mode === "assignee" ? (targetGroupId ?? ASSIGNEES[0])    : b.assignee,
        process:   b.process,
        startDate: new Date(b.startDate.getTime() + offsetMs),
        endDate:   new Date(b.endDate.getTime()   + offsetMs),
      })),
    ])
    setContextMenu(null)
  }

  /* ── ダイアログ初期値 ── */
  const dialogInitial = (): DialogFormData | null => {
    if (!dialog) return null
    if (dialog.mode === "new") return { deviceId: dialog.deviceId, process: "工程A",
      startDate: dialog.startDate, endDate: dialog.endDate,
      assignee: dialog.defaultAssignee ?? ASSIGNEES[0] }
    const bar = bars.find(b => b.id === dialog.barId); if (!bar) return null
    return { deviceId: bar.deviceId, process: bar.process,
      startDate: bar.startDate, endDate: bar.endDate, assignee: bar.assignee }
  }
  const tooltipInfo = (): TooltipBarInfo | null => {
    if (!tooltip) return null
    const bar = bars.find(b => b.id === tooltip.barId)
    const dev = DEVICES.find(d => d.id === bar?.deviceId)
    if (!bar || !dev) return null
    return { process: bar.process, deviceName: dev.name, assignee: bar.assignee,
      startDate: bar.startDate, endDate: bar.endDate,
      days: Math.round((bar.endDate.getTime() - bar.startDate.getTime()) / 86400000) + 1 }
  }

  /* ── 可視バー: 行範囲 AND 日付範囲でフィルタ、ビュー列位置を付加 ── */
  const visibleBars = useMemo((): RenderedBar[] => {
    const viewStartMs = dates[0].getTime()
    const viewEndMs   = dates[cols - 1].getTime()
    return placedBars
      .filter(b =>
        b.absoluteRow >= visibleRows.start && b.absoluteRow <= visibleRows.end &&
        b.endDate.getTime() >= viewStartMs && b.startDate.getTime() <= viewEndMs
      )
      .map(b => ({
        ...b,
        viewStartCol: Math.max(0,      Math.round((b.startDate.getTime() - viewStartMs) / 86400000)),
        viewEndCol:   Math.min(cols-1, Math.round((b.endDate.getTime()   - viewStartMs) / 86400000)),
      }))
  }, [placedBars, visibleRows, dates, cols])

  /* ── スタイルヘルパー ── */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE, height: HDR_H, position: "sticky", top: topPx, zIndex: 20,
    borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db",
    backgroundColor: weekendCols.has(col) ? "#fff1f2" : "#f3f4f6",
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-white select-none">

      {/* ツールバー */}
      <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 shrink-0 gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">スケジュール管理</span>

        {/* 表示開始日ナビゲーション */}
        <div className="flex items-center gap-1 border-l border-gray-300 pl-3">
          <label className="text-xs text-gray-600 whitespace-nowrap mr-1">表示開始日</label>
          <button
            onClick={() => shiftStartDate(-2)}
            title="2ヶ月前へ"
            className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors font-medium"
          >
            ≪ 2M
          </button>
          <button
            onClick={() => shiftStartDate(-1)}
            title="1ヶ月前へ"
            className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors font-medium"
          >
            ‹ 1M
          </button>
          <input
            type="date"
            value={inputStartDate}
            onChange={e => setInputStartDate(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={() => shiftStartDate(1)}
            title="1ヶ月後へ"
            className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors font-medium"
          >
            1M ›
          </button>
          <button
            onClick={() => shiftStartDate(2)}
            title="2ヶ月後へ"
            className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors font-medium"
          >
            2M ≫
          </button>
        </div>

        {/* 表示月数・予定数 */}
        <div className="flex items-center gap-2 border-l border-gray-300 pl-3">
          <label className="text-xs text-gray-600 whitespace-nowrap">表示月数</label>
          <input
            type="number" min={1} max={24} value={inputMonths}
            onChange={e => setInputMonths(Number(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="w-14 px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <label className="text-xs text-gray-600 whitespace-nowrap ml-2">予定の数</label>
          <input
            type="number" min={0} max={5000} step={100} value={inputCount}
            onChange={e => setInputCount(Number(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="w-20 px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleApply}
            className="px-3 py-0.5 text-xs bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded font-medium transition-colors"
          >
            適用
          </button>
        </div>

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
            gridTemplateColumns: `${ROW_HDR_W}px repeat(${cols}, ${CELL_SIZE}px)`,
            width: ROW_HDR_W + CELL_SIZE * cols,
            position: "relative",
          }}
        >
          {/* ━━━ 年ヘッダー ━━━ */}
          <div style={cornerStyle(0)} />
          {dates.map((date, col) => {
            const show = col === 0 || dates[col-1].getFullYear() !== date.getFullYear()
            return (
              <div key={`y${col}`} style={colHdrStyle(col, 0)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-bold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getFullYear()}</span>}
              </div>
            )
          })}

          {/* ━━━ 月ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {dates.map((date, col) => {
            const show = col === 0 || dates[col-1].getMonth() !== date.getMonth()
            return (
              <div key={`m${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date.getMonth()+1}月</span>}
              </div>
            )
          })}

          {/* ━━━ 日ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H*2)} />
          {dates.map((date, col) => (
            <div key={`d${col}`} style={colHdrStyle(col, HDR_H*2)} className="flex items-center justify-center">
              <span className={`text-[9px] font-medium ${weekendCols.has(col) ? "text-red-500 font-bold" : "text-gray-600"}`}>{date.getDate()}</span>
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
            const bg   = DEVICE_BG[meta.groupIdx % DEVICE_BG.length]
            const bbW  = meta.isLast  ? "2px" : "1px"
            const bbC  = meta.isLast  ? "#94a3b8" : "#e5e7eb"
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
                  {meta.isFirst && <span className="text-[10px] font-semibold text-gray-700 whitespace-nowrap">{meta.groupName}</span>}
                </div>

                {/* データセル */}
                {dates.map((_, col) => (
                  <div
                    key={`${row},${col}`}
                    style={{
                      width: CELL_SIZE, height: CELL_SIZE,
                      backgroundColor: weekendCols.has(col) ? "#fff1f2" : bg,
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
                  left:   ROW_HDR_W + bar.viewStartCol * CELL_SIZE,
                  top:    DATA_TOP  + bar.absoluteRow * CELL_SIZE + 1,
                  width:  (bar.viewEndCol - bar.viewStartCol + 1) * CELL_SIZE,
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
        <span>{DEVICES.length} 装置 / {totalRows} 行 × {cols} 列 / 予定 {bars.length} 件</span>
        {selectedBarIds.size > 0 && <span className="text-blue-600 font-semibold">{selectedBarIds.size} 件選択中</span>}
        {copiedBars.length > 0 && <span className="text-purple-600">📋 {copiedBars.length} 件コピー済み</span>}
        <span className="text-gray-400 ml-auto">右クリック: メニュー｜ドラッグ: 複数選択｜Shift/Ctrl: 追加選択</span>
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} type={contextMenu.type}
          clipboardCount={copiedBars.length} isMultiSelect={multiSel} selectedCount={selectedBarIds.size}
          onNewSchedule={() => {
            if (contextMenu.type !== "cell") return
            const meta = rowMetas[contextMenu.row]
            setDialog({
              mode: "new",
              deviceId:        mode === "device"   ? (meta?.groupId ?? DEVICES[0].id)   : DEVICES[0].id,
              defaultAssignee: mode === "assignee" ? (meta?.groupId ?? ASSIGNEES[0])    : undefined,
              startDate: colToDate(contextMenu.col), endDate: colToDate(contextMenu.col),
            })
          }}
          onPaste={() => { if (contextMenu.type === "cell") pasteBar(contextMenu.row, contextMenu.col) }}
          onDetail={() => { if (contextMenu.type === "bar") setTooltip({ barId, anchorX: contextMenu.x, anchorY: contextMenu.y }) }}
          onEdit={() => { if (contextMenu.type === "bar") setDialog({ mode: "edit", barId }) }}
          onCopy={() => {
            if (contextMenu.type === "bar") {
              const b = bars.find(b => b.id === barId)
              if (b) setCopiedBars([b])
            }
          }}
          onCopySelected={() => {
            const selected = bars.filter(b => selectedBarIds.has(b.id))
            if (selected.length > 0) setCopiedBars(selected)
          }}
          onDelete={() => { if (contextMenu.type === "bar") deleteBar(barId) }}
          onDeleteSelected={deleteSelected}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 予定入力ダイアログ */}
      {dialog && init && (
        <ScheduleDialog
          mode={dialog.mode} initial={init} devices={DEVICES} assignees={ASSIGNEES}
          minDate={dates[0]} maxDate={dates[cols-1]}
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
