"use client"

import { useEffect } from "react"

interface Props {
  x: number
  y: number
  type: "cell" | "bar"
  onNewSchedule: () => void
  onDetail: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

export function ContextMenu({
  x, y, type,
  onNewSchedule, onDetail, onEdit, onDelete, onClose,
}: Props) {
  // 外側クリックで閉じる (right-click は click イベントを発火しないので安全)
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [onClose])

  // ビューポートからはみ出さないよう位置を補正
  const left = Math.min(x, window.innerWidth  - 160)
  const top  = Math.min(y, window.innerHeight - 130)

  const item = "w-full px-4 py-1.5 text-left text-[13px] hover:bg-gray-100 text-gray-700 flex items-center gap-2"

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 1000, minWidth: 152 }}
      className="bg-white rounded-lg shadow-xl border border-gray-200 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {type === "cell" ? (
        <button className={item} onClick={() => { onNewSchedule(); onClose() }}>
          <span className="text-blue-500">＋</span> 新規追加
        </button>
      ) : (
        <>
          <button className={item} onClick={() => { onDetail(); onClose() }}>
            <span className="text-gray-400">🔍</span> 詳細表示
          </button>
          <button className={item} onClick={() => { onEdit(); onClose() }}>
            <span className="text-gray-400">✎</span> 編集
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            className={`${item} text-red-500 hover:bg-red-50`}
            onClick={() => { onDelete(); onClose() }}
          >
            <span>🗑</span> 削除
          </button>
        </>
      )}
    </div>
  )
}
