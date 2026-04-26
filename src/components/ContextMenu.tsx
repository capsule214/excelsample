"use client"

import { useEffect } from "react"

interface Props {
  x: number
  y: number
  type: "cell" | "bar"
  clipboardCount: number    // クリップボード内のバー数 (0 = なし)
  isMultiSelect: boolean    // 複数選択状態でこのバーが選択中
  selectedCount: number     // 選択バー数
  onNewSchedule: () => void
  onPaste: () => void
  onDetail: () => void
  onEdit: () => void
  onCopy: () => void
  onCopySelected: () => void
  onDelete: () => void
  onDeleteSelected: () => void
  onClose: () => void
  // タブジャンプ (単体選択時のみ)
  jumpToOtherTabLabel?: string
  onJumpToOtherTab?: () => void
}

export function ContextMenu({
  x, y, type,
  clipboardCount, isMultiSelect, selectedCount,
  onNewSchedule, onPaste, onDetail, onEdit, onCopy, onCopySelected, onDelete, onDeleteSelected,
  onClose,
  jumpToOtherTabLabel, onJumpToOtherTab,
}: Props) {
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [onClose])

  const left = Math.min(x, window.innerWidth  - 180)
  const top  = Math.min(y, window.innerHeight - 200)

  const item    = "w-full px-4 py-1.5 text-left text-[13px] hover:bg-gray-100 text-gray-700 flex items-center gap-2"
  const danger  = `${item} text-red-500 hover:bg-red-50`
  const divider = <div className="border-t border-gray-100 my-1" />

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 1000, minWidth: 172 }}
      className="bg-white rounded-lg shadow-xl border border-gray-200 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {type === "cell" ? (
        <>
          <button className={item} onClick={() => { onNewSchedule(); onClose() }}>
            <span className="text-blue-500 font-bold">＋</span> 新規追加
          </button>
          {clipboardCount > 0 && (
            <button className={item} onClick={() => { onPaste(); onClose() }}>
              <span className="text-gray-400">📋</span> 貼り付け{clipboardCount > 1 ? ` (${clipboardCount}件)` : ""}
            </button>
          )}
        </>
      ) : isMultiSelect ? (
        /* 複数選択時 */
        <>
          <div className="px-4 py-1 text-[11px] text-gray-400">{selectedCount} 件を選択中</div>
          {divider}
          <button className={item} onClick={() => { onCopySelected(); onClose() }}>
            <span className="text-gray-400">📋</span> コピー ({selectedCount}件)
          </button>
          {divider}
          <button className={danger} onClick={() => { onDeleteSelected(); onClose() }}>
            <span>🗑</span> 選択した予定を削除 ({selectedCount}件)
          </button>
        </>
      ) : (
        /* 単体選択時 */
        <>
          <button className={item} onClick={() => { onDetail(); onClose() }}>
            <span className="text-gray-400">🔍</span> 詳細表示
          </button>
          <button className={item} onClick={() => { onEdit(); onClose() }}>
            <span className="text-gray-400">✎</span> 編集
          </button>
          <button className={item} onClick={() => { onCopy(); onClose() }}>
            <span className="text-gray-400">📋</span> コピー
          </button>
          {onJumpToOtherTab && jumpToOtherTabLabel && (
            <>
              {divider}
              <button className={item} onClick={() => { onJumpToOtherTab(); onClose() }}>
                <span className="text-blue-400">↗</span> {jumpToOtherTabLabel}
              </button>
            </>
          )}
          {divider}
          <button className={danger} onClick={() => { onDelete(); onClose() }}>
            <span>🗑</span> 削除
          </button>
        </>
      )}
    </div>
  )
}
