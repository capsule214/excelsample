"use client"

import React, { useState, useMemo } from "react"

/* ─── グリッド定数 ────────────────────────────── */
const COLS           = 100
const CELL_SIZE      = 20   // データセル 1辺 (px)
const ROW_HDR_W      = 64   // 行ヘッダー幅 (装置名)
const HDR_H          = 20   // 年・月・日 各ヘッダー行の高さ
const DATA_TOP       = HDR_H * 3
const MIN_ROWS       = 3    // 1装置あたりの最低行数

/* ─── 日付生成 ───────────────────────────────── */
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

function isWeekend(d: Date) {
  const day = d.getDay()
  return day === 0 || day === 6
}

/* ─── 工程カラー ─────────────────────────────── */
type ProcessName = "工程A" | "工程B" | "検査" | "出荷"

const PROCESS_COLOR: Record<ProcessName, { bg: string; fg: string }> = {
  "工程A": { bg: "#3b82f6", fg: "#fff" },
  "工程B": { bg: "#10b981", fg: "#fff" },
  "検査":  { bg: "#f59e0b", fg: "#fff" },
  "出荷":  { bg: "#8b5cf6", fg: "#fff" },
}

/* 装置ごとの行背景色 (薄い交互色) */
const DEVICE_BG = ["#f8fafc", "#f0f9ff", "#fefce8", "#fdf4ff", "#f0fdf4",
                   "#fff7ed", "#ecfdf5", "#fef2f2", "#f5f3ff", "#f0fdfa"]

/* ─── データ型 ───────────────────────────────── */
interface BarDef {
  id: string
  process: ProcessName
  startCol: number  // 0始まり列インデックス
  endCol: number    // 0始まり列インデックス (inclusive)
}

interface DeviceDef {
  id: string
  name: string
  bars: BarDef[]
}

interface PlacedBar extends BarDef {
  deviceId: string
  absoluteRow: number  // グリッド上の絶対行番号
}

interface DeviceLayout {
  device: DeviceDef
  deviceIdx: number
  startRow: number
  rowCount: number
}

interface RowMeta {
  deviceIdx: number
  deviceName: string
  isFirst: boolean
  isLast: boolean
}

/* ─── サンプルデータ ─────────────────────────── */
const DEVICES: DeviceDef[] = [
  {
    id: "d1", name: "装置1",
    bars: [
      { id: "1a", process: "工程A", startCol: 0,  endCol: 8  },
      { id: "1b", process: "工程B", startCol: 10, endCol: 22 },
      { id: "1c", process: "検査",  startCol: 14, endCol: 19 }, // 1b と重複 → 次行へ
      { id: "1d", process: "検査",  startCol: 24, endCol: 28 },
      { id: "1e", process: "出荷",  startCol: 30, endCol: 31 },
    ],
  },
  {
    id: "d2", name: "装置2",
    bars: [
      { id: "2a", process: "工程A", startCol: 2,  endCol: 12 },
      { id: "2b", process: "工程B", startCol: 2,  endCol: 8  }, // 2a と重複 → 次行へ
      { id: "2c", process: "工程B", startCol: 14, endCol: 26 },
      { id: "2d", process: "検査",  startCol: 28, endCol: 33 },
      { id: "2e", process: "出荷",  startCol: 35, endCol: 36 },
    ],
  },
  {
    id: "d3", name: "装置3",
    bars: [
      { id: "3a", process: "工程A", startCol: 5,  endCol: 16 },
      { id: "3b", process: "工程B", startCol: 18, endCol: 32 },
      { id: "3c", process: "検査",  startCol: 34, endCol: 39 },
      { id: "3d", process: "出荷",  startCol: 41, endCol: 42 },
    ],
  },
  {
    id: "d4", name: "装置4",
    bars: [
      { id: "4a", process: "工程A", startCol: 0,  endCol: 7  },
      { id: "4b", process: "工程A", startCol: 3,  endCol: 10 }, // 4a と重複 → 次行
      { id: "4c", process: "工程A", startCol: 5,  endCol: 12 }, // さらに重複 → 3行目
      { id: "4d", process: "工程B", startCol: 14, endCol: 24 },
      { id: "4e", process: "検査",  startCol: 26, endCol: 30 },
      { id: "4f", process: "出荷",  startCol: 32, endCol: 33 },
    ],
  },
  {
    id: "d5", name: "装置5",
    bars: [
      { id: "5a", process: "工程A", startCol: 3,  endCol: 13 },
      { id: "5b", process: "工程B", startCol: 15, endCol: 28 },
      { id: "5c", process: "検査",  startCol: 30, endCol: 35 },
      { id: "5d", process: "出荷",  startCol: 37, endCol: 38 },
    ],
  },
]

