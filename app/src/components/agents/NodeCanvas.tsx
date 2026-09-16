import { useState, useRef, useEffect, useMemo } from "react"
import {
  FileText,
  Sparkles,
  Wand2,
  Clapperboard,
  Download,
  Loader2,
  Plus,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  RotateCw,
  Check,
  Copy,
  RefreshCw,
  Play,
  Film,
  Terminal,
  Volume2,
} from "lucide-react"
import { gsap } from "gsap"
import type { Session } from "@/lib/pipeline"
import {
  extractCharacterProfile,
} from "@/lib/characterGenerator"
import { InteractiveStoryboardReel } from "@/components/ui/InteractiveStoryboardReel"
import { WaveformPulseLoader } from "@/components/ui/WaveformPulseLoader"
import { cn } from "@/lib/utils"

interface Props {
  session: Session
  onOpenScriptTab: () => void
  onOpenConfigs: () => void
  onRetrySession?: () => void
  onRerollSceneKeyframe?: (sceneId: string) => void
}

export function NodeCanvas({
  session,
  onOpenScriptTab,
  onOpenConfigs,
  onRetrySession,
  onRerollSceneKeyframe,
}: Props) {
  const s = session
  const [scale, setScale] = useState(0.88)
  const [pan, setPan] = useState({ x: 20, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scanBarRef = useRef<HTMLDivElement>(null)
  const scriptScrollRef = useRef<HTMLDivElement>(null)

  // Character profile: prioritizes the locked Reusable Character Bible
  const profile = useMemo(() => s.characterProfile || extractCharacterProfile(s.prompt), [s.characterProfile, s.prompt])

  // Pipeline states — strictly distinguished from "error" and "idle"
  const isError = s.stage === "error"
  const visionActive = s.stage === "vision"
  const visionDone = (s.stage !== "idle" && s.stage !== "vision" && !isError) || !!s.script
  const scriptActive = s.stage === "script"
  const scriptDone = (s.stage === "image" || s.stage === "done") && !!s.script
  const imageActive = s.stage === "image"
  const imageDone = s.stage === "done" && (!!s.characterSheetUrl || !!s.deliverable)
  const allDone = s.stage === "done" && !!s.script

  // Auto-scroll script preview as text streams in
  useEffect(() => {
    if (scriptActive && scriptScrollRef.current) {
      scriptScrollRef.current.scrollTop = scriptScrollRef.current.scrollHeight
    }
  }, [s.script, scriptActive])

  // GSAP animation for scanning line effect across character angle cards
  useEffect(() => {
    if (!scanBarRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        scanBarRef.current,
        { top: "-10%", opacity: 0 },
        {
          top: "110%",
          opacity: 0.8,
          duration: 2.2,
          repeat: -1,
          ease: "power1.inOut",
        }
      )
    }, scanBarRef)
    return () => ctx.revert()
  }, [imageActive])

  // Auto-heal / prevent 30-minute freeze: if session was loaded idle/unstarted, auto-trigger
  useEffect(() => {
    if ((s.stage === "idle" || (s.stage === "script" && !s.script)) && onRetrySession) {
      const timer = setTimeout(() => {
        onRetrySession()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [s.id, s.stage, s.script, onRetrySession])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-canvas-interactive]")) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => setIsDragging(false)

  const zoomIn = () => setScale((s) => Math.min(1.4, s + 0.1))
  const zoomOut = () => setScale((s) => Math.max(0.55, s - 0.1))
  const resetView = () => {
    setScale(0.88)
    setPan({ x: 20, y: 0 })
  }

  const copySpecs = () => {
    const specs = `Character 360 Turnaround Specs:
Project: ${s.name}
Character: ${profile.name} (${profile.species})
Palette: Primary ${profile.primary}, Accent ${profile.accent}, Fur ${profile.skinOrFur}
Rig Angles: 0° Front, 45° Three-Quarter, 90° Side Profile, 180° Rear
Screenplay:
${s.script || s.prompt}`
    navigator.clipboard.writeText(specs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Node Positions in canvas space
  const n1 = { x: 50, y: 160, w: 260, h: 220 }   // Input Prompt & Mascot DNA
  const n2 = { x: 360, y: 35, w: 320, h: 210 }   // Vision & Mascot Bible
  const n3 = { x: 360, y: 275, w: 320, h: 270 }  // script.md Screenplay
  const n4 = { x: 740, y: 35, w: 410, h: 325 }   // 360 Model Generator
  const n5 = { x: 740, y: 385, w: 410, h: 200 }  // Interactive 360 Angle Inspector
  const n6 = { x: 1210, y: 100, w: 350, h: 480 } // Master Deliverable Pack
  const n7 = { x: 360, y: 610, w: 1200, h: 340 } // Storyboard Keyframe Reel & Audio Stems

  // Wire bezier calculations
  const wire = (fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = Math.max(40, (toX - fromX) * 0.5)
    return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        "relative size-full overflow-hidden select-none",
        "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px]",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      {/* Top Floating Pipeline Activity Bar */}
      <div
        data-canvas-interactive
        className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-3.5 py-1.5 shadow-lg backdrop-blur-md text-xs"
      >
        <span
          className={cn(
            "size-2 rounded-full",
            isError ? "bg-red-500" : allDone ? "bg-emerald-500" : "bg-violet-500 animate-ping"
          )}
        />
        <span className="font-semibold text-foreground">
          {isError
            ? "Pipeline Paused"
            : allDone
            ? "Pipeline Complete"
            : scriptActive
            ? "Script Writer Streaming live..."
            : imageActive
            ? "360° Modeler Synthesizing Turnaround..."
            : visionActive
            ? "Vision Analyst Active..."
            : "Studio Live"}
        </span>

        {/* Retry / Instant Run Trigger */}
        {(isError || !s.script || s.stage === "idle") && onRetrySession && (
          <button
            type="button"
            onClick={onRetrySession}
            className="ml-2 flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs hover:bg-violet-500 transition-colors"
          >
            {s.script ? <RefreshCw className="size-3" /> : <Play className="size-3" />}
            <span>{isError ? "Retry" : "Generate Live"}</span>
          </button>
        )}
      </div>

      {/* Floating Canvas Toolbar (Left Edge) */}
      <div
        data-canvas-interactive
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 rounded-2xl border border-border/80 bg-card/85 p-1.5 shadow-xl backdrop-blur-md"
      >
        <button
          type="button"
          onClick={onOpenConfigs}
          title="Add or Configure Agents"
          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px w-5 bg-border my-0.5" />
        <button
          type="button"
          onClick={resetView}
          title="Reset Pipeline Graph"
          className="flex size-9 items-center justify-center rounded-xl bg-accent/60 text-foreground transition-all hover:bg-accent active:scale-90"
        >
          <GitBranch className="size-4 text-violet-500" />
        </button>
        <button
          type="button"
          onClick={onOpenScriptTab}
          title="Open script.md"
          className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
        >
          <FileText className="size-4 text-blue-500" />
        </button>
        {onRetrySession && (
          <button
            type="button"
            onClick={onRetrySession}
            title="Re-run Studio Pipeline"
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90"
          >
            <RefreshCw className="size-4 text-amber-500" />
          </button>
        )}
      </div>

      {/* Floating Canvas Viewport Zoom Dock (Bottom Right) */}
      <div
        data-canvas-interactive
        className="absolute right-5 bottom-5 z-20 flex items-center gap-1 rounded-xl border border-border/80 bg-card/85 px-2 py-1.5 shadow-xl backdrop-blur-md text-xs font-medium"
      >
        <button
          type="button"
          onClick={zoomOut}
          className="flex size-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <span className="w-12 text-center tabular-nums text-foreground/80">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={zoomIn}
          className="flex size-7 items-center justify-center rounded-lg hover:bg-accent transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button
          type="button"
          onClick={resetView}
          className="flex size-7 items-center justify-center rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Fit view"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Main Canvas Transformation Surface */}
      <div
        className="absolute inset-0 origin-top-left transition-transform duration-75 ease-out pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        {/* SVG Cable System */}
        <svg className="absolute inset-0 overflow-visible pointer-events-none" style={{ width: 1700, height: 900 }}>
          <defs>
            <linearGradient id="wire-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Wire 1 -> 2 (Prompt -> Vision) */}
          <path
            d={wire(n1.x + n1.w, n1.y + 60, n2.x, n2.y + 80)}
            fill="none"
            stroke={visionActive || visionDone ? "#8b5cf6" : "#cbd5e1"}
            strokeWidth={visionActive ? 2.5 : 1.5}
            strokeDasharray={visionActive ? "6,6" : undefined}
            className={visionActive ? "animate-[dash_1s_linear_infinite]" : undefined}
          />

          {/* Wire 1 -> 3 (Prompt -> Script) */}
          <path
            d={wire(n1.x + n1.w, n1.y + 140, n3.x, n3.y + 80)}
            fill="none"
            stroke={scriptActive || scriptDone ? "#3b82f6" : "#cbd5e1"}
            strokeWidth={scriptActive ? 2.5 : 1.5}
            strokeDasharray={scriptActive ? "6,6" : undefined}
            className={scriptActive ? "animate-[dash_1s_linear_infinite]" : undefined}
          />

          {/* Wire 2 -> 4 (Vision -> 360 Modeler) */}
          <path
            d={wire(n2.x + n2.w, n2.y + 100, n4.x, n4.y + 90)}
            fill="none"
            stroke={imageActive || imageDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={imageActive ? 2.5 : 1.5}
            strokeDasharray={imageActive ? "6,6" : undefined}
            className={imageActive ? "animate-[dash_1s_linear_infinite]" : undefined}
          />

          {/* Wire 3 -> 4 (Script -> 360 Modeler) */}
          <path
            d={wire(n3.x + n3.w, n3.y + 90, n4.x, n4.y + 180)}
            fill="none"
            stroke={imageActive || imageDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={imageActive ? 2.5 : 1.5}
            strokeDasharray={imageActive ? "6,6" : undefined}
            className={imageActive ? "animate-[dash_1s_linear_infinite]" : undefined}
          />

          {/* Wire 3 -> 5 (Script -> Angle Inspector) */}
          <path
            d={wire(n3.x + n3.w, n3.y + 180, n5.x, n5.y + 80)}
            fill="none"
            stroke={scriptDone ? "#3b82f6" : "#cbd5e1"}
            strokeWidth={1.5}
          />

          {/* Wire 4 -> 6 (360 Modeler -> Master Pack) */}
          <path
            d={wire(n4.x + n4.w, n4.y + 150, n6.x, n6.y + 100)}
            fill="none"
            stroke={allDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={allDone ? 2.5 : 1.5}
            filter={allDone ? "url(#glow)" : undefined}
          />

          {/* Wire 5 -> 6 (Angle Inspector -> Master Pack) */}
          <path
            d={wire(n5.x + n5.w, n5.y + 100, n6.x, n6.y + 200)}
            fill="none"
            stroke={allDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={allDone ? 2.5 : 1.5}
          />

          {/* Wire 3 -> 7 (Script -> Storyboard Reel) */}
          <path
            d={wire(n3.x + n3.w * 0.5, n3.y + n3.h, n7.x + 180, n7.y)}
            fill="none"
            stroke={scriptDone ? "#3b82f6" : "#cbd5e1"}
            strokeWidth={1.5}
          />

          {/* Wire 4 -> 7 (Modeler -> Storyboard Reel) */}
          <path
            d={wire(n4.x + n4.w * 0.5, n4.y + n4.h, n7.x + 550, n7.y)}
            fill="none"
            stroke={imageDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={1.5}
          />

          {/* Wire 7 -> 6 (Storyboard Reel -> Master Pack) */}
          <path
            d={wire(n7.x + n7.w - 120, n7.y, n6.x + n6.w * 0.5, n6.y + n6.h)}
            fill="none"
            stroke={allDone ? "#10b981" : "#cbd5e1"}
            strokeWidth={2}
          />
        </svg>

        {/* ----------------- Node 1: Input Prompt ----------------- */}
        <div
          data-canvas-interactive
          className="absolute rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl"
          style={{ left: n1.x, top: n1.y, width: n1.w }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="flex size-2 rounded-full bg-violet-500 animate-pulse" />
              1. Input Prompt
            </div>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Source
            </span>
          </div>
          <p className="mt-3 text-xs text-foreground/90 font-medium line-clamp-3 leading-relaxed">
            "{s.prompt}"
          </p>
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
            <span>Character: {profile.name}</span>
            <span className="text-emerald-500 font-medium">✓ Dispatched</span>
          </div>
          {/* Output Port */}
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-violet-500 shadow-sm" />
        </div>

        {/* ----------------- Node 2: Vision & Art Bible ----------------- */}
        <div
          data-canvas-interactive
          className={cn(
            "absolute rounded-2xl border bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl",
            visionActive ? "border-purple-400 ring-2 ring-purple-400/20" : "border-border"
          )}
          style={{ left: n2.x, top: n2.y, width: n2.w }}
        >
          {/* Input Port */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-purple-500 shadow-sm" />
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <Sparkles className="size-3.5" />
              2. Vision Analyst
            </div>
            <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
              {visionActive ? "Analyzing..." : visionDone ? "Bible Ready" : "Standby"}
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Hero Silhouette</span>
              <span className="font-semibold text-foreground">{profile.species}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Color Palette</span>
              <div className="flex gap-1 items-center">
                <span className="size-3 rounded-full border border-border/40" style={{ backgroundColor: profile.primary }} />
                <span className="size-3 rounded-full border border-border/40" style={{ backgroundColor: profile.accent }} />
                <span className="size-3 rounded-full border border-border/40" style={{ backgroundColor: profile.skinOrFur }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Turnaround Rig</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">4 Orthographic Cues</span>
            </div>
          </div>
          {/* Output Port */}
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-purple-500 shadow-sm" />
        </div>

        {/* ----------------- Node 3: script.md Screenplay (LIVE WRITING) ----------------- */}
        <div
          data-canvas-interactive
          className={cn(
            "absolute rounded-2xl border bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl",
            scriptActive ? "border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10" : "border-border"
          )}
          style={{ left: n3.x, top: n3.y, width: n3.w }}
        >
          {/* Input Port */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-blue-500 shadow-sm" />
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <FileText className="size-3.5" />
              3. script.md (Screenplay)
            </div>
            <div className="flex items-center gap-1.5">
              {scriptActive && <span className="size-1.5 rounded-full bg-blue-500 animate-ping" />}
              <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                {scriptActive ? "Live Writing..." : scriptDone ? "script.md locked" : "Pending"}
              </span>
            </div>
          </div>

          {/* Live Script Typewriter Viewport */}
          <div className="mt-3">
            <div
              ref={scriptScrollRef}
              className="h-32 overflow-y-auto rounded-xl bg-muted/70 p-2.5 text-[11px] font-mono leading-relaxed border border-border/50 text-foreground/85 shadow-inner"
            >
              {s.script ? (
                <div className="whitespace-pre-wrap">
                  {s.script}
                  {scriptActive && (
                    <span className="inline-block size-2 bg-blue-500 animate-pulse ml-0.5 align-baseline" />
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                  {scriptActive ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-blue-500" />
                      <span className="animate-pulse">Streaming screenplay live...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="size-4 text-muted-foreground/60" />
                      <span>Ready to synthesize screenplay</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-mono">
              {s.script ? `${s.script.trim().split(/\s+/).filter(Boolean).length} words` : "3-Act Structure"}
            </span>
            <button
              type="button"
              onClick={onOpenScriptTab}
              className="flex items-center gap-1 text-blue-600 hover:underline font-semibold"
            >
              <ExternalLink className="size-3" /> Inspect .md
            </button>
          </div>
          {/* Output Port */}
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-blue-500 shadow-sm" />
        </div>

        {/* ----------------- Node 4: AI Character Sheet (real generated image) ----------------- */}
        <div
          data-canvas-interactive
          className={cn(
            "absolute rounded-2xl border bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl overflow-hidden",
            imageActive ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-emerald-500/10" : "border-border"
          )}
          style={{ left: n4.x, top: n4.y, width: n4.w }}
        >
          {/* Input Port */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Wand2 className="size-3.5" />
              4. Character Sheet Generator
            </div>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
              {imageActive ? "Generating..." : s.characterSheetUrl ? "AI Sheet Ready" : "Standby"}
            </span>
          </div>

          {/* GSAP Laser Scanner Overlay Line */}
          {imageActive && (
            <div
              ref={scanBarRef}
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400 shadow-lg shadow-emerald-500/50 pointer-events-none z-30"
            />
          )}

          {/* Real AI-generated character sheet (or empty state) */}
          <div className="mt-3 rounded-xl border border-border/40 bg-slate-950/85 overflow-hidden flex items-center justify-center">
            {s.characterSheetUrl ? (
              <img
                src={s.characterSheetUrl}
                alt={`${profile.name} AI character sheet`}
                className="w-full object-contain"
              />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 p-4 text-center">
                <Wand2 className="size-5 text-muted-foreground/50" />
                <span className="text-[11px] text-muted-foreground">
                  {imageActive ? "Generating sheet via AI..." : "No AI sheet generated yet"}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            <span>Rig: 4 Angles (0°-180°)</span>
            <span className="text-emerald-600 font-medium font-mono">Pixar 3D Stylized</span>
          </div>

          {/* Output Port */}
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
        </div>

        {/* ----------------- Node 5: Character DNA (palette + description) ----------------- */}
        <div
          data-canvas-interactive
          className="absolute rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl"
          style={{ left: n5.x, top: n5.y, width: n5.w }}
        >
          {/* Input Port */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-sky-500 shadow-sm" />
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <RotateCw className="size-3.5" />
              5. Character DNA
            </div>
            <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
              {profile.name}
            </span>
          </div>

          {/* Palette Swatches */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              { label: "Primary", hex: profile.primary },
              { label: "Secondary", hex: profile.secondary },
              { label: "Accent", hex: profile.accent },
              { label: "Fur/Skin", hex: profile.skinOrFur },
              { label: "Eyes", hex: profile.eyeColor },
            ].map((sw) => (
              <span
                key={sw.label}
                title={`${sw.label}: ${sw.hex}`}
                className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                <span className="size-2.5 rounded-full border border-black/20" style={{ backgroundColor: sw.hex }} />
                {sw.label}
              </span>
            ))}
          </div>

          {/* Description */}
          <div className="mt-2.5 rounded-xl bg-muted/40 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
              {s.characterDescription || profile.species}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Species: {profile.species}</span>
            <span className="text-sky-600 font-medium">Palette locked</span>
          </div>

          {/* Output Port */}
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-sky-500 shadow-sm" />
        </div>

        {/* ----------------- Node 6: Master Deliverable Pack ----------------- */}
        <div
          data-canvas-interactive
          className={cn(
            "absolute rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl",
            allDone ? "border-emerald-500/80 ring-2 ring-emerald-500/20" : "border-border"
          )}
          style={{ left: n6.x, top: n6.y, width: n6.w }}
        >
          {/* Input Port */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clapperboard className="size-4 text-emerald-500" />
              6. Master Production Pack
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                allDone ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {allDone ? "Delivered" : "In Progress"}
            </span>
          </div>

          {/* Deliverable Summary */}
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border/80 bg-accent/30 p-3">
              <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                360° Turnaround Model Sheet + Screenplay (.md)
              </p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5 pt-2">
              {s.characterSheetUrl && (
                <a
                  href={s.characterSheetUrl}
                  download="character-360-turnaround.png"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  <Download className="size-3.5" /> Download 360° Model Sheet
                </a>
              )}
              <button
                type="button"
                onClick={onOpenScriptTab}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-accent transition-colors"
              >
                <FileText className="size-3.5 text-blue-500" /> View & Download script.md
              </button>
              {s.ffmpegScript && (
                <button
                  type="button"
                  onClick={() => downloadTextFile(s.ffmpegScript!, "assemble.sh")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold hover:bg-accent transition-colors text-foreground"
                >
                  <Terminal className="size-3.5 text-amber-500" /> Download assemble.sh
                </button>
              )}
              {s.motionPrompts && (
                <button
                  type="button"
                  onClick={() => downloadTextFile(s.motionPrompts!, "veo-prompts.txt")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold hover:bg-accent transition-colors text-foreground"
                >
                  <Film className="size-3.5 text-purple-500" /> Download veo-prompts.txt
                </button>
              )}
              <button
                type="button"
                onClick={copySpecs}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-accent transition-colors text-muted-foreground"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Specs Copied!" : "Copy Character Specs"}
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- Node 7: Concurrent Storyboard Reel & Audio Stems (Subagent C & D) ----------------- */}
        <div
          data-canvas-interactive
          className="absolute rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto transition-all hover:shadow-2xl"
          style={{ left: n7.x, top: n7.y, width: n7.w }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Film className="size-4 text-indigo-500" />
              <span>7. Storyboard Reel & Audio Stems (Subagent C & D)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {s.format === "9:16" ? "9:16 Shorts (1024x1792)" : "16:9 Long-Form (1792x1024)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Volume2 className="size-3 text-rose-500" />
                -18dB Ducking Active
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                COPPA Verified
              </span>
            </div>
          </div>

          <div className="mt-3">
            {s.scenes && s.scenes.length > 0 ? (
              <InteractiveStoryboardReel
                scenes={s.scenes}
                format={s.format}
                onRerollScene={onRerollSceneKeyframe}
              />
            ) : s.stage === "audio" || s.stage === "image" ? (
              <WaveformPulseLoader />
            ) : (
              <div className="flex items-center justify-center p-8 text-center text-xs text-muted-foreground">
                Storyboard frames and parallel audio stems will populate upon Subagent A & B completion.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
