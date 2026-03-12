"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import {
  Activity,
  AlertCircle,
  Brain,
  Check as CheckIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Command,
  Ear,
  Hexagon,
  Loader2,
  LogOut,
  Mic,
  PanelLeftClose,
  Power,
  Save,
  Send,
  Server,
  Settings,
  User,
} from "lucide-react"

// ─── Sidebar ────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: ReactNode
}

function Sidebar({
  items,
  activeItem,
  onItemChange,
  collapsed,
  onToggleCollapse,
}: {
  items: NavItem[]
  activeItem: string
  onItemChange: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [showText, setShowText] = useState(!collapsed)

  useEffect(() => {
    if (collapsed) {
      setShowText(false)
    } else {
      const timer = setTimeout(() => setShowText(true), 300)
      return () => clearTimeout(timer)
    }
  }, [collapsed])

  return (
    <aside
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (!target.closest("button, a")) onToggleCollapse()
      }}
      className={`fixed left-5 top-5 bottom-5 bg-zinc-900 flex flex-col z-50 transition-all duration-300 cursor-pointer ${
        collapsed ? "w-[57px]" : "w-44"
      }`}
      style={{
        boxShadow: "6px 0 32px rgba(0,0,0,0.18), 2px 0 12px rgba(0,0,0,0.12)",
        borderRadius: "16px",
      }}
    >
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? "justify-center pt-5 pb-4" : "px-4 pt-5 pb-4"}`}>
        <button
          onClick={collapsed ? onToggleCollapse : undefined}
          className={`p-1.5 rounded-lg bg-zinc-900 flex-shrink-0 transition-opacity ${collapsed ? "hover:opacity-80 cursor-pointer" : ""}`}
        >
          <Hexagon className="text-violet-400" style={{ width: 22, height: 22 }} />
        </button>
        {showText && (
          <>
            <h1 className="text-xs font-bold text-white ml-2.5 whitespace-nowrap">OtoMoni</h1>
            <button
              onClick={onToggleCollapse}
              className="ml-auto p-1.5 rounded-full bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <PanelLeftClose style={{ width: 13, height: 13 }} />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 space-y-2 ${collapsed ? "px-2" : "px-2.5"} mt-2`}>
        {items.map((item) => (
          <div key={item.id} className="relative">
            <button
              onClick={() => onItemChange(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                w-full flex items-center rounded-lg font-medium transition-all
                ${collapsed ? "justify-center p-2" : "gap-3.5 px-2.5 py-2 text-left"}
                ${activeItem === item.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }
              `}
              style={{ fontSize: "13px" }}
            >
              <span className={`flex-shrink-0 ${activeItem === item.id ? "text-zinc-300" : ""}`} style={{ width: 16, height: 16 }}>
                {item.icon}
              </span>
              {showText && item.label}
            </button>
            {collapsed && hoveredItem === item.id && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-zinc-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-lg z-50">
                {item.label}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={`border-t border-zinc-800 ${collapsed ? "p-2 pb-4" : "p-2.5 pb-4"}`}>
        <div className={collapsed ? "space-y-1" : "space-y-2"}>
          {!showText ? (
            <div className="flex justify-center py-2">
              <div className="p-1.5 rounded-full bg-zinc-700">
                <User className="w-3.5 h-3.5 text-zinc-300" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-zinc-800/50 rounded-lg">
              <div className="p-1 rounded-full bg-zinc-700">
                <User className="w-3 h-3 text-zinc-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-white truncate">管理者</p>
                <p className="text-[9px] text-zinc-500 truncate">kawasaki-city</p>
              </div>
            </div>
          )}
          <button
            className={`w-full flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all duration-200 font-medium ${
              collapsed ? "p-2.5" : "gap-1.5 px-3 py-2"
            }`}
            style={collapsed ? undefined : { fontSize: "13px" }}
          >
            <LogOut className="w-3 h-3" />
            {showText && "サインアウト"}
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────

export default function Dashboard() {
  const [devicesStatus, setDevicesStatus] = useState([
    { name: "kawasaki-ras-1", online: true },
  ])

  const [activeSection, setActiveSection] = useState<"dashboard" | "sound" | "settings">("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  type AudioItem = {
    key: string
    url: string
    size?: number
    lastModified?: string
    isAnomaly?: boolean
    reconstructionError?: number
    inferenceThreshold?: number
    inferenceTimestamp?: number
  }
  const [audioItems, setAudioItems] = useState<AudioItem[]>([])
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioFilter, setAudioFilter] = useState<"all" | "normal" | "anomaly">("all")
  const [audioPageSize, setAudioPageSize] = useState(20)
  const [audioCursors, setAudioCursors] = useState<(string | null)[]>([null])
  const [audioPage, setAudioPage] = useState(0)
  const [audioNextCursor, setAudioNextCursor] = useState<string | null>(null)
  const [audioPeriod, setAudioPeriod] = useState<"all" | "today" | "3d" | "7d" | "30d">("all")

  const getDateRange = useCallback(() => {
    if (audioPeriod === "all") return { from: undefined, to: undefined }
    const now = Date.now()
    const days = audioPeriod === "today" ? 1 : audioPeriod === "3d" ? 3 : audioPeriod === "7d" ? 7 : 30
    const from = now - days * 24 * 60 * 60 * 1000
    return { from: String(from), to: String(now) }
  }, [audioPeriod])

  const fetchAudio = useCallback(async (cursor: string | null) => {
    setAudioLoading(true)
    try {
      const { from, to } = getDateRange()
      const q = new URLSearchParams({ limit: String(audioPageSize) })
      if (cursor) q.set("cursor", cursor)
      if (from) q.set("from", from)
      if (to) q.set("to", to)
      const res = await fetch(`/api/audio/latest?${q}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.items)) setAudioItems(data.items)
      setAudioNextCursor(data.nextCursor ?? null)
    } catch { /* ignore */ }
    finally { setAudioLoading(false) }
  }, [audioPageSize, getDateRange])

  // 初回 + フィルタ変更時にリセット
  useEffect(() => {
    setAudioPage(0)
    setAudioCursors([null])
    fetchAudio(null)
  }, [audioPageSize, audioPeriod, fetchAudio])

  // 自動更新（1ページ目のみ10秒ポーリング）
  useEffect(() => {
    if (audioPage !== 0) return
    const t = setInterval(() => fetchAudio(null), 10000)
    return () => clearInterval(t)
  }, [audioPage, fetchAudio])

  const handleAudioNextPage = () => {
    if (!audioNextCursor) return
    const newPage = audioPage + 1
    const newCursors = [...audioCursors]
    newCursors[newPage] = audioNextCursor
    setAudioCursors(newCursors)
    setAudioPage(newPage)
    fetchAudio(audioNextCursor)
  }

  const handleAudioPrevPage = () => {
    if (audioPage <= 0) return
    const newPage = audioPage - 1
    setAudioPage(newPage)
    fetchAudio(audioCursors[newPage])
  }

  const filteredAudioItems = audioItems.filter((it) => {
    if (audioFilter === "normal") return it.isAnomaly === false
    if (audioFilter === "anomaly") return it.isAnomaly === true
    return true
  })

  // Heartbeat: センサー死活取得（15秒ポーリング）
  useEffect(() => {
    let aborted = false
    async function fetchHeartbeat() {
      try {
        const res = await fetch(`/api/heartbeat?thing=kawasaki-ras-1`, { cache: "no-store" })
        if (!res.ok) {
          if (!aborted) setDevicesStatus(prev => prev.map((d, i) => i === 0 ? { ...d, online: false } : d))
          return
        }
        const data: { status: "Active" | "Offline" } = await res.json()
        if (!aborted) setDevicesStatus(prev => prev.map((d, i) => i === 0 ? { ...d, online: data.status === "Active" } : d))
      } catch {
        if (!aborted) setDevicesStatus(prev => prev.map((d, i) => i === 0 ? { ...d, online: false } : d))
      }
    }
    fetchHeartbeat()
    const t = setInterval(fetchHeartbeat, 15000)
    return () => { aborted = true; clearInterval(t) }
  }, [])

  const formatIsoLocal = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })
  }

  const navItems: NavItem[] = [
    { id: "dashboard", label: "ダッシュボード", icon: <Command className="w-4 h-4" /> },
    { id: "sound", label: "音確認", icon: <Ear className="w-4 h-4" /> },
    { id: "settings", label: "設定", icon: <Settings className="w-4 h-4" /> },
  ]

  const activeNavItem = navItems.find(item => item.id === activeSection)

  const getPageInfo = () => {
    switch (activeSection) {
      case "dashboard": return { title: "ダッシュボード" }
      case "sound": return { title: "音確認" }
      case "settings": return { title: "設定" }
    }
  }

  const pageInfo = getPageInfo()

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar
        items={navItems}
        activeItem={activeSection}
        onItemChange={(id) => setActiveSection(id as typeof activeSection)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${
        sidebarCollapsed ? "ml-[73px]" : "ml-[192px]"
      }`}>
        <div className="max-w-6xl mx-auto px-8 pb-8" style={{ paddingTop: "22px" }}>
          {/* Page title */}
          <div className="mb-3">
            <div className="flex items-center gap-3">
              {activeNavItem && (
                <span className="text-zinc-400" style={{ display: "inline-flex", transform: "scale(1.4)", transformOrigin: "center" }}>
                  {activeNavItem.icon}
                </span>
              )}
              <h2 className="font-extrabold text-zinc-800" style={{ fontSize: "19px" }}>{pageInfo.title}</h2>
            </div>
          </div>

          {/* Content area */}
          <div>
            {/* Dashboard */}
            {activeSection === "dashboard" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 接続端末 */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">接続端末</span>
                  </div>
                  <div className="space-y-2">
                    {devicesStatus.map((device) => (
                      <div key={device.name} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-700 font-medium">{device.name}</span>
                        {device.online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                            Offline
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 稼働音状況 */}
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">稼働音状況</span>
                  </div>
                  <div className="h-32 flex items-center justify-center text-sm text-zinc-400">
                    データを蓄積中...
                  </div>
                </div>
              </div>
            )}

            {/* 音確認 */}
            {activeSection === "sound" && (
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl overflow-hidden">
                {/* ヘッダー: フィルタ */}
                <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-b border-zinc-200/60">
                  <div className="flex items-center gap-2">
                    {([["all", "すべて"], ["normal", "正常"], ["anomaly", "異常"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setAudioFilter(val)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          audioFilter === val
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {audioLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                    <select
                      value={audioPeriod}
                      onChange={(e) => setAudioPeriod(e.target.value as typeof audioPeriod)}
                      className="px-2 py-1 bg-transparent text-xs text-zinc-500 focus:outline-none cursor-pointer"
                    >
                      <option value="all">全期間</option>
                      <option value="today">24時間</option>
                      <option value="3d">3日間</option>
                      <option value="7d">7日間</option>
                      <option value="30d">30日間</option>
                    </select>
                    <select
                      value={audioPageSize}
                      onChange={(e) => setAudioPageSize(Number(e.target.value))}
                      className="px-2 py-1 bg-transparent text-xs text-zinc-500 focus:outline-none cursor-pointer"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>{n}件</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* データ一覧 */}
                <div className="px-6">
                  {filteredAudioItems.length === 0 ? (
                    <div className="py-16 text-sm text-zinc-400 text-center">
                      {audioItems.length === 0
                        ? "まだデータがありません。新しい録音が追加されると自動で表示されます。"
                        : "該当するデータがありません。"}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200/60">
                      {filteredAudioItems.map((it, idx) => (
                        <div key={`${it.key}-${idx}`} className="flex items-center gap-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-zinc-700 font-medium">{formatIsoLocal(it.lastModified)}</span>
                              {it.isAnomaly === true && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">異常検知</span>
                              )}
                              {it.isAnomaly === false && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">正常</span>
                              )}
                              {it.isAnomaly === undefined && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-200/60 text-zinc-400">未判定</span>
                              )}
                            </div>
                            {typeof it.reconstructionError === "number" && (
                              <div className="text-xs text-zinc-400 mt-1 font-mono">
                                異常度: {it.reconstructionError.toFixed(2)} / 閾値: {it.inferenceThreshold?.toFixed(2) ?? "5.00"}
                              </div>
                            )}
                          </div>
                          <div className="w-[280px] flex-shrink-0">
                            <audio controls src={it.url} preload="metadata" className="w-full h-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* フッター: ページネーション */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200/60 text-xs text-zinc-400">
                  <span>ページ {audioPage + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleAudioPrevPage}
                      disabled={audioPage === 0}
                      className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleAudioNextPage}
                      disabled={!audioNextCursor}
                      className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 設定 */}
            {activeSection === "settings" && (
              <div className="space-y-4">
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-6 py-5">
                  <RecorderSettings />
                </div>
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-6 py-5">
                  <InferenceSettings />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Recorder Settings ───────────────────────────────────────

type RecorderConfig = {
  enabled: boolean
  intervalSec: number
  scheduleStartHour: number
  scheduleEndHour: number
  bucket: string
  prefix: string
  appliedAt?: number
}

type SendStatus = "idle" | "sending" | "waiting" | "confirmed" | "error"

function RecorderSettings() {
  const [enabled, setEnabled] = useState(false)
  const [intervalSec, setIntervalSec] = useState(3600)
  const [startHour, setStartHour] = useState(0)
  const [endHour, setEndHour] = useState(24)
  const [bucket, setBucket] = useState("recordings-kawasaki-city")
  const [prefix, setPrefix] = useState("phase1")
  const [loading, setLoading] = useState(true)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [prevAppliedAt, setPrevAppliedAt] = useState<number>(0)
  const [appliedConfig, setAppliedConfig] = useState<RecorderConfig | null>(null)

  // 初回: デバイスの現在設定を取得
  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        const res = await fetch("/api/device/record-config?thing=kawasaki-ras-1", { cache: "no-store" })
        if (!res.ok || aborted) return
        const data = await res.json()
        if (data.config) {
          const c = data.config as RecorderConfig
          setEnabled(c.enabled)
          setIntervalSec(c.intervalSec)
          setStartHour(c.scheduleStartHour)
          setEndHour(c.scheduleEndHour)
          setBucket(c.bucket || "recordings-kawasaki-city")
          setPrefix(c.prefix || "phase1")
          setAppliedConfig(c)
        }
      } catch { /* ignore */ }
      finally { if (!aborted) setLoading(false) }
    }
    load()
    return () => { aborted = true }
  }, [])

  // ACK ポーリング（送信後のみ）
  useEffect(() => {
    if (sendStatus !== "waiting") return
    let aborted = false
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/device/record-config?thing=kawasaki-ras-1", { cache: "no-store" })
        if (!res.ok || aborted) return
        const data = await res.json()
        if (data.config?.appliedAt && data.config.appliedAt !== prevAppliedAt) {
          setAppliedConfig(data.config)
          setSendStatus("confirmed")
          setTimeout(() => setSendStatus("idle"), 4000)
        }
      } catch { /* ignore */ }
    }, 2000)

    // 30秒でタイムアウト
    const timeout = setTimeout(() => {
      if (!aborted) setSendStatus("error")
    }, 30000)

    return () => { aborted = true; clearInterval(poll); clearTimeout(timeout) }
  }, [sendStatus, prevAppliedAt])

  async function handleSend() {
    setSendStatus("sending")
    // 送信前の appliedAt を記録（デバイス時計ずれ対策: appliedAt の変化で ACK を検出）
    setPrevAppliedAt(appliedConfig?.appliedAt ?? 0)
    try {
      const res = await fetch("/api/device/record-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thing: "kawasaki-ras-1",
          enabled,
          intervalSec,
          scheduleStartHour: startHour,
          scheduleEndHour: endHour,
          bucket,
          prefix,
        }),
      })
      if (res.ok) {
        setSendStatus("waiting")
      } else {
        setSendStatus("error")
      }
    } catch {
      setSendStatus("error")
    }
  }

  const intervalOptions = [
    { label: "1分", value: 60 },
    { label: "5分", value: 300 },
    { label: "10分", value: 600 },
    { label: "30分", value: 1800 },
    { label: "1時間", value: 3600 },
    { label: "3時間", value: 10800 },
  ]

  const hours = Array.from({ length: 25 }, (_, i) => i)

  const statusLabel = () => {
    switch (sendStatus) {
      case "sending": return { text: "送信中...", color: "text-zinc-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> }
      case "waiting": return { text: "デバイス応答待ち...", color: "text-amber-600", icon: <Loader2 className="h-4 w-4 animate-spin" /> }
      case "confirmed": return { text: "設定完了", color: "text-emerald-600", icon: <CheckIcon className="h-4 w-4" /> }
      case "error": return { text: "応答なし — デバイスがオフラインの可能性があります", color: "text-red-500", icon: <AlertCircle className="h-4 w-4" /> }
      default: return null
    }
  }

  const status = statusLabel()

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        <Mic className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">録音設定</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中...
        </div>
      ) : (
        <div className="space-y-5 max-w-lg">
          {/* 録音オンオフ */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-zinc-700 font-medium flex items-center gap-2">
                <Power className="h-3.5 w-3.5" />
                録音
              </label>
              <p className="text-xs text-zinc-400 mt-0.5">オンにするとスケジュールに従って録音を開始します</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                enabled ? "bg-violet-600" : "bg-zinc-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* 録音間隔 */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              録音間隔
            </label>
            <select
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* スケジュール */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">録音スケジュール（日本時間）</label>
            <div className="flex items-center gap-3">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
              >
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
              <span className="text-sm text-zinc-400">〜</span>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
              >
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>{h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-400">0:00〜24:00 で終日録音</p>
          </div>

          {/* S3 アップロード先 */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">アップロード先 (S3)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 flex-shrink-0">s3://</span>
              <input
                type="text"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                placeholder="bucket-name"
                className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
              />
              <span className="text-xs text-zinc-400 flex-shrink-0">/</span>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="prefix"
                className="w-32 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
              />
              <span className="text-xs text-zinc-400 flex-shrink-0">/{"{thing}"}/ ...</span>
            </div>
          </div>

          {/* デバイス適用状況 */}
          {appliedConfig && sendStatus === "idle" && (
            <div className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
              現在のデバイス設定: {appliedConfig.enabled ? "録音ON" : "録音OFF"} /
              {intervalOptions.find(o => o.value === appliedConfig.intervalSec)?.label ?? `${appliedConfig.intervalSec}秒`} /
              {String(appliedConfig.scheduleStartHour).padStart(2, "0")}:00〜{appliedConfig.scheduleEndHour === 24 ? "24:00" : `${String(appliedConfig.scheduleEndHour).padStart(2, "0")}:00`} /
              s3://{appliedConfig.bucket}/{appliedConfig.prefix}/
              {appliedConfig.appliedAt ? ` (${new Date(appliedConfig.appliedAt).toLocaleString("ja-JP")})` : ""}
            </div>
          )}

          {/* 送信ボタン + ステータス */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSend}
              disabled={sendStatus === "sending" || sendStatus === "waiting"}
              className="inline-flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 active:bg-violet-700 text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendStatus === "sending" || sendStatus === "waiting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sendStatus === "confirmed" ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              デバイスに送信
            </button>

            {status && (
              <span className={`inline-flex items-center gap-1.5 text-sm ${status.color}`}>
                {status.icon}
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inference Settings ─────────────────────────────────────

function InferenceSettings() {
  type ModelInfo = { key: string; size?: number; lastModified?: string }

  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [threshold, setThreshold] = useState(5.0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        const [configRes, modelsRes] = await Promise.all([
          fetch("/api/inference/config", { cache: "no-store" }),
          fetch("/api/inference/models", { cache: "no-store" }),
        ])
        if (aborted) return
        if (configRes.ok) {
          const cfg = await configRes.json()
          setSelectedModel(cfg.modelS3Key ?? "")
          setThreshold(cfg.anomalyThreshold ?? 5.0)
        }
        if (modelsRes.ok) {
          const data = await modelsRes.json()
          setModels(data.models ?? [])
        }
      } catch (e) {
        console.error("Failed to load inference settings", e)
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/inference/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelS3Key: selectedModel, anomalyThreshold: threshold }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e) {
      console.error("Failed to save config", e)
    } finally {
      setSaving(false)
    }
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ""
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        <Brain className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">クラウド推論設定</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中...
        </div>
      ) : (
        <div className="space-y-5 max-w-lg">
          {/* モデル選択 */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 block">推論モデル</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            >
              {models.length === 0 && <option value="">モデルが見つかりません</option>}
              {models.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.key.replace("models/", "")}{m.size ? ` (${formatSize(m.size)})` : ""}
                </option>
              ))}
            </select>
            {selectedModel && (
              <div className="text-xs text-zinc-400 font-mono">
                s3://recordings-kawasaki-city/{selectedModel}
              </div>
            )}
          </div>

          {/* 閾値スライダー */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-500">異常判定閾値 (MSE)</label>
              <span className="text-sm font-mono text-zinc-800 font-semibold">{threshold.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>0.5 (厳しい)</span>
              <span>20.0 (緩い)</span>
            </div>
          </div>

          {/* 保存ボタン */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedModel}
            className="inline-flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 active:bg-violet-700 text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "保存しました" : "設定を保存"}
          </button>
        </div>
      )}
    </div>
  )
}