/* ─── レイアウト計算 ─────────────────────────── */
function computeLayout(devices: DeviceDef[]): {
  deviceLayouts: DeviceLayout[]
  placedBars: PlacedBar[]
  rowMetas: RowMeta[]
  totalRows: number
} {
  const deviceLayouts: DeviceLayout[] = []
  const allPlaced: PlacedBar[] = []
  let currentRow = 0

  devices.forEach((device, deviceIdx) => {
    // startCol 昇順にソート
    const sorted = [...device.bars].sort((a, b) => a.startCol - b.startCol)

    // 各サブ行の「最後に配置したバーの endCol」を管理
    const subRowEnds: number[] = []

    for (const bar of sorted) {
      // 重ならない最初のサブ行を探す
      let subRow = subRowEnds.findIndex((end) => end < bar.startCol)
      if (subRow === -1) {
        subRow = subRowEnds.length
        subRowEnds.push(-Infinity)
      }
      subRowEnds[subRow] = bar.endCol

      allPlaced.push({
        ...bar,
        deviceId: device.id,
        absoluteRow: currentRow + subRow,
      })
    }

    const rowCount = Math.max(MIN_ROWS, subRowEnds.length)
    deviceLayouts.push({ device, deviceIdx, startRow: currentRow, rowCount })
    currentRow += rowCount
  })

  // 各絶対行のメタ情報
  const rowMetas: RowMeta[] = []
  for (const dl of deviceLayouts) {
    for (let i = 0; i < dl.rowCount; i++) {
      rowMetas.push({
        deviceIdx: dl.deviceIdx,
        deviceName: dl.device.name,
        isFirst: i === 0,
        isLast: i === dl.rowCount - 1,
      })
    }
  }

  return { deviceLayouts, placedBars: allPlaced, rowMetas, totalRows: currentRow }
}

