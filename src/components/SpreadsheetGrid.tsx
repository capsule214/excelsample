"use client"

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { ContextMenu } from "./ContextMenu"
import { ScheduleDialog, type DialogFormData, type DeviceInfo, type TaskInfo, type AssigneeInfo } from "./ScheduleDialog"
import { BarTooltip, type TooltipBarInfo } from "./BarTooltip"

/* ─── 固定定数 ──────────────────────────────────────── */
const CELL_SIZE   = 20
const HDR_H       = 20
const MIN_ROWS    = 3
const BUFFER_ROWS = 12
const DEV_HDR_W1  = 130
const DEV_HDR_W2  = 72
const DEV_HDR_W   = DEV_HDR_W1 + DEV_HDR_W2
const ASGN_HDR_W  = 80

const SLOT_ABBREV = ["前1", "前2", "後1", "後2", "残1", "残2"] as const
const SLOT_COUNT  = 6

const DEFAULT_MONTHS = 4
const DEFAULT_COUNT  = 1000
const DEVICE_BG      = ["#f8fafc","#f0f9ff","#fefce8","#fdf4ff","#f0fdf4",
                        "#fff7ed","#ecfdf5","#fef2f2","#f5f3ff","#f0fdfa"]

/* ─── 時間→スロット変換 ─────────────────────────────── */
function startHourToSlot(h: number): number {
  if (h === 0) return 0   // 時間なし = 日の先頭
  if (h < 10)  return 0
  if (h < 13)  return 1
  if (h < 15)  return 2
  if (h < 17)  return 3
  if (h < 19)  return 4
  return 5
}

function endHourToSlot(h: number): number {
  if (h === 0)  return 5   // 時間なし = 日の末尾
  if (h <= 10)  return 0
  if (h <= 12)  return 1
  if (h <= 15)  return 2
  if (h <= 17)  return 3
  if (h <= 19)  return 4
  return 5
}

/* ─── 日付ユーティリティ ─────────────────────────────── */
function toInputStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
function fromInputStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number); return new Date(y, m-1, d)
}
function addMonths(base: Date, n: number): Date {
  const d = new Date(base); d.setMonth(d.getMonth() + n); return d
}
function generateDates(months: number, startDate: Date): Date[] {
  const base = new Date(startDate); base.setHours(0,0,0,0)
  const end  = addMonths(base, months)
  const days = Math.round((end.getTime() - base.getTime()) / 86400000)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i); return d
  })
}
function toIso(d: Date) { return d.toISOString().slice(0, 10) }
function toIsoDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/* ─── 型 ────────────────────────────────────────────── */
interface BarDef {
  id: string; deviceId: string
  taskId: string; process: string
  colorBg: string; colorFg: string
  startDate: Date; endDate: Date
  assigneeId: string; assignee: string
}
interface PlacedBar   extends BarDef { absoluteRow: number }
interface RenderedBar extends PlacedBar { viewStartCol: number; viewEndCol: number }
interface RowMeta { groupId: string; groupIdx: number; groupName: string; isFirst: boolean; isLast: boolean }
interface DragSel { startRow: number; startCol: number; curRow: number; curCol: number; active: boolean }

type ContextMenuState =
  | { type: "cell"; x: number; y: number; row: number; col: number }
  | { type: "bar";  x: number; y: number; barId: string }
type DialogState =
  | { mode: "new";  deviceId: string; defaultAssigneeId?: string; startDate: Date; endDate: Date }
  | { mode: "edit"; barId: string }
interface TooltipState { barId: string; anchorX: number; anchorY: number }
interface GroupDef { id: string; name: string }

/* ─── API ヘルパー ───────────────────────────────────── */
type ApiBar = {
  id: string; deviceId: string; taskId: string; taskName: string
  colorBg: string; colorFg: string; startDate: string; endDate: string
  assigneeId: string; assigneeName: string
}
function parseApiDate(s: string): Date {
  // "YYYY-MM-DDTHH:MM:SS" → local time / "YYYY-MM-DD" → local midnight
  return s.includes("T") ? new Date(s) : new Date(s + "T00:00:00")
}
function apiBarToBarDef(b: ApiBar): BarDef {
  return {
    id: b.id, deviceId: b.deviceId,
    taskId: b.taskId, process: b.taskName,
    colorBg: b.colorBg, colorFg: b.colorFg,
    startDate: parseApiDate(b.startDate),
    endDate:   parseApiDate(b.endDate),
    assigneeId: b.assigneeId, assignee: b.assigneeName,
  }
}

