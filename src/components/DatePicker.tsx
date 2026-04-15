"use client"

import { useState, useEffect } from "react"

interface Props {
  value: Date
  onChange: (date: Date) => void
  minDate?: Date
  maxDate?: Date
  rangeStart?: Date   // 選択範囲ハイライト (開始日)
  rangeEnd?: Date     // 選択範囲ハイライト (終了日)
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}
function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 常時表示のインラインカレンダーコンポーネント */
export function DatePicker({ value, onChange, minDate, maxDate, rangeStart, rangeEnd }: Props) {
  const [viewYear,  setViewYear ] = useState(value.getFullYear())
  const [viewMonth, setViewMonth] = useState(value.getMonth())

  /* value が外部から変わったときにビューを追従 */
  useEffect(() => {
    setViewYear(value.getFullYear())
    setViewMonth(value.getMonth())
  }, [value])

  /* 月移動 */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  /* カレンダーセル生成 */
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate()
  const cells: Date[] = []

  for (let i = firstDow - 1; i >= 0; i--)
    cells.push(new Date(viewYear, viewMonth - 1, daysInPrev - i))
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(viewYear, viewMonth, d))
  while (cells.length % 7 !== 0)
    cells.push(new Date(viewYear, viewMonth + 1, cells.length - firstDow - daysInMonth + 1))

  const minMs = minDate ? stripTime(minDate) : -Infinity
  const maxMs = maxDate ? stripTime(maxDate) : Infinity
  const rsMs  = rangeStart ? stripTime(rangeStart) : null
  const reMs  = rangeEnd   ? stripTime(rangeEnd)   : null

  return (
    <div className="w-full select-none">
      {/* ヘッダー: 月ナビ */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-700">
          {viewYear}年 {viewMonth + 1}月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-semibold py-0.5
              ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          const ms             = stripTime(date)
          const isCurrentMonth = date.getMonth() === viewMonth
          const isSelected     = sameDay(date, value)
          const isRangeStart   = rsMs !== null && ms === rsMs
          const isRangeEnd     = reMs !== null && ms === reMs
          const isInRange      = rsMs !== null && reMs !== null && ms > rsMs && ms < reMs
          const disabled       = ms < minMs || ms > maxMs
          const dow            = date.getDay()

          /* テキスト色 */
          let textColor = "text-gray-800"
          if (!isCurrentMonth) textColor = disabled ? "text-gray-200" : "text-gray-350"
          else if (disabled)   textColor = "text-gray-250"
          else if (dow === 0)  textColor = "text-red-500"
          else if (dow === 6)  textColor = "text-blue-500"

          /* 背景・形状 */
          const isEndpoint = isRangeStart || isRangeEnd
          let bg = ""
          if (isSelected) {
            bg = "bg-blue-500 text-white rounded-full shadow-md"
            textColor = "text-white"
          } else if (isEndpoint) {
            bg = "bg-blue-400 text-white rounded-full"
            textColor = "text-white"
          } else if (isInRange) {
            bg = "bg-blue-100 rounded-full"
          } else if (!disabled) {
            bg = "hover:bg-blue-50 rounded-full"
          }

          return (
            <div key={idx} className="flex items-center justify-center py-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(date)}
                className={[
                  "w-8 h-8 flex items-center justify-center text-[13px] font-medium transition-colors",
                  bg,
                  !isSelected && !isEndpoint ? textColor : "",
                  disabled ? "cursor-default" : "cursor-pointer",
                ].join(" ")}
              >
                {date.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
