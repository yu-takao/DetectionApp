"use client"

import { useEffect, useState, useRef } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  CircleOff,
  Command,
  Cpu,
  Server,
  Download,
  Globe,
  HardDrive,
  Hexagon,
  LineChart,
  Lock,
  type LucideIcon,
  type LucideProps,
  MessageSquare,
  Bot,
  Speaker,
  Mic,
  Ear,
  Timer,
  Moon,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sun,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"

export default function Dashboard() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  

  
  const [devicesStatus, setDevicesStatus] = useState([
    { name: "センサー 1", online: true },
  ])
  
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<"dashboard" | "ai" | "settings" | "sound" | "capture">("dashboard")
  const [uploading, setUploading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  // Update time
  useEffect(() => {
    // 初回のみクライアントサイドで時間を設定
    setCurrentTime(new Date())
    
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Heartbeat: センサー1の死活取得（15秒ポーリング）
  useEffect(() => {
    let aborted = false

    async function fetchHeartbeat() {
      try {
        const res = await fetch(`/api/heartbeat?thing=kawasaki-ras-1`, { cache: "no-store" })
        if (!res.ok) {
          if (!aborted) {
            setDevicesStatus(prev => prev.map((d, idx) => idx === 0 ? { ...d, online: false } : d))
          }
          return
        }
        const data: { status: "Active" | "Offline" } = await res.json()
        if (aborted) return
        setDevicesStatus(prev => prev.map((d, idx) => idx === 0 ? { ...d, online: data.status === "Active" } : d))
      } catch {
        if (!aborted) {
          setDevicesStatus(prev => prev.map((d, idx) => idx === 0 ? { ...d, online: false } : d))
        }
      }
    }

    fetchHeartbeat()
    const t = setInterval(fetchHeartbeat, 15000)
    return () => { aborted = true; clearInterval(t) }
  }, [])

  // removed changing data
  useEffect(() => {
    const interval = setInterval(() => {
      
      
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Particle effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: Particle[] = []
    const particleCount = 100

    class Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      color: string

      constructor() {
        this.x = Math.random() * canvas!.width
        this.y = Math.random() * canvas!.height
        this.size = Math.random() * 3 + 1
        this.speedX = (Math.random() - 0.5) * 0.5
        this.speedY = (Math.random() - 0.5) * 0.5
        this.color = `rgba(${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 150}, ${Math.floor(Math.random() * 55) + 200}, ${Math.random() * 0.5 + 0.2})`
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x > canvas!.width) this.x = 0
        if (this.x < 0) this.x = canvas!.width
        if (this.y > canvas!.height) this.y = 0
        if (this.y < 0) this.y = canvas!.height
      }

      draw() {
        if (!ctx) return
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }

    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const particle of particles) {
        particle.update()
        particle.draw()
      }

      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Format time
  const formatTime = (date: Date | null) => {
    if (!date) return "--:--:--"
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  // Format date
  const formatDate = (date: Date | null) => {
    if (!date) return "---"
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div
      className={`${theme} min-h-screen bg-gradient-to-br from-black to-slate-900 text-slate-100 relative overflow-hidden`}
    >
      {/* Background particle effect */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
              <div className="absolute inset-2 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-4 border-r-purple-500 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow"></div>
              <div className="absolute inset-6 border-4 border-b-blue-500 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin-slower"></div>
              <div className="absolute inset-8 border-4 border-l-green-500 border-t-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
            </div>
            <div className="mt-4 text-cyan-500 font-mono text-sm tracking-wider">SYSTEM INITIALIZING</div>
          </div>
        </div>
      )}

      <div className="container mx-auto p-4 relative z-10">
        {/* Header */}
<header className="flex items-center py-4 border-b border-slate-700/50 mb-6">
          <div className="flex items-center space-x-2">
            <Hexagon className="h-8 w-8 text-cyan-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              SonicEye
            </span>
          </div>
        </header>

        {/* Main content */}
<div className="flex gap-6 justify-center">
  {/* Sidebar */}
  <div className="w-64 flex-shrink-0">
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm h-full">
      <CardContent className="p-4">
        <nav className="space-y-2">
          <NavItem icon={Command} label="ダッシュボード" active={activeSection==='dashboard'} onClick={() => setActiveSection('dashboard')} />
          <NavItem icon={Ear} label="音確認" active={activeSection==='sound'} onClick={() => setActiveSection('sound')} />
          <NavItem icon={Mic} label="録音" active={activeSection==='capture'} onClick={() => setActiveSection('capture')} />
          <NavItem icon={MessageSquare} label="AI アシスタント" active={activeSection==='ai'} onClick={() => setActiveSection('ai')} />
          <NavItem icon={Settings} label="設定" active={activeSection==='settings'} onClick={() => setActiveSection('settings')} />
        </nav>
      </CardContent>
    </Card>
  </div>

  {/* Main area */}
  <div className="max-w-4xl flex-1">
    {activeSection === 'dashboard' && (
      <div className="grid gap-6">
        {/* System overview */}
        <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="hidden">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100 flex items-center">
                <Activity className="mr-2 h-5 w-5 text-cyan-500" />
                System Overview
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-slate-800/50 text-cyan-400 border-cyan-500/50 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 mr-1 animate-pulse"></div>
                  LIVE
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1"><DeviceStatusCard devices={devicesStatus} /></div>
              {/* アラート */}
              <div className="md:col-span-2">
                <Card className="bg-slate-800/50 rounded-lg border from-purple-500 to-pink-500 border-purple-500/30 relative overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-slate-100 flex items-center text-base">
                      <AlertCircle className="mr-2 h-5 w-5 text-purple-500" />
                      アラート
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <AlertItem title="センサー１で異音が検出されました" time="09:12:45" description="左のアイコンを押して実際の音をご確認ください。" type="update" />
                      <AlertItem title="センサー１で異音が検出されました" time="04:02:55" description="左のアイコンを押して実際の音をご確認ください。" type="update" />
                    </div>
                  </CardContent>
                  <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-r opacity-20 blur-xl from-purple-500 to-pink-500"></div>
                </Card>
              </div>
            </div>

            <div className="mt-8">
              <Tabs defaultValue="hour" className="w-full">
                <div className="relative mb-4">
                  <TabsList className="bg-slate-800/50 p-1">
                    <TabsTrigger value="hour" className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400">時</TabsTrigger>
                    <TabsTrigger value="day" className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400">日</TabsTrigger>
                    <TabsTrigger value="week" className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400">週</TabsTrigger>
                  </TabsList>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-100 text-base font-semibold flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-cyan-500" />
                    <span>稼働音状況</span>
                  </div>
                </div>
                <TabsContent value="hour" className="mt-0">
                  <div className="h-64 w-full relative bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                    <PerformanceChart />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Security & Alerts (hidden) */}
        <div className="hidden">
          <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-100 flex items-center text-base">
                <AlertCircle className="mr-2 h-5 w-5 text-purple-500" />
                アラート
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <AlertItem title="Security Scan Complete" time="14:32:12" description="No threats detected in system scan" type="info" />
                <AlertItem title="Bandwidth Spike Detected" time="13:45:06" description="Unusual network activity on port 443" type="warning" />
                <AlertItem title="しきい値を超える異音が検出されました" time="09:12:45" description="Version 12.4.5 ready to install" type="update" />
                <AlertItem title="Backup Completed" time="04:30:00" description="Incremental backup to drive E: successful" type="success" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )}

    {activeSection === 'capture' && (
      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base flex items-center">
            <Mic className="mr-2 h-5 w-5 text-cyan-500" />録音（デバイスに指示）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecordTrigger thingName="kawasaki-1" />
        </CardContent>
      </Card>
    )}

    {activeSection === 'ai' && (
      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-100 flex items-center text-base">
            <MessageSquare className="mr-2 h-5 w-5 text-blue-500" />
            AIアシスタント ログ
          </CardTitle>
          <Badge variant="outline" className="bg-slate-800/50 text-blue-400 border-blue-500/50">新着 4 件</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <CommunicationItem sender="異音検知エンジン" time="20:00:00" message="センサー1で異音レベル6を検知（しきい値: 4）。録音の確認を推奨します。" avatar="/placeholder.svg?height=40&width=40" unread />
            <CommunicationItem sender="センサー1" time="19:58:10" message="直近5分の稼働音がベースラインから逸脱。周波数帯 2.1–2.4kHz に顕著なピークを検出。" avatar="/placeholder.svg?height=40&width=40" unread />
            <CommunicationItem sender="モデル管理" time="19:30:02" message="新しい異音パターン候補を検出。サンプル3件のラベル付けを提案します。" avatar="/placeholder.svg?height=40&width=40" unread />
            <CommunicationItem sender="メンテナンス" time="18:05:18" message="マイク感度を自動補正しました（+2dB）。次回校正は 2025-09-01 を予定。" avatar="/placeholder.svg?height=40&width=40" unread />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center w-full space-x-2">
            <input type="text" placeholder="メッセージを入力..." className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            <Button size="icon" className="bg-blue-600 hover:bg-blue-700"><Mic className="h-4 w-4" /></Button>
            <Button size="icon" className="bg-cyan-600 hover:bg-cyan-700"><MessageSquare className="h-4 w-4" /></Button>
          </div>
        </CardFooter>
      </Card>
    )}

    {activeSection === 'settings' && (
      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base">Environment Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Radio className="text-cyan-500 mr-2 h-4 w-4" />
                <Label className="text-sm text-slate-400">Power Management</Label>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Lock className="text-cyan-500 mr-2 h-4 w-4" />
                <Label className="text-sm text-slate-400">Security Protocol</Label>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="text-cyan-500 mr-2 h-4 w-4" />
                <Label className="text-sm text-slate-400">Power Saving Mode</Label>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CircleOff className="text-cyan-500 mr-2 h-4 w-4" />
                <Label className="text-sm text-slate-400">Auto Shutdown</Label>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>
    )}
  </div>
  {/* Right sidebar */}
          <div className="hidden">
            <div className="grid gap-6">
              {/* System time */}
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 border-b border-slate-700/50">
                    <div className="text-center">
                      <div className="text-xs text-slate-500 mb-1 font-mono">SYSTEM TIME</div>
                      <div className="text-3xl font-mono text-cyan-400 mb-1">{formatTime(currentTime)}</div>
                      <div className="text-sm text-slate-400">{formatDate(currentTime)}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
                        <div className="text-xs text-slate-500 mb-1">Uptime</div>
                        <div className="text-sm font-mono text-slate-200">14d 06:42:18</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
                        <div className="text-xs text-slate-500 mb-1">Time Zone</div>
                        <div className="text-sm font-mono text-slate-200">UTC-08:00</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick actions */}
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Shield} label="Security Scan" />
                    <ActionButton icon={RefreshCw} label="Sync Data" />
                    <ActionButton icon={Download} label="Backup" />
                    <ActionButton icon={Terminal} label="Console" />
                  </div>
                </CardContent>
              </Card>

              {/* Resource allocation */}
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-base">Resource Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-slate-400">Processing Power</div>
                        <div className="text-xs text-cyan-400">42% allocated</div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          style={{ width: "42%" }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-slate-400">Memory Allocation</div>
                        <div className="text-xs text-purple-400">68% allocated</div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{ width: "68%" }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-slate-400">Network Bandwidth</div>
                        <div className="text-xs text-blue-400">35% allocated</div>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                          style={{ width: "35%" }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-400">Priority Level</div>
                        <div className="flex items-center">
                          <Slider defaultValue={[3]} max={5} step={1} className="w-24 mr-2" />
                          <span className="text-cyan-400">3/5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Environment controls */}
              {false && (
              <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-base">Environment Controls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Radio className="text-cyan-500 mr-2 h-4 w-4" />
                        <Label className="text-sm text-slate-400">Power Management</Label>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Lock className="text-cyan-500 mr-2 h-4 w-4" />
                        <Label className="text-sm text-slate-400">Security Protocol</Label>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Zap className="text-cyan-500 mr-2 h-4 w-4" />
                        <Label className="text-sm text-slate-400">Power Saving Mode</Label>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <CircleOff className="text-cyan-500 mr-2 h-4 w-4" />
                        <Label className="text-sm text-slate-400">Auto Shutdown</Label>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
function RecordTrigger({ thingName }: { thingName: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [msg, setMsg] = useState<string>("")
  async function sendCommand() {
    try {
      setStatus("sending")
      setMsg("")
      const res = await fetch("/api/device/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing: thingName, delaySec: 5, durationSec: 10, ext: "flac" }),
      })
      if (!res.ok) throw new Error("failed")
      setStatus("sent")
      setMsg("デバイスに録音指示を送信しました。5秒後に10秒録音します。")
      toast.success("録音指示を送信しました")
    } catch {
      setStatus("error")
      setMsg("送信に失敗しました。")
      toast.error("録音指示の送信に失敗しました")
    }
  }
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-300">ラズパイへ録音コマンドを送信します（5秒後に10秒録音）。</div>
        <Badge variant="outline" className="bg-slate-800/50 text-cyan-400 border-cyan-500/50 text-xs">
          {status.toUpperCase()}
        </Badge>
      </div>
      <Button onClick={sendCommand} disabled={status === "sending"} className="bg-cyan-600 hover:bg-cyan-700">
        <Mic className="h-4 w-4 mr-2" /> 録音を指示
      </Button>
      {!!msg && <div className="text-sm text-slate-300 mt-3">{msg}</div>}
    </div>
  )
}

// Component for nav items
function NavItem({
  icon: Icon,
  label,
  active,
  href,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  href?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </>
  )

  if (href) {
    return (
      <Button
        asChild
        variant="ghost"
        className={`w-full justify-start ${active ? "bg-slate-800/70 text-cyan-400" : "text-slate-400 hover:text-slate-100"}`}
      >
        <Link href={href}>{content}</Link>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`w-full justify-start ${active ? "bg-slate-800/70 text-cyan-400" : "text-slate-400 hover:text-slate-100"}`}
    >
      {content}
    </Button>
  )
}

// Component for status items
function StatusItem({ label, value, color }: { label: string; value: number; color: string }) {
  const getColor = () => {
    switch (color) {
      case "cyan":
        return "from-cyan-500 to-blue-500"
      case "green":
        return "from-green-500 to-emerald-500"
      case "blue":
        return "from-blue-500 to-indigo-500"
      case "purple":
        return "from-purple-500 to-pink-500"
      default:
        return "from-cyan-500 to-blue-500"
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-xs text-slate-400">{value}%</div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${getColor()} rounded-full`} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  )
}

// Component for metric cards
function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
  detail,
}: {
  title: string
  value: number
  icon: LucideIcon
  trend: "up" | "down" | "stable"
  color: string
  detail: string
}) {
  const getColor = () => {
    switch (color) {
      case "cyan":
        return "from-cyan-500 to-blue-500 border-cyan-500/30"
      case "green":
        return "from-green-500 to-emerald-500 border-green-500/30"
      case "blue":
        return "from-blue-500 to-indigo-500 border-blue-500/30"
      case "purple":
        return "from-purple-500 to-pink-500 border-purple-500/30"
      default:
        return "from-cyan-500 to-blue-500 border-cyan-500/30"
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <BarChart3 className="h-4 w-4 text-amber-500" />
      case "down":
        return <BarChart3 className="h-4 w-4 rotate-180 text-green-500" />
      case "stable":
        return <LineChart className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className={`bg-slate-800/50 rounded-lg border ${getColor()} p-4 relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-400">{title}</div>
        <Icon className={`h-5 w-5 text-${color}-500`} />
      </div>
      <div className="text-2xl font-bold mb-1 bg-gradient-to-r bg-clip-text text-transparent from-slate-100 to-slate-300">
        {value}%
      </div>
      <div className="text-xs text-slate-500">{detail}</div>
      <div className="absolute bottom-2 right-2 flex items-center">{getTrendIcon()}</div>
      <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-r opacity-20 blur-xl from-cyan-500 to-blue-500"></div>
    </div>
  )
}

// Performance chart component

// Component for device status card
function DeviceStatusCard({ devices }: { devices: { name: string; online: boolean }[] }) {
  return (
    <div className="bg-slate-800/50 rounded-lg border from-cyan-500 to-blue-500 border-cyan-500/30 p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-base text-slate-100">接続センサー</span>
        <Server className="h-5 w-5 text-cyan-500" />
      </div>
      <div className="space-y-2">
        {devices.map((device) => (
          <div key={device.name} className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">{device.name}</span>
            {device.online ? (
              <Badge
                variant="outline"
                className="bg-slate-800/50 text-cyan-400 border-cyan-500/50 text-xs flex items-center"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 mr-1 animate-pulse"></div>
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-700/20 text-slate-400 border-slate-500/50 text-xs flex items-center">
                <div className="h-1.5 w-1.5 rounded-full bg-transparent mr-1"></div>
                Offline
              </Badge>
            )}
          </div>
        ))}
      </div>
      <div className="absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-r opacity-20 blur-xl from-cyan-500 to-blue-500"></div>
    </div>
  )
}

function PerformanceChart() {
  // 0〜24時のダミーデータ（20時のみ6、それ以外は0）
  const chartData = Array.from({ length: 25 }, (_, hour) => ({
    hour,
    value: hour === 20 ? 6 : 0,
  }))

  return (
    <div className="h-full w-full px-2 py-2">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, 24]}
            tickCount={13}
            allowDecimals={false}
            tickFormatter={(v) => `${String(v).padStart(2, '0')}:00`}
            stroke="#94a3b8"
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            allowDecimals={false}
            stroke="#94a3b8"
          />
          <RechartsTooltip formatter={(v) => v as number} labelFormatter={(v) => `${String(v).padStart(2, '0')}:00`} />
          <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Process row component
function ProcessRow({
  pid,
  name,
  user,
  cpu,
  memory,
  status,
}: {
  pid: string
  name: string
  user: string
  cpu: number
  memory: number
  status: string
}) {
  return (
    <div className="grid grid-cols-12 py-2 px-3 text-sm hover:bg-slate-800/50">
      <div className="col-span-1 text-slate-500">{pid}</div>
      <div className="col-span-4 text-slate-300">{name}</div>
      <div className="col-span-2 text-slate-400">{user}</div>
      <div className="col-span-2 text-cyan-400">{cpu}%</div>
      <div className="col-span-2 text-purple-400">{memory} MB</div>
      <div className="col-span-1">
        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
          {status}
        </Badge>
      </div>
    </div>
  )
}

// Storage item component
function StorageItem({
  name,
  total,
  used,
  type,
}: {
  name: string
  total: number
  used: number
  type: string
}) {
  const percentage = Math.round((used / total) * 100)

  return (
    <div className="bg-slate-800/50 rounded-md p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-300">{name}</div>
        <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600/50 text-xs">
          {type}
        </Badge>
      </div>
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-slate-500">
            {used} GB / {total} GB
          </div>
          <div className="text-xs text-slate-400">{percentage}%</div>
        </div>
        <Progress value={percentage} className="h-1.5 bg-slate-700">
          <div
            className={`h-full rounded-full ${
              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-amber-500" : "bg-cyan-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </Progress>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="text-slate-500">Free: {total - used} GB</div>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-slate-400 hover:text-slate-100">
          Details
        </Button>
      </div>
    </div>
  )
}

// Alert item component
function AlertItem({
  title,
  time,
  description,
  type,
}: {
  title: string
  time: string
  description: string
  type: "info" | "warning" | "error" | "success" | "update"
}) {
  const getTypeStyles = () => {
    switch (type) {
      case "info":
        return { icon: Info, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" }
      case "warning":
        return { icon: AlertCircle, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" }
      case "error":
        return { icon: AlertCircle, color: "text-red-500 bg-red-500/10 border-red-500/30" }
      case "success":
        return { icon: Check, color: "text-green-500 bg-green-500/10 border-green-500/30" }
      case "update":
        return { icon: Mic, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" }
      default:
        return { icon: Info, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" }
    }
  }

  const { icon: Icon, color } = getTypeStyles()

  return (
    <div className="flex items-start space-x-3">
      <button type="button" className={`mt-0.5 p-2 rounded-full transition-colors cursor-pointer ${color.split(" ")[1]} ${color.split(" ")[2]} hover:opacity-90`}>
        <Icon className={`h-4 w-4 ${color.split(" ")[0]}`} />
      </button>
      <div>
        <div className="flex items-center">
          <div className="text-sm font-medium text-slate-200">{title}</div>
          <div className="ml-2 text-xs text-slate-500">{time}</div>
        </div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
    </div>
  )
}

// Communication item component
function CommunicationItem({
  sender,
  time,
  message,
  avatar,
  unread,
}: {
  sender: string
  time: string
  message: string
  avatar: string
  unread?: boolean
}) {
  return (
    <div className={`flex space-x-3 p-2 rounded-md ${unread ? "bg-slate-800/50 border border-slate-700/50" : ""}`}>
      <div className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-800/70 border border-slate-700/50">
        <Bot className="h-4 w-4 text-cyan-500" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-200">{sender}</div>
          <div className="text-xs text-slate-500">{time}</div>
        </div>
        <div className="text-xs text-slate-400 mt-1">{message}</div>
      </div>
      {unread && (
        <div className="flex-shrink-0 self-center">
          <div className="h-2 w-2 rounded-full bg-cyan-500"></div>
        </div>
      )}
    </div>
  )
}

// Action button component
function ActionButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Button
      variant="outline"
      className="h-auto py-3 px-3 border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 flex flex-col items-center justify-center space-y-1 w-full"
    >
      <Icon className="h-5 w-5 text-cyan-500" />
      <span className="text-xs">{label}</span>
    </Button>
  )
}

// Lucide icon wrapper components with proper typing
const Info = (props: LucideProps) => <AlertCircle {...props} />

const Check = (props: LucideProps) => <Shield {...props} />
