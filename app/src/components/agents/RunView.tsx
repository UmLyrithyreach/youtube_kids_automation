import { useState } from "react"
import {
  Clapperboard,
  ArrowLeft,
  Settings,
  Plus,
  Cpu,
  Layers,
  X,
  ChevronDown,
  Check,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { AgentChatStream } from "./AgentChatStream"
import { NodeCanvas } from "./NodeCanvas"
import { AgentCard } from "./AgentCard"
import { AGENTS, type AgentConfig, type AgentId } from "@/lib/agents"
import type { Session } from "@/lib/pipeline"

interface Props {
  session: Session
  sessions?: Session[]
  configs?: Record<AgentId, AgentConfig | null>
  onSaveConfig?: (id: AgentId, c: AgentConfig) => void
  configsOpen: boolean
  onBack: () => void
  onNew: () => void
  onOpenConfigs: () => void
  onSelectSession?: (id: string) => void
  onSendMessage: (text: string) => void
  onRetrySession?: () => void
  onRerollSceneKeyframe?: (sceneId: string) => void
}

export function RunView({
  session,
  sessions = [],
  configs = {} as Record<AgentId, AgentConfig | null>,
  onSaveConfig,
  configsOpen,
  onBack,
  onNew,
  onOpenConfigs,
  onSelectSession,
  onSendMessage,
  onRetrySession,
  onRerollSceneKeyframe,
}: Props) {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [sideTab, setSideTab] = useState<"stream" | "script">("stream")

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* ---------------- RoboNeo Workspace Header ---------------- */}
      <header className="z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/80 bg-card/80 px-4 backdrop-blur-md">
        {/* Left Side: Back + Brand + Project Dropdown + Workspace Mode */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to landing"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs">
              <Clapperboard className="size-4" />
            </div>
            <span className="hidden text-xs font-bold tracking-tight text-foreground sm:inline">RoboStudio</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Project Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <span className="max-w-40 sm:max-w-64 truncate">{session.name}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            {projectMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl z-50"
                onClick={() => setProjectMenuOpen(false)}
              >
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Recent Productions</span>
                  <span className="text-[9px] lowercase font-normal">({sessions.length})</span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 p-0.5">
                  {sessions.map((s) => {
                    const isCur = s.id === session.id
                    const isRunning = s.stage !== "done" && s.stage !== "error"
                    const thumb = s.deliverable?.characterSheetUrl || s.characterSheetUrl
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelectSession?.(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-colors text-left",
                          isCur ? "bg-accent font-semibold text-foreground" : "hover:bg-accent/60 text-foreground/80"
                        )}
                      >
                        <div className="relative size-7 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                          {thumb ? (
                            <img src={thumb} alt={s.name} className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground/60">
                              <Clapperboard className="size-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{s.name}</span>
                            {isRunning && (
                              <span className="size-1.5 shrink-0 rounded-full bg-indigo-500 animate-pulse" />
                            )}
                          </div>
                          <span className="block truncate text-[10px] font-normal text-muted-foreground">
                            {s.characterName ? `✦ ${s.characterName}` : s.prompt}
                          </span>
                        </div>
                        {isCur && <Check className="size-3.5 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
                <div className="border-t border-border/60 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={onNew}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-primary font-semibold hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="size-3.5" /> New Movie
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Mode Badge like RoboNeo */}
          <div className="hidden items-center gap-1 rounded-lg border border-border/50 bg-background/50 px-2 py-1 text-[11px] font-medium text-muted-foreground md:flex">
            <Layers className="size-3 text-primary" />
            <span>Canvas</span>
          </div>
        </div>

        {/* Right Side: Engine, Credits, Agent Settings, New */}
        <div className="flex items-center gap-2">
          {/* Engine indicator */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:flex">
            <Cpu className="size-3.5 text-purple-500" />
            <span>360° Modeler + Script</span>
          </div>

          {/* Agent settings toggle */}
          <button
            type="button"
            onClick={onOpenConfigs}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Settings className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Agents</span>
          </button>

          {/* New Project Button */}
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </header>

      {/* ---------------- Main Split View ---------------- */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Left Panel: Multi-Agent Thought & Collaboration Stream */}
        <div className="w-80 sm:w-96 md:w-[420px] shrink-0 border-r border-border/80 h-full overflow-hidden">
          <AgentChatStream
            session={session}
            onSendMessage={onSendMessage}
            activeTab={sideTab}
            onTabChange={setSideTab}
          />
        </div>

        {/* Right Panel: Interactive RoboNeo Node Canvas */}
        <div className="flex-1 h-full overflow-hidden relative">
          <NodeCanvas
            session={session}
            onOpenConfigs={onOpenConfigs}
            onOpenScriptTab={() => setSideTab("script")}
            onRetrySession={onRetrySession}
            onRerollSceneKeyframe={onRerollSceneKeyframe}
          />
        </div>
      </main>

      {/* ---------------- Agent Settings Modal / Drawer ---------------- */}
      <AnimatePresence>
        {configsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card p-5 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Agent Configuration</h3>
                </div>
                <button
                  type="button"
                  onClick={onOpenConfigs}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {AGENTS.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      config={configs[agent.id] ?? null}
                      onSave={(c) => onSaveConfig?.(agent.id, c)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
