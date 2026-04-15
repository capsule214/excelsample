"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-white">
      <span className="text-sm text-gray-400">読み込み中...</span>
    </div>
  ),
})

type Tab = "device" | "assignee"

export default function SpreadsheetGridClient() {
  const [tab, setTab] = useState<Tab>("device")

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">

      {/* ━━━ タブバー ━━━ */}
      <div className="shrink-0 flex border-b border-gray-300 bg-gray-50">
        {(["device", "assignee"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-6 py-2 text-sm font-semibold border-r border-gray-300 transition-colors",
              tab === t
                ? "bg-white text-blue-600 border-b-2 border-b-blue-500 -mb-px"
                : "text-gray-500 hover:bg-gray-100",
            ].join(" ")}
          >
            {t === "device" ? "装置" : "担当者"}
          </button>
        ))}
      </div>

      {/* ━━━ グリッド (両インスタンスを維持し CSS で切り替え) ━━━ */}
      <div className={`flex-1 overflow-hidden ${tab === "device" ? "flex" : "hidden"} flex-col`}>
        <SpreadsheetGrid mode="device" />
      </div>
      <div className={`flex-1 overflow-hidden ${tab === "assignee" ? "flex" : "hidden"} flex-col`}>
        <SpreadsheetGrid mode="assignee" />
      </div>

    </div>
  )
}
