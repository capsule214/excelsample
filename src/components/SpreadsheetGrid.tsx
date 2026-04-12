"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"

const ROWS = 100
const COLS = 100
const CELL_SIZE = 40 // px (正方形)

type CellData = {
  value: string
}

type CellPos = { row: number; col: number }

function getColLabel(col: number): string {
  let label = ""
  let n = col + 1
  while (n > 0) {
    n--
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26)
  }
  return label
}

export default function SpreadsheetGrid() {
  const [cells, setCells] = useState<Record<string, CellData>>({})
  const [selected, setSelected] = useState<CellPos>({ row: 0, col: 0 })
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const cellKey = (row: number, col: number) => `${row},${col}`

  const commitEdit = useCallback(
    (pos?: CellPos) => {
      const target = pos ?? selected
      const key = cellKey(target.row, target.col)
      setCells((prev) => ({ ...prev, [key]: { value: editValue } }))
      setEditing(false)
    },
    [selected, editValue]
  )

  const cancelEdit = () => setEditing(false)

  const startEditing = (row: number, col: number, initialValue?: string) => {
    const key = cellKey(row, col)
    setEditValue(initialValue ?? cells[key]?.value ?? "")
    setEditing(true)
  }

  const move = useCallback((dr: number, dc: number) => {
    setSelected((prev) => ({
      row: Math.max(0, Math.min(ROWS - 1, prev.row + dr)),
      col: Math.max(0, Math.min(COLS - 1, prev.col + dc)),
    }))
  }, [])

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          move(-1, 0)
          break
        case "ArrowDown":
          e.preventDefault()
          move(1, 0)
          break
        case "ArrowLeft":
          e.preventDefault()
          move(0, -1)
          break
        case "ArrowRight":
          e.preventDefault()
          move(0, 1)
          break
        case "Tab":
          e.preventDefault()
          move(0, e.shiftKey ? -1 : 1)
          break
        case "Enter":
          e.preventDefault()
          startEditing(selected.row, selected.col)
          break
        case "Delete":
        case "Backspace": {
          const key = cellKey(selected.row, selected.col)
          setCells((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })
          break
        }
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            startEditing(selected.row, selected.col, e.key)
          }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, selected, move]
  )

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    } else {
      containerRef.current?.focus()
    }
  }, [editing])

  const cellAddress = `${getColLabel(selected.col)}${selected.row + 1}`
  const selectedValue = cells[cellKey(selected.row, selected.col)]?.value ?? ""

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {/* ツールバー */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-100 border-b border-gray-300 shrink-0 text-sm">
        <span className="font-semibold text-gray-700">スケジュール管理</span>
        <div className="w-px h-4 bg-gray-300" />
        <span className="w-16 text-center border border-gray-300 rounded px-1 py-0.5 bg-white font-mono text-xs text-gray-700">
          {cellAddress}
        </span>
        <div className="flex-1 border border-gray-300 rounded px-2 py-0.5 bg-white text-xs text-gray-700 min-h-[22px]">
          {editing ? editValue : selectedValue}
        </div>
      </div>

      {/* グリッドコンテナ */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto outline-none"
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${CELL_SIZE}px repeat(${COLS}, ${CELL_SIZE}px)`,
            width: `${CELL_SIZE * (COLS + 1)}px`,
          }}
        >
          {/* 左上コーナー */}
          <div
            style={{ width: CELL_SIZE, height: CELL_SIZE }}
            className="sticky top-0 left-0 z-30 bg-gray-200 border-r border-b border-gray-400"
          />

          {/* 列ヘッダー (A, B, C, ...) */}
          {Array.from({ length: COLS }, (_, col) => (
            <div
              key={`ch-${col}`}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              className="sticky top-0 z-20 bg-gray-100 border-r border-b border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600"
            >
              {getColLabel(col)}
            </div>
          ))}

          {/* データ行 */}
          {Array.from({ length: ROWS }, (_, row) => (
            <React.Fragment key={`row-${row}`}>
              {/* 行ヘッダー */}
              <div
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
                className="sticky left-0 z-10 bg-gray-100 border-r border-b border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600"
              >
                {row + 1}
              </div>

              {/* セル */}
              {Array.from({ length: COLS }, (_, col) => {
                const key = cellKey(row, col)
                const isSelected = selected.row === row && selected.col === col
                const isEditing = isSelected && editing
                const value = cells[key]?.value ?? ""

                return (
                  <div
                    key={key}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      ...(isSelected
                        ? { outline: "2px solid #3b82f6", outlineOffset: "-2px", zIndex: 10 }
                        : {}),
                    }}
                    className={[
                      "relative border-r border-b border-gray-200",
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50",
                    ].join(" ")}
                    onClick={() => {
                      if (editing) commitEdit()
                      setSelected({ row, col })
                      setEditing(false)
                    }}
                    onDoubleClick={() => {
                      setSelected({ row, col })
                      startEditing(row, col)
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            commitEdit()
                            move(1, 0)
                          } else if (e.key === "Escape") {
                            e.preventDefault()
                            cancelEdit()
                          } else if (e.key === "Tab") {
                            e.preventDefault()
                            commitEdit()
                            move(0, e.shiftKey ? -1 : 1)
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault()
                            commitEdit()
                            move(-1, 0)
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault()
                            commitEdit()
                            move(1, 0)
                          }
                        }}
                        className="absolute inset-0 w-full h-full px-1 text-xs bg-white outline-none z-20"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center px-1 text-xs overflow-hidden whitespace-nowrap text-gray-800">
                        {value}
                      </span>
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ステータスバー */}
      <div className="shrink-0 px-3 py-0.5 bg-gray-100 border-t border-gray-300 text-xs text-gray-500 flex items-center gap-4">
        <span>{ROWS} 行 × {COLS} 列</span>
        <span>クリック: 選択 / ダブルクリックまたはEnter: 編集 / Escキー: キャンセル</span>
      </div>
    </div>
  )
}
