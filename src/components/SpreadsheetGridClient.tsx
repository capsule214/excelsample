"use client"

import dynamic from "next/dynamic"

// ssr: false はクライアントコンポーネント内でのみ使用可
const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-white">
      <span className="text-sm text-gray-400">読み込み中...</span>
    </div>
  ),
})

export default function SpreadsheetGridClient() {
  return <SpreadsheetGrid />
}