/* ─── レイアウト計算 ─────────────────────────────────── */
function computeLayout(
  bars: BarDef[], groups: GroupDef[], getGroupId: (b: BarDef) => string,
): { placedBars: PlacedBar[]; rowMetas: RowMeta[]; totalRows: number } {
  const placedBars: PlacedBar[] = []
  const rowMetas:   RowMeta[]   = []
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

/* ─── スケルトン ─────────────────────────────────────── */
interface SkeletonProps { ROW_HDR_W: number; tasks: TaskInfo[] }
function SkeletonGrid({ ROW_HDR_W, tasks }: SkeletonProps) {
  const BAR_COLORS = tasks.length > 0
    ? tasks.map(t => t.colorBg + "60")
    : ["#bfdbfe","#a7f3d0","#fde68a","#ddd6fe"]
  const LEFTS  = [8,28,48,15,35,55,5,42,22,62,18,38,52,10,30,45,20,65,25,50]
  const WIDTHS = [18,14,22,16,20,12,24,15,19,11,17,21,13,23,16,18,20,14,22,15]

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white animate-pulse select-none">
      <div className="shrink-0 flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 gap-3">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-5 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-14 bg-blue-200 rounded" />
        <div className="ml-auto flex gap-2">
          {BAR_COLORS.slice(0,4).map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
              <div className="h-3 w-8 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="shrink-0 flex border-b border-gray-200" style={{ height: HDR_H * 3 }}>
          <div className="shrink-0 bg-gray-200" style={{ width: ROW_HDR_W }} />
          <div className="flex-1 bg-gray-100" />
        </div>
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="flex border-b border-gray-100" style={{ height: CELL_SIZE }}>
              <div className="shrink-0 border-r border-gray-200 bg-gray-50 flex items-center pl-2" style={{ width: ROW_HDR_W }}>
                {i % 3 === 0 && <div className="h-2.5 bg-gray-200 rounded" style={{ width: ROW_HDR_W * 0.7 }} />}
              </div>
              <div className="flex-1 relative bg-white">
                <div className="absolute inset-y-0.5 rounded" style={{
                  left:  `${LEFTS[i % LEFTS.length]}%`,
                  width: `${WIDTHS[i % WIDTHS.length]}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300">
        <div className="h-3 w-40 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

/* ─── コンポーネント Props ───────────────────────────── */
interface SpreadsheetGridProps {
  mode:            "device" | "assignee"
  devices:         DeviceInfo[]
  assignees:       AssigneeInfo[]
  tasks:           TaskInfo[]
  visibleGroupIds?: string[]
}

export default function SpreadsheetGrid({ mode, devices, assignees, tasks, visibleGroupIds }: SpreadsheetGridProps) {
  const ROW_HDR_W = mode === "device" ? DEV_HDR_W : ASGN_HDR_W

  const [loading,   setLoading  ] = useState(true)
  const [bars,      setBars     ] = useState<BarDef[]>([])
  const [seeding,   setSeeding  ] = useState(false)
  const [viewMode,  setViewMode ] = useState<"day" | "slot">("day")

  useEffect(() => {
    fetch("/api/schedules").then(r => r.json()).then((scheds: ApiBar[]) => {
      setBars(scheds.map(apiBarToBarDef))
      setLoading(false)
    })
  }, [])

  /* ── ツールバー入力値 ── */
  const [inputMonths,    setInputMonths   ] = useState(DEFAULT_MONTHS)
  const [inputCount,     setInputCount    ] = useState(DEFAULT_COUNT)
  const [inputStartDate, setInputStartDate] = useState<string>(() => toInputStr(new Date()))

  /* ── 適用済みビュー値 ── */
  const [appliedMonths,    setAppliedMonths   ] = useState(DEFAULT_MONTHS)
  const [appliedStartDate, setAppliedStartDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d
  })

  /* ── 日付・列数 ── */
  const dates = useMemo(() => generateDates(appliedMonths, appliedStartDate), [appliedMonths, appliedStartDate])

  /* ── ビューモード依存の定数 ── */
  const dataTop  = viewMode === "slot" ? HDR_H * 4 : HDR_H * 3
  const totalCols = viewMode === "slot" ? dates.length * SLOT_COUNT : dates.length

  const weekendCols = useMemo(() => {
    const s = new Set<number>()
    dates.forEach((d, i) => {
      if (d.getDay() === 0 || d.getDay() === 6) {
        if (viewMode === "day") {
          s.add(i)
        } else {
          for (let k = 0; k < SLOT_COUNT; k++) s.add(i * SLOT_COUNT + k)
        }
      }
    })
    return s
  }, [dates, viewMode])

  /* ── 日付↔列変換 ── */
  const colToDate = useCallback((col: number): Date => {
    if (viewMode === "day") {
      return dates[Math.max(0, Math.min(dates.length - 1, col))]
    }
    const dayIdx  = Math.max(0, Math.min(dates.length - 1, Math.floor(col / SLOT_COUNT)))
    const slotIdx = col % SLOT_COUNT
    const d = new Date(dates[dayIdx])
    const startHours = [8, 10, 13, 15, 17, 19]
    d.setHours(startHours[slotIdx] ?? 8, 0, 0, 0)
    return d
  }, [dates, viewMode])

  const colToEndDate = useCallback((col: number): Date => {
    if (viewMode === "day") {
      return dates[Math.max(0, Math.min(dates.length - 1, col))]
    }
    const dayIdx  = Math.max(0, Math.min(dates.length - 1, Math.floor(col / SLOT_COUNT)))
    const slotIdx = col % SLOT_COUNT
    const d = new Date(dates[dayIdx])
    const endHours = [10, 12, 15, 17, 19, 21]
    d.setHours(endHours[slotIdx] ?? 10, 0, 0, 0)
    return d
  }, [dates, viewMode])

  const barToViewCols = useCallback((bar: BarDef) => {
    const vm = dates[0].getTime()
    if (viewMode === "day") {
      return {
        sc: Math.floor((bar.startDate.getTime() - vm) / 86400000),
        ec: Math.floor((bar.endDate.getTime()   - vm) / 86400000),
      }
    }
    const startDay  = Math.floor((bar.startDate.getTime() - vm) / 86400000)
    const endDay    = Math.floor((bar.endDate.getTime()   - vm) / 86400000)
    const startSlot = startHourToSlot(bar.startDate.getHours())
    const endSlot   = endHourToSlot(bar.endDate.getHours())
    return {
      sc: startDay * SLOT_COUNT + startSlot,
      ec: endDay   * SLOT_COUNT + endSlot,
    }
  }, [dates, viewMode])

  /* ── DOM refs ── */
  const containerRef    = useRef<HTMLDivElement>(null)
  const selCellRef      = useRef<HTMLDivElement>(null)
  const dragRectRef     = useRef<HTMLDivElement>(null)
  const dragSelRef      = useRef<DragSel | null>(null)
  const selectedCellRef = useRef<{ row: number; col: number } | null>(null)
  const rectCacheRef    = useRef<DOMRect | null>(null)

  /* ── React state ── */
  const [selectedBarIds, setSelectedBarIds] = useState<Set<string>>(new Set())
  const [copiedBars,     setCopiedBars    ] = useState<BarDef[]>([])
  const [contextMenu,    setContextMenu   ] = useState<ContextMenuState | null>(null)
  const [dialog,         setDialog        ] = useState<DialogState | null>(null)
  const [tooltip,        setTooltip       ] = useState<TooltipState | null>(null)
  const [visibleRows,    setVisibleRows   ] = useState({ start: 0, end: 79 })

  const taskColorMap = useMemo(() => {
    const m: Record<string, { bg: string; fg: string }> = {}
    for (const t of tasks) m[t.id] = { bg: t.colorBg, fg: t.colorFg }
    return m
  }, [tasks])

  const groups = useMemo<GroupDef[]>(() => {
    const all: GroupDef[] = mode === "device"
      ? devices.map(d => ({ id: d.id, name: `${d.modelName} / ${d.serialNumber}` }))
      : assignees.map(a => ({ id: a.id, name: a.name }))
    if (!visibleGroupIds) return all
    const vis = new Set(visibleGroupIds)
    return all.filter(g => vis.has(g.id))
  }, [mode, devices, assignees, visibleGroupIds])

  const getGroupId = useCallback(
    (bar: BarDef) => mode === "device" ? bar.deviceId : bar.assigneeId,
    [mode]
  )

  const { placedBars, rowMetas, totalRows } = useMemo(
    () => computeLayout(bars, groups, getGroupId),
    [bars, groups, getGroupId]
  )

  useEffect(() => {
    setVisibleRows(prev => ({ start: prev.start, end: Math.min(totalRows - 1, prev.end) }))
  }, [totalRows])

  /* ── 適用ボタン ── */
  const handleApply = async () => {
    const months = Math.max(1, Math.min(24, inputMonths))
    const count  = Math.max(0, Math.min(5000, inputCount))
    setInputMonths(months); setInputCount(count); setAppliedMonths(months)

    let startDate = appliedStartDate
    try {
      const parsed = fromInputStr(inputStartDate)
      if (!isNaN(parsed.getTime())) { parsed.setHours(0,0,0,0); startDate = parsed; setAppliedStartDate(parsed) }
    } catch { /* ignore */ }

    setSeeding(true)
    await fetch("/api/seed", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, baseDate: toIso(startDate), months }),
    })
    const scheds: ApiBar[] = await fetch("/api/schedules").then(r => r.json())
    setBars(scheds.map(apiBarToBarDef))
    setSelectedBarIds(new Set()); setCopiedBars([])
    setSeeding(false)
  }

  const shiftStartDate = (n: number) => {
    setAppliedStartDate(prev => {
      const next = addMonths(prev, n)
      setInputStartDate(toInputStr(next))
      return next
    })
  }

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
    if (relX < ROW_HDR_W || relY < dataTop) return null
    const col = Math.floor((relX + c.scrollLeft - ROW_HDR_W) / CELL_SIZE)
    const row = Math.floor((relY + c.scrollTop  - dataTop ) / CELL_SIZE)
    if (col < 0 || col >= totalCols || row < 0 || row >= totalRows) return null
    return { row, col }
  }

  const showSelCell = (row: number, col: number) => {
    selectedCellRef.current = { row, col }
    const el = selCellRef.current; if (!el) return
    el.style.display = "block"
    el.style.left   = `${ROW_HDR_W + col * CELL_SIZE}px`
    el.style.top    = `${dataTop   + row * CELL_SIZE}px`
    el.style.width  = `${CELL_SIZE}px`
    el.style.height = `${CELL_SIZE}px`
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
    el.style.left   = `${ROW_HDR_W + c0 * CELL_SIZE}px`
    el.style.top    = `${dataTop   + r0 * CELL_SIZE}px`
    el.style.width  = `${(c1 - c0 + 1) * CELL_SIZE}px`
    el.style.height = `${(r1 - r0 + 1) * CELL_SIZE}px`
  }

  /* ── スクロール ── */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight } = e.currentTarget
    rectCacheRef.current = null
    const scrolledPast = Math.max(0, scrollTop - dataTop)
    const start = Math.max(0, Math.floor(scrolledPast / CELL_SIZE) - BUFFER_ROWS)
    const end   = Math.min(totalRows - 1, Math.ceil((scrolledPast + clientHeight) / CELL_SIZE) + BUFFER_ROWS)
    setVisibleRows(prev => (prev.start === start && prev.end === end) ? prev : { start, end })
  }

  /* ── ポインタ ── */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragSelRef.current = { startRow: pos.row, startCol: pos.col, curRow: pos.row, curCol: pos.col, active: false }
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
      setSelectedBarIds(ids); hideSelCell()
    } else {
      showSelCell(drag.startRow, drag.startCol)
      setSelectedBarIds(prev => prev.size > 0 ? new Set() : prev)
    }
  }

  const handleContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pos = getGridPos(e.clientX, e.clientY); if (!pos) return
    setTooltip(null)
    setContextMenu({ type: "cell", x: e.clientX, y: e.clientY, row: pos.row, col: pos.col })
  }

  /* ── バー CRUD ── */
  const addBar = async (data: DialogFormData) => {
    const body = {
      deviceId: data.deviceId, taskId: data.taskId, assigneeId: data.assigneeId,
      startDate: toIsoDateTime(data.startDate), endDate: toIsoDateTime(data.endDate),
    }
    const created: ApiBar = await fetch("/api/schedules", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json())
    setBars(prev => [...prev, apiBarToBarDef(created)])
    setDialog(null)
  }

  const editBar = async (barId: string, data: DialogFormData) => {
    const body = {
      deviceId: data.deviceId, taskId: data.taskId, assigneeId: data.assigneeId,
      startDate: toIsoDateTime(data.startDate), endDate: toIsoDateTime(data.endDate),
    }
    const updated: ApiBar = await fetch(`/api/schedules/${barId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json())
    setBars(prev => prev.map(b => b.id === barId ? apiBarToBarDef(updated) : b))
    setDialog(null)
  }

  const deleteBar = async (id: string) => {
    await fetch(`/api/schedules/${id}`, { method: "DELETE" })
    setBars(prev => prev.filter(b => b.id !== id))
    setSelectedBarIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const deleteSelected = async () => {
    const ids = [...selectedBarIds]
    await fetch("/api/schedules", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    })
    setBars(prev => prev.filter(b => !selectedBarIds.has(b.id)))
    setSelectedBarIds(new Set())
  }

  const pasteBar = async (row: number, col: number) => {
    if (copiedBars.length === 0) return
    const anchorMs    = Math.min(...copiedBars.map(b => b.startDate.getTime()))
    const offsetMs    = colToDate(col).getTime() - anchorMs
    const targetGroup = rowMetas[row]?.groupId

    const bodies = copiedBars.map(b => ({
      deviceId:   mode === "device"   ? (targetGroup ?? b.deviceId)   : b.deviceId,
      assigneeId: mode === "assignee" ? (targetGroup ?? b.assigneeId) : b.assigneeId,
      taskId:     b.taskId,
      startDate: toIsoDateTime(new Date(b.startDate.getTime() + offsetMs)),
      endDate:   toIsoDateTime(new Date(b.endDate.getTime()   + offsetMs)),
    }))

    const created: ApiBar[] = await Promise.all(
      bodies.map(body => fetch("/api/schedules", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then(r => r.json()))
    )
    setBars(prev => [...prev, ...created.map(apiBarToBarDef)])
    setContextMenu(null)
  }

  /* ── ダイアログ初期値 ── */
  const dialogInitial = (): DialogFormData | null => {
    if (!dialog) return null
    if (dialog.mode === "new") {
      const firstTask = tasks[0] ?? { id: "", name: "" }
      return {
        deviceId: dialog.deviceId, taskId: firstTask.id, taskName: firstTask.name,
        startDate: dialog.startDate, endDate: dialog.endDate,
        assigneeId: dialog.defaultAssigneeId ?? assignees[0]?.id ?? "",
        assigneeName: assignees.find(a => a.id === (dialog.defaultAssigneeId ?? assignees[0]?.id))?.name ?? "",
      }
    }
    const bar = bars.find(b => b.id === dialog.barId); if (!bar) return null
    return {
      deviceId: bar.deviceId, taskId: bar.taskId, taskName: bar.process,
      startDate: bar.startDate, endDate: bar.endDate,
      assigneeId: bar.assigneeId, assigneeName: bar.assignee,
    }
  }

  const tooltipInfo = (): TooltipBarInfo | null => {
    if (!tooltip) return null
    const bar = bars.find(b => b.id === tooltip.barId)
    const dev = devices.find(d => d.id === bar?.deviceId)
    if (!bar || !dev) return null
    return {
      process:    bar.process,
      colorBg:    bar.colorBg,
      deviceName: `${dev.modelName} / ${dev.serialNumber}`,
      assignee:   bar.assignee,
      startDate:  bar.startDate, endDate: bar.endDate,
      days: Math.round((bar.endDate.getTime() - bar.startDate.getTime()) / 86400000) + 1,
    }
  }

  /* ── 可視バー ── */
  const visibleBars = useMemo((): RenderedBar[] => {
    const viewStartMs = dates[0]?.getTime() ?? 0
    const viewEndMs   = dates[dates.length - 1]?.getTime() ?? 0
    return placedBars
      .filter(b =>
        b.absoluteRow >= visibleRows.start && b.absoluteRow <= visibleRows.end &&
        b.endDate.getTime() >= viewStartMs && b.startDate.getTime() <= viewEndMs
      )
      .map(b => {
        if (viewMode === "day") {
          return {
            ...b,
            viewStartCol: Math.max(0,           Math.floor((b.startDate.getTime() - viewStartMs) / 86400000)),
            viewEndCol:   Math.min(totalCols - 1, Math.floor((b.endDate.getTime()   - viewStartMs) / 86400000)),
          }
        }
        const startDay  = Math.floor((b.startDate.getTime() - viewStartMs) / 86400000)
        const endDay    = Math.floor((b.endDate.getTime()   - viewStartMs) / 86400000)
        const startSlot = startHourToSlot(b.startDate.getHours())
        const endSlot   = endHourToSlot(b.endDate.getHours())
        return {
          ...b,
          viewStartCol: Math.max(0,           startDay * SLOT_COUNT + startSlot),
          viewEndCol:   Math.min(totalCols - 1, endDay * SLOT_COUNT + endSlot),
        }
      })
  }, [placedBars, visibleRows, dates, totalCols, viewMode])

  /* ── スタイルヘルパー ── */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE, height: HDR_H, position: "sticky", top: topPx, zIndex: 20,
    borderRight: "1px solid #d1d5db", borderBottom: "1px solid #d1d5db",
    backgroundColor: weekendCols.has(col) ? "#fff1f2" : "#f3f4f6",
  })
  const cornerStyle = (topPx: number, extra?: React.CSSProperties): React.CSSProperties => ({
    width: ROW_HDR_W, height: HDR_H, position: "sticky", top: topPx, left: 0, zIndex: 30,
    backgroundColor: "#e5e7eb", borderRight: "1px solid #9ca3af", borderBottom: "1px solid #9ca3af",
    ...extra,
  })

  if (loading) {
    return <SkeletonGrid ROW_HDR_W={ROW_HDR_W} tasks={tasks} />
  }

  const init     = dialogInitial()
  const tipInfo  = tooltipInfo()
  const barId    = contextMenu?.type === "bar" ? contextMenu.barId : ""
  const multiSel = selectedBarIds.size > 1 && selectedBarIds.has(barId)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white select-none">

      {/* ツールバー */}
      <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600 whitespace-nowrap mr-1">表示開始日</label>
          {([-2,-1] as const).map(n => (
            <button key={n} onClick={() => shiftStartDate(n)}
              className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600 font-medium">
              {n === -2 ? "≪ 2M" : "‹ 1M"}
            </button>
          ))}
          <input type="date" value={inputStartDate}
            onChange={e => setInputStartDate(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {([1,2] as const).map(n => (
            <button key={n} onClick={() => shiftStartDate(n)}
              className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600 font-medium">
              {n === 1 ? "1M ›" : "2M ≫"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border-l border-gray-300 pl-3">
          <label className="text-xs text-gray-600 whitespace-nowrap">表示月数</label>
          <input type="number" min={1} max={24} value={inputMonths}
            onChange={e => setInputMonths(Number(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="w-14 px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <label className="text-xs text-gray-600 whitespace-nowrap ml-2">予定件数</label>
          <input type="number" min={0} max={5000} step={100} value={inputCount}
            onChange={e => setInputCount(Number(e.target.value))}
            onKeyDown={e => e.key === "Enter" && handleApply()}
            className="w-20 px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button onClick={handleApply} disabled={seeding}
            className="px-3 py-0.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium transition-colors">
            {seeding ? "処理中..." : "適用"}
          </button>
        </div>

        {/* 表示モード切替 */}
        <div className="flex items-center border border-gray-300 rounded overflow-hidden ml-1">
          {(["day", "slot"] as const).map(vm => (
            <button key={vm} onClick={() => setViewMode(vm)}
              className={[
                "px-2 py-0.5 text-xs font-medium transition-colors",
                viewMode === vm
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {vm === "day" ? "日単位" : "時間割"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 mr-2">
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.colorBg }} />
              <span className="text-xs text-gray-600">{t.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* グリッド */}
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
        <div style={{
          display: "grid",
          gridTemplateColumns: `${ROW_HDR_W}px repeat(${totalCols}, ${CELL_SIZE}px)`,
          width: ROW_HDR_W + CELL_SIZE * totalCols,
          position: "relative",
        }}>

          {/* ━━━ 年ヘッダー ━━━ */}
          <div style={cornerStyle(0, { display:"flex", alignItems:"center", paddingLeft:6 })}>
            {mode === "device"
              ? <><span style={{width:DEV_HDR_W1, fontSize:9, fontWeight:700, color:"#6b7280"}}>機種 / 製番</span>
                  <span style={{width:DEV_HDR_W2, fontSize:9, fontWeight:700, color:"#6b7280", borderLeft:"1px solid #d1d5db", paddingLeft:4}}>納期</span></>
              : <span style={{fontSize:10, fontWeight:700, color:"#6b7280"}}>担当者</span>
            }
          </div>
          {Array.from({ length: totalCols }, (_, col) => {
            const dayIdx = viewMode === "slot" ? Math.floor(col / SLOT_COUNT) : col
            const date = dates[dayIdx]
            const prevDayIdx = viewMode === "slot" ? Math.floor((col - 1) / SLOT_COUNT) : col - 1
            const show = col === 0 || dates[prevDayIdx]?.getFullYear() !== date?.getFullYear()
            return (
              <div key={`y${col}`} style={colHdrStyle(col, 0)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-bold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{date?.getFullYear()}</span>}
              </div>
            )
          })}

          {/* ━━━ 月ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {Array.from({ length: totalCols }, (_, col) => {
            const dayIdx = viewMode === "slot" ? Math.floor(col / SLOT_COUNT) : col
            const date = dates[dayIdx]
            const prevDayIdx = viewMode === "slot" ? Math.floor((col - 1) / SLOT_COUNT) : col - 1
            const show = col === 0 || dates[prevDayIdx]?.getMonth() !== date?.getMonth()
            return (
              <div key={`m${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {show && <span className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[9px] font-semibold text-gray-700 whitespace-nowrap" style={{zIndex:1}}>{(date?.getMonth() ?? 0)+1}月</span>}
              </div>
            )
          })}

          {/* ━━━ 日ヘッダー ━━━ */}
          <div style={cornerStyle(HDR_H * 2)} />
          {Array.from({ length: totalCols }, (_, col) => {
            const dayIdx = viewMode === "slot" ? Math.floor(col / SLOT_COUNT) : col
            const date = dates[dayIdx]
            const isFirst = viewMode === "slot" ? col % SLOT_COUNT === 0 : true
            const isWknd = weekendCols.has(col)
            return (
              <div key={`d${col}`} style={{
                ...colHdrStyle(col, HDR_H * 2),
                borderRight: viewMode === "slot" && (col + 1) % SLOT_COUNT === 0
                  ? "1px solid #9ca3af" : "1px solid #d1d5db",
              }} className="flex items-center justify-center">
                {isFirst && (
                  <span className={`text-[9px] font-medium ${isWknd ? "text-red-500 font-bold" : "text-gray-600"}`}>
                    {date?.getDate()}
                  </span>
                )}
              </div>
            )
          })}

          {/* ━━━ スロットヘッダー (スロットモードのみ) ━━━ */}
          {viewMode === "slot" && (
            <>
              <div style={cornerStyle(HDR_H * 3)} />
              {Array.from({ length: totalCols }, (_, col) => {
                const slotIdx = col % SLOT_COUNT
                const isDayEnd = (col + 1) % SLOT_COUNT === 0
                return (
                  <div key={`s${col}`} style={{
                    ...colHdrStyle(col, HDR_H * 3),
                    borderRight: isDayEnd ? "1px solid #9ca3af" : "1px solid #d1d5db",
                  }} className="flex items-center justify-center">
                    <span className="text-[7px] font-semibold text-gray-500 leading-none">
                      {SLOT_ABBREV[slotIdx]}
                    </span>
                  </div>
                )
              })}
            </>
          )}

          {/* ━━━ 上部スペーサー ━━━ */}
          {visibleRows.start > 0 && (
            <div style={{ gridColumn: "1 / -1", height: visibleRows.start * CELL_SIZE }} />
          )}

          {/* ━━━ データ行 ━━━ */}
          {Array.from({ length: visibleRows.end - visibleRows.start + 1 }, (_, i) => {
            const row  = visibleRows.start + i
            if (row >= totalRows) return null
            const meta = rowMetas[row]
            const bg   = DEVICE_BG[meta.groupIdx % DEVICE_BG.length]
            const bbW  = meta.isLast  ? "2px" : "1px"
            const bbC  = meta.isLast  ? "#94a3b8" : "#e5e7eb"
            const btW  = meta.isFirst ? "2px" : undefined
            const btC  = meta.isFirst ? "#94a3b8" : undefined
            const devInfo = mode === "device" ? devices.find(d => d.id === meta.groupId) : undefined

            return (
              <React.Fragment key={`row-${row}`}>
                <div style={{
                  width: ROW_HDR_W, height: CELL_SIZE,
                  position: "sticky", left: 0, zIndex: 10,
                  backgroundColor: bg,
                  borderRight: "2px solid #94a3b8",
                  borderBottom: `${bbW} solid ${bbC}`,
                  borderTop: btW ? `${btW} solid ${btC}` : undefined,
                  display: "flex", alignItems: "center",
                }}>
                  {meta.isFirst && mode === "device" && (
                    <>
                      <div style={{ width: DEV_HDR_W1, paddingLeft: 6, overflow: "hidden" }}>
                        <div className="text-[9px] font-semibold text-gray-700 truncate leading-tight">{devInfo?.modelName}</div>
                        <div className="text-[9px] text-gray-500 truncate leading-tight">{devInfo?.serialNumber}</div>
                      </div>
                      <div style={{ width: DEV_HDR_W2, paddingLeft: 4, borderLeft: "1px solid #d1d5db", overflow: "hidden" }}>
                        <div className="text-[9px] text-gray-500 truncate leading-tight">
                          {devInfo?.requiredDeliveryDate
                            ? new Date(devInfo.requiredDeliveryDate + "T00:00:00").toLocaleDateString("ja-JP", { month:"numeric", day:"numeric" })
                            : ""}
                        </div>
                      </div>
                    </>
                  )}
                  {meta.isFirst && mode === "assignee" && (
                    <span className="text-[10px] font-semibold text-gray-700 whitespace-nowrap pl-2">{meta.groupName}</span>
                  )}
                </div>

                {Array.from({ length: totalCols }, (_, col) => (
                  <div key={`${row},${col}`} style={{
                    width: CELL_SIZE, height: CELL_SIZE,
                    backgroundColor: weekendCols.has(col) ? "#fff1f2" : bg,
                    borderRight: viewMode === "slot" && (col + 1) % SLOT_COUNT === 0
                      ? "1px solid #94a3b8" : "1px solid #e5e7eb",
                    borderBottom: `${bbW} solid ${bbC}`,
                    borderTop: btW ? `${btW} solid ${btC}` : undefined,
                  }} />
                ))}
              </React.Fragment>
            )
          })}

          {/* ━━━ 下部スペーサー ━━━ */}
          {visibleRows.end < totalRows - 1 && (
            <div style={{ gridColumn: "1 / -1", height: (totalRows - visibleRows.end - 1) * CELL_SIZE }} />
          )}

          {/* ━━━ バー描画 ━━━ */}
          {visibleBars.map(bar => {
            const c   = taskColorMap[bar.taskId] ?? { bg: "#6b7280", fg: "#fff" }
            const sel = selectedBarIds.has(bar.id)
            return (
              <div key={bar.id} style={{
                position: "absolute",
                left:   ROW_HDR_W + bar.viewStartCol * CELL_SIZE,
                top:    dataTop   + bar.absoluteRow * CELL_SIZE + 1,
                width:  (bar.viewEndCol - bar.viewStartCol + 1) * CELL_SIZE,
                height: CELL_SIZE - 2,
                backgroundColor: c.bg, color: c.fg,
                zIndex: sel ? 7 : 5, borderRadius: 3,
                display: "flex", alignItems: "center", paddingLeft: 4,
                overflow: "hidden", cursor: "pointer",
                outline: sel ? "2px solid #1e3a8a" : "none",
                outlineOffset: sel ? "1px" : "0",
                boxShadow: sel ? "0 0 0 2px #1e3a8a,0 2px 6px rgba(0,0,0,.3)" : "0 1px 3px rgba(0,0,0,.25)",
              }}
                onPointerDown={e => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  hideSelCell(); setContextMenu(null); setTooltip(null)
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    setSelectedBarIds(prev => { const n = new Set(prev); n.has(bar.id) ? n.delete(bar.id) : n.add(bar.id); return n })
                  } else if (!selectedBarIds.has(bar.id)) {
                    setSelectedBarIds(new Set([bar.id]))
                  }
                }}
                onContextMenu={e => {
                  e.preventDefault(); e.stopPropagation(); setTooltip(null)
                  if (!selectedBarIds.has(bar.id)) setSelectedBarIds(new Set([bar.id]))
                  setContextMenu({ type: "bar", x: e.clientX, y: e.clientY, barId: bar.id })
                }}
                onMouseEnter={e => {
                  if (!contextMenu) setTooltip({ barId: bar.id, anchorX: e.clientX, anchorY: e.clientY })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                  {bar.process}
                </span>
              </div>
            )
          })}

          {/* 選択セルオーバーレイ */}
          <div ref={selCellRef} style={{
            display: "none", position: "absolute", zIndex: 11, pointerEvents: "none",
            border: "2px solid #3b82f6", backgroundColor: "rgba(191,219,254,0.4)", boxSizing: "border-box",
          }} />

          {/* ドラッグ矩形 */}
          <div ref={dragRectRef} style={{
            display: "none", position: "absolute", zIndex: 8, pointerEvents: "none",
            border: "1.5px solid #3b82f6", backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 2,
          }} />
        </div>
      </div>

      {/* ステータスバー */}
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300 text-[11px] text-gray-500 flex items-center gap-4">
        <span>{groups.length} {mode === "device" ? "装置" : "担当者"} / {totalRows} 行 × {dates.length} 日{viewMode === "slot" ? ` (${totalCols} 列)` : ""} / 予定 {bars.length} 件</span>
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
              deviceId:          mode === "device"   ? (meta?.groupId ?? devices[0]?.id ?? "")   : devices[0]?.id ?? "",
              defaultAssigneeId: mode === "assignee" ? (meta?.groupId ?? assignees[0]?.id ?? "") : undefined,
              startDate: colToDate(contextMenu.col),
              endDate:   colToEndDate(contextMenu.col),
            })
          }}
          onPaste={() => { if (contextMenu.type === "cell") pasteBar(contextMenu.row, contextMenu.col) }}
          onDetail={() => { if (contextMenu.type === "bar") setTooltip({ barId, anchorX: contextMenu.x, anchorY: contextMenu.y }) }}
          onEdit={() => { if (contextMenu.type === "bar") setDialog({ mode: "edit", barId }) }}
          onCopy={() => {
            if (contextMenu.type === "bar") { const b = bars.find(b => b.id === barId); if (b) setCopiedBars([b]) }
          }}
          onCopySelected={() => { const sel = bars.filter(b => selectedBarIds.has(b.id)); if (sel.length > 0) setCopiedBars(sel) }}
          onDelete={() => { if (contextMenu.type === "bar") deleteBar(barId) }}
          onDeleteSelected={deleteSelected}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 予定ダイアログ */}
      {dialog && init && (
        <ScheduleDialog
          mode={dialog.mode} initial={init}
          devices={devices} tasks={tasks} assignees={assignees}
          minDate={dates[0]} maxDate={dates[totalCols > 0 ? dates.length - 1 : 0]}
          onSave={data => dialog.mode === "new" ? addBar(data) : editBar(dialog.barId, data)}
          onClose={() => setDialog(null)}
        />
      )}

      {/* ツールチップ */}
      {tooltip && tipInfo && (
        <BarTooltip bar={tipInfo} anchorX={tooltip.anchorX} anchorY={tooltip.anchorY}
          onClose={() => setTooltip(null)} />
      )}
    </div>
  )
}
