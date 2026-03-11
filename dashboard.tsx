"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  Activity,
  AlertCircle,
  Brain,
  Check as CheckIcon,
  CheckCircle2,
  Command,
  Ear,
  Hexagon,
  Loader2,
  LogOut,
  PanelLeftClose,
  Save,
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

  // 最新10件の音声リスト取得（10秒ポーリング）
  useEffect(() => {
    let aborted = false
    async function fetchLatest() {
      try {
        const res = await fetch("/api/audio/latest", { cache: "no-store" })
        if (!res.ok) return
        const data: { items?: AudioItem[] } = await res.json()
        if (!aborted && Array.isArray(data.items)) setAudioItems(data.items)
      } catch { /* ignore */ }
    }
    fetchLatest()
    const t = setInterval(fetchLatest, 10000)
    return () => { aborted = true; clearInterval(t) }
  }, [])

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
          <div className="bg-zinc-100 rounded-2xl px-6 pb-6 pt-5">
            {/* Dashboard */}
            {activeSection === "dashboard" && (
              <div className="space-y-5">
                {/* センサー＋アラート横並び */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">接続センサー</span>
                      <Server className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <div className="space-y-2">
                      {devicesStatus.map((device) => (
                        <div key={device.name} className="flex items-center justify-between">
                          <span className="text-sm text-zinc-700">{device.name}</span>
                          {device.online ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                              Offline
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">アラート</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      <span>異常は検出されていません &mdash; 設備は正常に稼働しています。</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-200" />

                {/* チャート */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Activity className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">稼働音状況</span>
                  </div>
                  <div className="h-40 flex items-center justify-center text-sm text-zinc-400">
                    データを蓄積中...
                  </div>
                </div>
              </div>
            )}

            {/* 音確認 */}
            {activeSection === "sound" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">録音データ</span>
                  <span className="text-xs text-zinc-400">{audioItems.length} 件</span>
                </div>
                {audioItems.length === 0 ? (
                  <div className="py-12 text-sm text-zinc-400 text-center">
                    まだデータがありません。新しい録音が追加されると自動で表示されます。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {audioItems.map((it, idx) => (
                      <div key={`${it.key}-${idx}`} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white border border-zinc-200">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-700 font-medium">{formatIsoLocal(it.lastModified)}</span>
                            {it.isAnomaly === true && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-50 text-red-600">異常検知</span>
                            )}
                            {it.isAnomaly === false && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">正常</span>
                            )}
                            {it.isAnomaly === undefined && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-200/60 text-zinc-400">未判定</span>
                            )}
                          </div>
                          {typeof it.reconstructionError === "number" && (
                            <div className="text-xs text-zinc-400 mt-0.5 font-mono">
                              MSE: {it.reconstructionError.toFixed(4)} / 閾値: {it.inferenceThreshold?.toFixed(1) ?? "5.0"}
                            </div>
                          )}
                        </div>
                        <div className="w-[280px] flex-shrink-0">
                          <audio controls src={it.url} preload="none" className="w-full h-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 設定 */}
            {activeSection === "settings" && <InferenceSettings />}
          </div>
        </div>
      </main>
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
