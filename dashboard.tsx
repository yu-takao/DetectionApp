"use client"

import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Brain,
  Check as CheckIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Command,
  Ear,
  Hexagon,
  Loader2,
  LogOut,
  Mic,
  Plus,
  Save,
  Send,
  Server,
  Settings,
  Trash2,
  TrendingUp,
  User,
  Wifi,
  WifiOff,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts"

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
  const { user, logout } = useAuth()
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
          <h1 className="text-xs font-bold text-white ml-2.5 whitespace-nowrap">OtoMoni</h1>
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
                <p className="text-[11px] font-medium text-white truncate">{user?.username || ""}</p>
                <p className="text-[9px] text-zinc-500 truncate">{user?.isAdmin ? "管理者" : "ユーザー"}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
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
  const { user } = useAuth()
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
  const [audioFilter, setAudioFilter] = useState<"all" | "normal" | "anomaly">("all")
  const [audioPageSize, setAudioPageSize] = useState(10)
  const [audioPage, setAudioPage] = useState(0)

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

  // 現在の閾値（APIから取得、表示判定に使用）
  const [currentThreshold, setCurrentThreshold] = useState(5.0)
  // 現在の閾値で再評価する関数
  const isAnomalyNow = useCallback((it: AudioItem) => {
    if (typeof it.reconstructionError !== "number") return undefined
    return it.reconstructionError >= currentThreshold
  }, [currentThreshold])

  // Dashboard: チャート + 音確認用データ
  const [dashItems, setDashItems] = useState<AudioItem[]>([])
  const [dashLoading, setDashLoading] = useState(false)
  const [dashPeriod, setDashPeriod] = useState<"today" | "3d">("3d")

  const fetchDashData = useCallback(async () => {
    setDashLoading(true)
    try {
      const now = Date.now()
      const days = dashPeriod === "today" ? 1 : 3
      const from = now - days * 24 * 60 * 60 * 1000
      const q = new URLSearchParams({ chart: "1", from: String(from), to: String(now) })
      const res = await fetch(`/api/audio/latest?${q}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.items)) setDashItems(data.items)
      if (typeof data.currentThreshold === "number") setCurrentThreshold(data.currentThreshold)
    } catch { /* ignore */ }
    finally { setDashLoading(false) }
  }, [dashPeriod])

  useEffect(() => {
    fetchDashData()
  }, [fetchDashData])

  useEffect(() => {
    const t = setInterval(fetchDashData, 30000)
    return () => clearInterval(t)
  }, [fetchDashData])

  // Dashboard stats (現在の閾値で再評価)
  const dashStats = useMemo(() => {
    const withScore = dashItems.filter(it => typeof it.reconstructionError === "number")
    const anomalies = withScore.filter(it => it.reconstructionError! >= currentThreshold)
    return { anomalies: anomalies.length }
  }, [dashItems, currentThreshold])

  // SMS通知: 新しい異音が検出されたら送信
  const notifiedKeysRef = useRef<Set<string>>(new Set())
  const smsSendingRef = useRef(false)
  useEffect(() => {
    const anomalies = dashItems.filter(it =>
      typeof it.reconstructionError === "number" && it.reconstructionError >= currentThreshold
    )
    const newAnomalies = anomalies.filter(it => !notifiedKeysRef.current.has(it.key))
    if (newAnomalies.length === 0 || smsSendingRef.current) return
    // 初回ロード時は通知せずキーだけ記録
    if (notifiedKeysRef.current.size === 0 && anomalies.length > 0) {
      anomalies.forEach(it => notifiedKeysRef.current.add(it.key))
      return
    }
    smsSendingRef.current = true
    const maxError = Math.max(...newAnomalies.map(it => it.reconstructionError!))
    fetch("/api/notification/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anomalyCount: newAnomalies.length, maxError, threshold: currentThreshold }),
    }).catch(() => {}).finally(() => { smsSendingRef.current = false })
    newAnomalies.forEach(it => notifiedKeysRef.current.add(it.key))
  }, [dashItems, currentThreshold])

  // Chart data (chronological order, 現在の閾値で再評価)
  const chartData = useMemo(() => {
    return dashItems
      .filter(it => typeof it.reconstructionError === "number")
      .map(it => ({
        time: new Date(it.lastModified!).getTime(),
        label: new Date(it.lastModified!).toLocaleString("ja-JP", {
          month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
        }),
        score: Number(it.reconstructionError!.toFixed(2)),
        isAnomaly: it.reconstructionError! >= currentThreshold,
      }))
      .sort((a, b) => a.time - b.time)
  }, [dashItems, currentThreshold])

  // Anomaly items for list (現在の閾値で再評価, newest first)
  const anomalyItems = useMemo(() => {
    return dashItems.filter(it =>
      typeof it.reconstructionError === "number" && it.reconstructionError >= currentThreshold
    )
  }, [dashItems, currentThreshold])

  // 音確認: dashItems をフィルタしてクライアント側ページネーション
  const filteredAudioItems = useMemo(() => {
    return dashItems.filter((it) => {
      if (audioFilter === "all") return true
      if (typeof it.reconstructionError !== "number") return false
      const isAnomaly = it.reconstructionError >= currentThreshold
      if (audioFilter === "anomaly") return isAnomaly
      return !isAnomaly
    })
  }, [dashItems, audioFilter, currentThreshold])

  const dashDateRange = useMemo(() => {
    if (dashItems.length === 0) return ""
    const dates = dashItems.map(it => new Date(it.lastModified!).getTime()).filter(t => !isNaN(t))
    if (dates.length === 0) return ""
    const fmt = (t: number) => new Date(t).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })
    return `${fmt(Math.min(...dates))}〜${fmt(Math.max(...dates))}`
  }, [dashItems])

  const totalAudioPages = Math.max(1, Math.ceil(filteredAudioItems.length / audioPageSize))
  const pagedAudioItems = filteredAudioItems.slice(audioPage * audioPageSize, (audioPage + 1) * audioPageSize)

  // フィルタ変更時にページリセット
  useEffect(() => { setAudioPage(0) }, [audioFilter, audioPageSize])

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
    ...(user?.isAdmin ? [{ id: "settings" as const, label: "設定", icon: <Settings className="w-4 h-4" /> }] : []),
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
              <div className="space-y-4">
                {/* Main layout: left sidebar + trend chart */}
                <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
                  {/* Left column: 接続端末 + 異音検出 */}
                  <div className="flex flex-col gap-3">
                    {/* 接続端末 */}
                    <div className="bg-zinc-50 rounded-2xl px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">接続端末</span>
                        {devicesStatus[0]?.online ? (
                          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-3.5 w-3.5 text-zinc-300" />
                        )}
                      </div>
                      {devicesStatus.map((device) => (
                        <div key={device.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${device.online ? "bg-emerald-500 animate-pulse" : "bg-zinc-300"}`} />
                            <span className="text-sm font-medium text-zinc-700">{device.name}</span>
                          </div>
                          <span className={`text-[11px] ${device.online ? "text-emerald-600" : "text-zinc-400"}`}>
                            {device.online ? "Active" : "Offline"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 異音検出ヘキサゴン */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative w-full" style={{ aspectRatio: "100/115" }}>
                        <svg viewBox="0 0 100 115" className="w-full h-full drop-shadow-sm">
                          <polygon
                            points="50,2 95,28 95,87 50,113 5,87 5,28"
                            className={dashStats.anomalies > 0 ? "fill-red-50 stroke-red-300" : "fill-emerald-50 stroke-emerald-300"}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-xs font-semibold uppercase tracking-wider ${dashStats.anomalies > 0 ? "text-red-400" : "text-emerald-500"}`}>異音検出</span>
                          <span className={`text-4xl font-bold leading-none mt-1.5 ${dashStats.anomalies > 0 ? "text-red-600" : "text-emerald-600"}`}>{dashStats.anomalies}<span className="text-base font-medium ml-0.5">件</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column: Trend chart */}
                  <div className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">異常度トレンド</span>
                      {dashLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {(["today", "3d"] as const).map((p) => {
                        const labels = { today: "24h", "3d": "3日" }
                        return (
                          <button
                            key={p}
                            onClick={() => setDashPeriod(p)}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                              dashPeriod === p
                                ? "bg-zinc-800 text-white"
                                : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                            }`}
                          >
                            {labels[p]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    {chartData.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-sm text-zinc-400">
                        この期間のデータがありません
                      </div>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10, fill: "#a1a1aa" }}
                              axisLine={{ stroke: "#e4e4e7" }}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: "#a1a1aa" }}
                              axisLine={false}
                              tickLine={false}
                              domain={[0, 10]} allowDataOverflow={true}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#18181b",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "12px",
                                color: "#fff",
                                padding: "8px 12px",
                              }}
                              formatter={(value: number) => [`${value.toFixed(2)}`, "異常度"]}
                              labelStyle={{ color: "#a1a1aa", fontSize: "11px" }}
                            />
                            <ReferenceLine
                              y={currentThreshold}
                              stroke="#ef4444"
                              strokeDasharray="6 3"
                              strokeWidth={1.5}
                              label={{
                                value: `閾値 ${currentThreshold.toFixed(1)}`,
                                position: "right",
                                fill: "#ef4444",
                                fontSize: 10,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="score"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              fill="url(#scoreGrad)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props
                                if (payload.isAnomaly) {
                                  return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                                }
                                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={2.5} fill="#8b5cf6" stroke="none" />
                              }}
                              activeDot={{ r: 5, stroke: "#8b5cf6", strokeWidth: 2, fill: "#fff" }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
                </div>

                {/* Row 3: Anomaly list (異音がある場合のみ表示) */}
                {anomalyItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-1 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">検出された異音</span>
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{anomalyItems.length}</span>
                    </div>
                    <div className="space-y-2">
                      {anomalyItems.map((it, idx) => (
                        <div key={`anomaly-${it.key}-${idx}`} className="flex items-center gap-4 px-4 py-3 bg-red-50/60 rounded-xl">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-zinc-700 font-medium">{formatIsoLocal(it.lastModified)}</span>
                            {typeof it.reconstructionError === "number" && (
                              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                                異常度: <span className="text-red-500 font-semibold">{it.reconstructionError.toFixed(2)}</span> / 閾値: {currentThreshold.toFixed(2)}
                              </p>
                            )}
                          </div>
                          {it.url && (
                            <div className="w-[240px] flex-shrink-0">
                              <audio controls src={it.url} preload="metadata" className="w-full h-8" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 音確認 */}
            {activeSection === "sound" && (
              <div>
                {/* ヘッダー: フィルタ */}
                <div className="flex items-center justify-between gap-3 px-2 py-3.5">
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
                    {dashLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                    <span className="text-xs text-zinc-400">{dashDateRange} / {filteredAudioItems.length}件</span>
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
                <div className="bg-zinc-50 rounded-2xl px-6">
                  {pagedAudioItems.length === 0 ? (
                    <div className="py-16 text-sm text-zinc-400 text-center">
                      {dashItems.length === 0
                        ? "まだデータがありません。新しい録音が追加されると自動で表示されます。"
                        : "該当するデータがありません。"}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200/60">
                      {pagedAudioItems.map((it, idx) => {
                        const anomaly = isAnomalyNow(it)
                        return (
                        <div key={`${it.key}-${idx}`} className="flex items-center gap-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-zinc-700 font-medium">{formatIsoLocal(it.lastModified)}</span>
                              {anomaly === true && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">異常検知</span>
                              )}
                              {anomaly === false && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">正常</span>
                              )}
                              {anomaly === undefined && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-200/60 text-zinc-400">未判定</span>
                              )}
                            </div>
                            {typeof it.reconstructionError === "number" && (
                              <div className="text-xs text-zinc-400 mt-1 font-mono">
                                異常度: {it.reconstructionError.toFixed(2)} / 閾値: {currentThreshold.toFixed(2)}
                              </div>
                            )}
                          </div>
                          <div className="w-[280px] flex-shrink-0">
                            <audio controls src={`/api/audio/stream?key=${encodeURIComponent(it.key)}`} preload="none" className="w-full h-8" />
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* フッター: ページネーション */}
                <div className="flex items-center justify-between px-2 py-3 text-xs text-zinc-400">
                  <span>ページ {audioPage + 1} / {totalAudioPages}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAudioPage(p => p - 1)}
                      disabled={audioPage === 0}
                      className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setAudioPage(p => p + 1)}
                      disabled={audioPage >= totalAudioPages - 1}
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
              <div className="space-y-6">
                <RecorderSettings />
                <InferenceSettings />
                <NotificationSettings />
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

function SettingRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 border-b border-zinc-100 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-zinc-700">{label}</p>
        {description && <p className="text-[11px] text-zinc-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

const selectClass = "px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-700 text-[13px] focus:outline-none focus:ring-1 focus:ring-zinc-400/40 focus:border-zinc-400 transition-colors"
const inputClass = "px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-700 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400/40 focus:border-zinc-400 transition-colors"

function RecorderSettings() {
  const [enabled, setEnabled] = useState(false)
  const [intervalSec, setIntervalSec] = useState(3600)
  const [startHour, setStartHour] = useState(0)
  const [endHour, setEndHour] = useState(24)
  const [bucket, setBucket] = useState("recordings-kawasaki-city")
  const [prefix, setPrefix] = useState("phase1")
  const [loading, setLoading] = useState(true)
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle")
  const [sendErrorDetail, setSendErrorDetail] = useState<string>("")
  const [prevAppliedAt, setPrevAppliedAt] = useState<number>(0)
  const [appliedConfig, setAppliedConfig] = useState<RecorderConfig | null>(null)

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
    const timeout = setTimeout(() => {
      if (!aborted) setSendStatus("error")
    }, 30000)
    return () => { aborted = true; clearInterval(poll); clearTimeout(timeout) }
  }, [sendStatus, prevAppliedAt])

  async function handleSend() {
    setSendStatus("sending")
    setSendErrorDetail("")
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
        const data = await res.json().catch(() => ({}))
        const dbg = data.debug ? ` [${JSON.stringify(data.debug)}]` : ""
        setSendErrorDetail((data.error || `HTTP ${res.status}`) + dbg)
        setSendStatus("error")
      }
    } catch (e: any) {
      setSendErrorDetail(e?.message || "Network error")
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

  const hasChanges = appliedConfig ? (
    enabled !== appliedConfig.enabled ||
    intervalSec !== appliedConfig.intervalSec ||
    startHour !== appliedConfig.scheduleStartHour ||
    endHour !== appliedConfig.scheduleEndHour ||
    bucket !== (appliedConfig.bucket || "recordings-kawasaki-city") ||
    prefix !== (appliedConfig.prefix || "phase1")
  ) : true

  const statusConfig: Record<string, { text: string; color: string; bg: string; icon: ReactNode } | null> = {
    sending: { text: "送信中...", color: "text-zinc-500", bg: "bg-zinc-50 border-zinc-200", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    waiting: { text: "デバイス応答待ち...", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    confirmed: { text: "デバイスに適用されました", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckIcon className="h-3.5 w-3.5" /> },
    error: { text: sendErrorDetail ? `エラー: ${sendErrorDetail}` : "応答なし — デバイスがオフラインの可能性があります", color: "text-red-500", bg: "bg-red-50 border-red-200", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  }
  const status = statusConfig[sendStatus] ?? null

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
        <Mic className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">録音設定</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 py-12">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中...
        </div>
      ) : (
        <div className="px-6">
          <SettingRow label="録音" description="スケジュールに従って録音を実行">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${enabled ? "bg-violet-500" : "bg-zinc-300"}`}
            >
              <span className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-[18px]" : "translate-x-0"}`} />
            </button>
          </SettingRow>

          <SettingRow label="録音間隔">
            <select value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} className={selectClass}>
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label="スケジュール" description="日本時間 (0:00〜24:00 で終日)">
            <div className="flex items-center gap-2">
              <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={selectClass}>
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
              <span className="text-xs text-zinc-400">〜</span>
              <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={selectClass}>
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>{h === 24 ? "24:00" : `${String(h).padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </div>
          </SettingRow>

          <SettingRow label="アップロード先" description="S3 バケット / プレフィックス">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">s3://</span>
              <input type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} className={`${inputClass} w-40`} />
              <span className="text-[11px] text-zinc-400">/</span>
              <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${inputClass} w-20`} />
              <span className="text-[11px] text-zinc-400">/</span>
            </div>
          </SettingRow>

          {/* Footer: status + send button */}
          <div className="py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              {status ? (
                <span className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg border ${status.bg} ${status.color}`}>
                  {status.icon}{status.text}
                </span>
              ) : appliedConfig?.appliedAt ? (
                <span className="text-[11px] text-zinc-400">
                  最終適用: {new Date(appliedConfig.appliedAt).toLocaleString("ja-JP")}
                </span>
              ) : null}
            </div>
            <button
              onClick={handleSend}
              disabled={!hasChanges || sendStatus === "sending" || sendStatus === "waiting"}
              className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-[13px] font-medium bg-violet-500 hover:bg-violet-400 active:scale-[0.97] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendStatus === "sending" || sendStatus === "waiting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              デバイスに送信
            </button>
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
  const [initialModel, setInitialModel] = useState("")
  const [initialThreshold, setInitialThreshold] = useState(5.0)
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
          setInitialModel(cfg.modelS3Key ?? "")
          setThreshold(cfg.anomalyThreshold ?? 5.0)
          setInitialThreshold(cfg.anomalyThreshold ?? 5.0)
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
        setInitialModel(selectedModel)
        setInitialThreshold(threshold)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e) {
      console.error("Failed to save config", e)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = selectedModel !== initialModel || Math.abs(threshold - initialThreshold) > 0.01

  const formatSize = (bytes?: number) => {
    if (!bytes) return ""
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
        <Brain className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">クラウド推論設定</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 py-12">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中...
        </div>
      ) : (
        <div className="px-6">
          <SettingRow label="推論モデル" description={selectedModel ? `s3://…/${selectedModel}` : undefined}>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className={`${selectClass} max-w-[220px]`}>
              {models.length === 0 && <option value="">モデルが見つかりません</option>}
              {models.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.key.replace("models/", "")}{m.size ? ` (${formatSize(m.size)})` : ""}
                </option>
              ))}
            </select>
          </SettingRow>

          {/* 閾値 */}
          <div className="py-3.5 border-b border-zinc-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[13px] font-medium text-zinc-700">異常判定閾値</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">再構成誤差 (MSE) がこの値以上で異常と判定</p>
              </div>
              <span className="text-sm font-mono font-semibold text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-md">{threshold.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-400 flex-shrink-0 w-8 text-right">0.5</span>
              <input
                type="range"
                min="0.5"
                max="20"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="flex-1 accent-violet-500"
              />
              <span className="text-[10px] text-zinc-400 flex-shrink-0 w-8">20.0</span>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1 px-11">
              <span>厳しい</span>
              <span>緩い</span>
            </div>
          </div>

          {/* Footer */}
          <div className="py-4 flex items-center justify-between">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <CheckIcon className="h-3.5 w-3.5" />保存しました
              </span>
            ) : <span />}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || !selectedModel}
              className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-[13px] font-medium bg-violet-500 hover:bg-violet-400 active:scale-[0.97] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              設定を保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Notification Settings ──────────────────────────────────

function NotificationSettings() {
  const [enabled, setEnabled] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([""])
  const [cooldownMinutes, setCooldownMinutes] = useState(5)
  const [initialEnabled, setInitialEnabled] = useState(false)
  const [initialPhoneNumbers, setInitialPhoneNumbers] = useState<string[]>([""])
  const [initialCooldown, setInitialCooldown] = useState(5)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        const res = await fetch("/api/notification/config", { cache: "no-store" })
        if (!res.ok || aborted) return
        const cfg = await res.json()
        const nums = cfg.phoneNumbers?.length ? cfg.phoneNumbers : [""]
        setEnabled(cfg.enabled ?? false)
        setPhoneNumbers(nums)
        setCooldownMinutes(cfg.cooldownMinutes ?? 5)
        setInitialEnabled(cfg.enabled ?? false)
        setInitialPhoneNumbers(nums)
        setInitialCooldown(cfg.cooldownMinutes ?? 5)
      } catch { /* ignore */ }
      finally { if (!aborted) setLoading(false) }
    }
    load()
    return () => { aborted = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const numbers = phoneNumbers.filter((p) => p.trim())
      const res = await fetch("/api/notification/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, phoneNumbers: numbers, cooldownMinutes }),
      })
      if (res.ok) {
        const saved = numbers.length ? numbers : [""]
        setInitialEnabled(enabled)
        setInitialPhoneNumbers(saved)
        setInitialCooldown(cooldownMinutes)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e) {
      console.error("Failed to save notification config", e)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    enabled !== initialEnabled ||
    cooldownMinutes !== initialCooldown ||
    JSON.stringify(phoneNumbers.filter((p) => p.trim())) !== JSON.stringify(initialPhoneNumbers.filter((p) => p.trim()))

  const addPhone = () => setPhoneNumbers([...phoneNumbers, ""])
  const removePhone = (idx: number) => setPhoneNumbers(phoneNumbers.filter((_, i) => i !== idx))
  const updatePhone = (idx: number, val: string) => {
    const next = [...phoneNumbers]
    next[idx] = val
    setPhoneNumbers(next)
  }

  const cooldownOptions = [
    { label: "1分", value: 1 },
    { label: "3分", value: 3 },
    { label: "5分", value: 5 },
    { label: "10分", value: 10 },
    { label: "30分", value: 30 },
    { label: "1時間", value: 60 },
  ]

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3.5 border-b border-zinc-100 bg-zinc-50/50">
        <Bell className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">SMS通知設定</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 py-12">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中...
        </div>
      ) : (
        <div className="px-6">
          <SettingRow label="SMS通知" description="異音検出時にSMSで通知">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${enabled ? "bg-violet-500" : "bg-zinc-300"}`}
            >
              <span className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-[18px]" : "translate-x-0"}`} />
            </button>
          </SettingRow>

          <SettingRow label="送信間隔" description="連続通知を防ぐクールダウン">
            <select value={cooldownMinutes} onChange={(e) => setCooldownMinutes(Number(e.target.value))} className={selectClass}>
              {cooldownOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </SettingRow>

          <div className="py-3.5 border-b border-zinc-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[13px] font-medium text-zinc-700">電話番号</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">国際形式で入力（例: +819012345678）</p>
              </div>
              <button onClick={addPhone} className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {phoneNumbers.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    placeholder="+819012345678"
                    className={`${inputClass} flex-1`}
                  />
                  {phoneNumbers.length > 1 && (
                    <button onClick={() => removePhone(idx)} className="p-1.5 rounded-md hover:bg-red-50 text-zinc-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="py-4 flex items-center justify-between">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <CheckIcon className="h-3.5 w-3.5" />保存しました
              </span>
            ) : <span />}
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-[13px] font-medium bg-violet-500 hover:bg-violet-400 active:scale-[0.97] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              設定を保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
