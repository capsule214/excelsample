"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { DisplaySettingsDialog } from "./DisplaySettingsDialog"
import type { DeviceInfo, AssigneeInfo, TaskInfo } from "./ScheduleDialog"

const SpreadsheetGrid = dynamic(() => import("@/components/SpreadsheetGrid"), { ssr: false })

type Tab = "device" | "assignee"

interface DisplaySettings { deviceIds: string[]; assigneeIds: string[] }

/* ─── スケルトン (初回ロード中に表示) ─── */
function NavSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-pulse">
      {/* ツールバー骨格 */}
      <div className="shrink-0 flex items-center px-3 py-2 bg-gray-100 border-b border-gray-300 gap-3">
        <div className="h-5 w-36 bg-gray-200 rounded" />
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded" />
        <div className="h-5 w-14 bg-blue-200 rounded" />
        <div className="ml-auto flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-4 w-10 bg-gray-200 rounded" />)}
        </div>
      </div>

      {/* グリッド骨格 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 日付ヘッダー骨格 */}
        <div className="shrink-0 flex border-b border-gray-200" style={{ height: 60 }}>
          <div className="shrink-0 bg-gray-200" style={{ width: 202 }} />
          <div className="flex-1 bg-gray-100" />
        </div>
        {/* 行骨格 */}
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 18 }, (_, i) => {
            const LEFT  = [8,  28, 48, 15, 35, 55, 5,  42, 22, 62, 18, 38, 52, 10, 30, 45, 20, 65][i]
            const WIDTH = [18, 14, 22, 16, 20, 12, 24, 15, 19, 11, 17, 21, 13, 23, 16, 18, 20, 14][i]
            const COLORS = ["#bfdbfe","#a7f3d0","#fde68a","#ddd6fe"]
            return (
              <div key={i} className="flex border-b border-gray-100" style={{ height: 20 }}>
                <div className="shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: 202, display:"flex", alignItems:"center", paddingLeft: 8 }}>
                  {i % 3 === 0 && <div className="h-2.5 w-3/4 bg-gray-200 rounded" />}
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-y-1 rounded"
                    style={{ left: `${LEFT}%`, width: `${WIDTH}%`, backgroundColor: COLORS[i % 4] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ステータスバー骨格 */}
      <div className="shrink-0 px-3 py-1 bg-gray-100 border-t border-gray-300">
        <div className="h-3 w-40 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

export default function SpreadsheetGridClient() {
  const [tab,            setTab           ] = useState<Tab>("device")
  const [devices,        setDevices       ] = useState<DeviceInfo[]>([])
  const [assignees,      setAssignees     ] = useState<AssigneeInfo[]>([])
  const [tasks,          setTasks         ] = useState<TaskInfo[]>([])
  const [displaySettings,setDisplaySettings] = useState<DisplaySettings | null>(null)
  const [showDialog,     setShowDialog    ] = useState(false)
  const [loading,        setLoading       ] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/devices").then(r => r.json()),
      fetch("/api/assignees").then(r => r.json()),
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/display-settings").then(r => r.json()),
    ]).then(([devs, asgns, tsks, settings]: [DeviceInfo[], AssigneeInfo[], TaskInfo[], DisplaySettings]) => {
      setDevices(devs)
      setAssignees(asgns)
      setTasks(tsks)
      setDisplaySettings(settings)
      setLoading(false)
    })
  }, [])

  const handleSaveSettings = async (deviceIds: string[], assigneeIds: string[]) => {
    await fetch("/api/display-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceIds, assigneeIds }),
    })
    setDisplaySettings({ deviceIds, assigneeIds })
    setShowDialog(false)
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">

      {/* ━━━ ナビバー ━━━ */}
      <div className="shrink-0 flex items-center border-b border-gray-300 bg-gray-50 pr-2">
        {/* タブ */}
        {(["device", "assignee"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-6 py-2.5 text-sm font-semibold border-r border-gray-300 transition-colors",
              tab === t
                ? "bg-white text-blue-600 border-b-2 border-b-blue-500 -mb-px"
                : "text-gray-500 hover:bg-gray-100",
            ].join(" ")}
          >
            {t === "device" ? "装置" : "担当者"}
          </button>
        ))}

        {/* スペーサー */}
        <div className="flex-1" />

        {/* 表示設定ボタン */}
        <button
          onClick={() => setShowDialog(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          表示設定
        </button>
      </div>

      {/* ━━━ グリッドエリア ━━━ */}
      {loading ? (
        <NavSkeleton />
      ) : (
        <>
          <div className={`flex-1 overflow-hidden ${tab === "device" ? "flex" : "hidden"} flex-col`}>
            <SpreadsheetGrid
              mode="device"
              devices={devices} assignees={assignees} tasks={tasks}
              visibleGroupIds={displaySettings?.deviceIds}
            />
          </div>
          <div className={`flex-1 overflow-hidden ${tab === "assignee" ? "flex" : "hidden"} flex-col`}>
            <SpreadsheetGrid
              mode="assignee"
              devices={devices} assignees={assignees} tasks={tasks}
              visibleGroupIds={displaySettings?.assigneeIds}
            />
          </div>
        </>
      )}

      {/* ━━━ 表示設定ダイアログ ━━━ */}
      {showDialog && displaySettings && (
        <DisplaySettingsDialog
          devices={devices} assignees={assignees}
          selectedDeviceIds={displaySettings.deviceIds}
          selectedAssigneeIds={displaySettings.assigneeIds}
          onSave={handleSaveSettings}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  )
}