/* ─── コンポーネント ─────────────────────────── */
export default function SpreadsheetGrid() {
  const { placedBars, rowMetas, totalRows } = useMemo(
    () => computeLayout(DEVICES),
    []
  )

  const TOTAL_W = ROW_HDR_W + CELL_SIZE * COLS
  const TOTAL_H = DATA_TOP + CELL_SIZE * totalRows

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)

  /* 列ヘッダーセルのスタイル */
  const colHdrStyle = (col: number, topPx: number): React.CSSProperties => ({
    width: CELL_SIZE,
    height: HDR_H,
    position: "sticky",
    top: topPx,
    zIndex: 20,
    borderRight: "1px solid #d1d5db",
    borderBottom: "1px solid #d1d5db",
    backgroundColor: isWeekend(DATES[col]) ? "#fff1f2" : "#f3f4f6",
  })

  /* コーナーセルのスタイル */
  const cornerStyle = (topPx: number): React.CSSProperties => ({
    width: ROW_HDR_W,
    height: HDR_H,
    position: "sticky",
    top: topPx,
    left: 0,
    zIndex: 30,
    backgroundColor: "#e5e7eb",
    borderRight: "1px solid #9ca3af",
    borderBottom: "1px solid #9ca3af",
  })

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">

      {/* ── ツールバー ── */}
      <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 shrink-0">
        <span className="text-sm font-semibold text-gray-700">スケジュール管理</span>
        <span className="ml-4 text-xs text-gray-500">
          {DATES[0].toLocaleDateString("ja-JP")} 〜 {DATES[COLS - 1].toLocaleDateString("ja-JP")}
        </span>
        {/* 凡例 */}
        <div className="ml-auto flex items-center gap-3 mr-2">
          {(Object.entries(PROCESS_COLOR) as [ProcessName, { bg: string }][]).map(([name, c]) => (
            <div key={name} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg }} />
              <span className="text-xs text-gray-600">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── スクロール領域 ── */}
      <div className="flex-1 overflow-auto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${ROW_HDR_W}px repeat(${COLS}, ${CELL_SIZE}px)`,
            width: TOTAL_W,
            height: TOTAL_H,
            position: "relative",
          }}
        >
          {/* ━━━ ヘッダー行1: 年 ━━━ */}
          <div style={cornerStyle(0)} />
          {DATES.map((date, col) => {
            const showYear = col === 0 || DATES[col - 1].getFullYear() !== date.getFullYear()
            return (
              <div key={`y-${col}`} style={colHdrStyle(col, 0)} className="relative">
                {showYear && (
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-0.5
                               text-[9px] font-bold text-gray-700 whitespace-nowrap"
                    style={{ zIndex: 1 }}
                  >
                    {date.getFullYear()}
                  </span>
                )}
              </div>
            )
          })}

          {/* ━━━ ヘッダー行2: 月 ━━━ */}
          <div style={cornerStyle(HDR_H)} />
          {DATES.map((date, col) => {
            const showMonth = col === 0 || DATES[col - 1].getMonth() !== date.getMonth()
            return (
              <div key={`m-${col}`} style={colHdrStyle(col, HDR_H)} className="relative">
                {showMonth && (
                  <span
                    className="absolute inset-y-0 left-0 flex items-center pl-0.5
                               text-[9px] font-semibold text-gray-700 whitespace-nowrap"
                    style={{ zIndex: 1 }}
                  >
                    {date.getMonth() + 1}月
                  </span>
                )}
              </div>
            )
          })}

          {/* ━━━ ヘッダー行3: 日 ━━━ */}
          <div style={cornerStyle(HDR_H * 2)} />
          {DATES.map((date, col) => {
            const weekend = isWeekend(date)
            return (
              <div
                key={`d-${col}`}
                style={colHdrStyle(col, HDR_H * 2)}
                className="flex items-center justify-center"
              >
                <span className={[
                  "text-[9px] font-medium leading-none",
                  weekend ? "text-red-500 font-bold" : "text-gray-600",
                ].join(" ")}>
                  {date.getDate()}
                </span>
              </div>
            )
          })}

          {/* ━━━ データ行 ━━━ */}
          {rowMetas.map((meta, row) => {
            const deviceBg = DEVICE_BG[meta.deviceIdx % DEVICE_BG.length]
            /* 装置境界ボーダー */
            const borderBottom = meta.isLast
              ? "2px solid #94a3b8"   // 装置末尾: 濃いめのセパレータ
              : "1px solid #e5e7eb"

            return (
              <React.Fragment key={`row-${row}`}>
                {/* 行ヘッダー (装置名) */}
                <div
                  style={{
                    width: ROW_HDR_W,
                    height: CELL_SIZE,
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    backgroundColor: deviceBg,
                    borderRight: "2px solid #94a3b8",
                    borderBottom,
                    borderTop: meta.isFirst ? "2px solid #94a3b8" : undefined,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 6,
                    overflow: "hidden",
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
                  const sel = selected?.row === row && selected?.col === col
                  const weekend = isWeekend(date)
                  const bg = sel ? "#bfdbfe" : weekend ? "#fff1f2" : deviceBg
                  return (
                    <div
                      key={`${row},${col}`}
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: bg,
                        borderRight: "1px solid #e5e7eb",
                        borderBottom,
                        borderTop: meta.isFirst ? "2px solid #94a3b8" : undefined,
                        ...(sel
                          ? { outline: "2px solid #3b82f6", outlineOffset: "-2px", position: "relative" as const, zIndex: 11 }
                          : {}),
                      }}
                      onClick={() => setSelected(sel ? null : { row, col })}
                    />
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* ━━━ スケジュールバー (z-index: 5 = セルより上) ━━━
           *
           * left  = ROW_HDR_W + startCol × CELL_SIZE
           * top   = DATA_TOP  + absoluteRow × CELL_SIZE  (+1px margin)
           * width = (endCol - startCol + 1) × CELL_SIZE
           * height= CELL_SIZE - 2px
           */}
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
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 4,
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  cursor: "default",
                }}
                title={
                  `${bar.process}：` +
                  `${DATES[bar.startCol]?.toLocaleDateString("ja-JP")} 〜 ` +
                  `${DATES[bar.endCol]?.toLocaleDateString("ja-JP")} ` +
                  `(${bar.endCol - bar.startCol + 1}日間)`
                }
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
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300
                      text-[11px] text-gray-500 flex items-center gap-4">
        <span>{DEVICES.length} 装置 / {totalRows} 行 × {COLS} 列</span>
        {selected && (
          <span>
            選択: {DATES[selected.col]?.toLocaleDateString("ja-JP")} /{" "}
            {rowMetas[selected.row]?.deviceName} 行{selected.row + 1}
          </span>
        )}
      </div>
    </div>
  )
}
