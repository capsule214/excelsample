"use client"

import { useEffect, useRef } from "react"

export interface TooltipBarInfo {
  id: string
  process: string
  colorBg: string
  deviceName: string
  assignee: string
  startDate: Date
  endDate: Date
  days: number
}

interface Props {
  bar: TooltipBarInfo
  anchorX: number   // 吹き出し矢印の X 座標 (clientX)
  anchorY: number   // 吹き出しが指す Y 座標 (clientY)
  onClose: () => void
}

const W = 210
const ARROW = 8

export function BarTooltip({ bar, anchorX, anchorY, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // 吹き出し以外の場所を mousedown したら閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // setTimeout で開いた直後のイベントを無視
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0)
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler) }
  }, [onClose])

  const isNearTop = anchorY < window.innerHeight * 0.45
  const left      = Math.max(8, Math.min(anchorX - W / 2, window.innerWidth - W - 8))
  const arrowLeft = Math.min(Math.max(anchorX - left - ARROW, 8), W - ARROW * 2 - 8)
  const top       = isNearTop
    ? anchorY + ARROW + 4
    : anchorY - 170 - ARROW - 4   // 170px = 吹き出しの概算高さ

  const color = bar.colorBg || "#6b7280"

  const ArrowUp = () => (
    <>
      <div style={{
        position: "absolute", top: -ARROW - 1, left: arrowLeft,
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderBottom: `${ARROW + 1}px solid #d1d5db`,
      }} />
      <div style={{
        position: "absolute", top: -ARROW, left: arrowLeft,
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderBottom: `${ARROW}px solid white`,
      }} />
    </>
  )

  const ArrowDown = () => (
    <>
      <div style={{
        position: "absolute", bottom: -ARROW - 1, left: arrowLeft,
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderTop: `${ARROW + 1}px solid #d1d5db`,
      }} />
      <div style={{
        position: "absolute", bottom: -ARROW, left: arrowLeft,
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderTop: `${ARROW}px solid white`,
      }} />
    </>
  )

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, width: W, zIndex: 2000 }}
    >
      {isNearTop && <ArrowUp />}

      {/* 吹き出し本体 */}
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* ヘッダー (工程カラー) */}
        <div style={{ backgroundColor: color }} className="px-3 py-2 flex items-center gap-2">
          <span className="text-white text-[13px] font-bold">{bar.process}</span>
        </div>

        {/* 内容 */}
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <Row label="装置"   value={bar.deviceName} />
          <Row label="担当者" value={bar.assignee}   />
          <div className="border-t border-gray-100 my-0.5" />
          <Row label="開始日" value={bar.startDate.toLocaleDateString("ja-JP")} />
          <Row label="終了日" value={bar.endDate.toLocaleDateString("ja-JP")}   />
          <Row label="期間"   value={`${bar.days} 日間`} />
          <div className="border-t border-gray-100 my-0.5" />
          <Row label="ID"     value={bar.id} />
        </div>
      </div>

      {!isNearTop && <ArrowDown />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-gray-700 text-right">{value}</span>
    </div>
  )
}
