import { useState, useEffect } from "react"
import { Clapperboard, ShieldCheck, Loader2, Sun, Moon, Sparkles, Music2, Star, UserPlus, SquarePlay } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Toaster, toast } from "sonner"
import { PromptInput } from "@/components/ui/ai-chat-input"
import { FormatToggleSwitcher } from "@/components/ui/FormatToggleSwitcher"
import { AgentCard } from "@/components/agents/AgentCard"
import { RunView } from "@/components/agents/RunView"
import { HistoryTabs, RunningBanner } from "@/components/agents/HistoryTabs"
import { CharacterStudio } from "@/components/character/CharacterStudio"
import { YouTubePanel } from "@/components/YouTubePanel"
import { AGENTS } from "@/lib/agents"
import { useStudio } from "@/lib/pipeline"
import { loadCharacterVault, getSelectedCharacter, setSelectedCharacterId, type Character } from "@/lib/characterVault"
import ConstellationGrid from "@/components/ui/constellation-grid"
import { cn } from "@/lib/utils"

const pageTransition = {
  initial: { opacity: 0, y: 14, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
  transition: { type: "spring" as const, stiffness: 340, damping: 32 },
}

export default function App() {
  const studio = useStudio()
  const [showConfigs, setShowConfigs] = useState(true)
  const [activeTab, setActiveTab] = useState<"song" | "character" | "youtube">(() => {
    if (typeof window !== "undefined" && window.location.hash === "#characters") return "character"
    return "song"
  })
  const [characters, setCharacters] = useState<Character[]>(() => loadCharacterVault())
  const [selectedChar, setSelectedChar] = useState<Character | null>(() => getSelectedCharacter())
  const [selectedFormat, setSelectedFormat] = useState<"16:9" | "9:16">("16:9")

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("yt-kids-theme")
      if (saved) return saved === "dark"
      return document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    return true
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("yt-kids-theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("yt-kids-theme", "light")
    }
  }, [isDark])

  const active = studio.sessions.find((s) => s.id === studio.activeId) ?? null
  const anyRunning = studio.sessions.some((s) => s.stage !== "done" && s.stage !== "error")

  const handleSelectCharacter = (c: Character | null) => {
    setSelectedChar(c)
    if (c) setSelectedCharacterId(c.id)
    setCharacters(loadCharacterVault())
  }

  const handleSend = (message: string, meta: { attachments: File[] }) => {
    toast.success(`Starting production in ${selectedFormat === "9:16" ? "9:16 Shorts" : "16:9 Long-Form"} mode!`)
    void studio.makeMovie(message, meta.attachments, selectedChar?.id, selectedFormat)
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-y-auto text-zinc-900 dark:text-zinc-100 antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <ConstellationGrid className="fixed inset-0 pointer-events-none z-0 h-full w-full" />
      <AnimatePresence mode="wait">
        {active ? (
          // ---- Run view ----
          <motion.div key="run" {...pageTransition} className="w-full h-screen overflow-hidden">
            <RunView
              session={active}
              sessions={studio.sessions}
              configs={studio.configs}
              onSaveConfig={studio.saveConfig}
              configsOpen={showConfigs}
              onBack={() => studio.setActiveId(null)}
              onNew={() => studio.setActiveId(null)}
              onOpenConfigs={() => setShowConfigs((v) => !v)}
              onSelectSession={(id) => studio.setActiveId(id)}
              onSendMessage={(text) => studio.sendMessageToAgents(active.id, text)}
              onRetrySession={() => studio.retrySession(active.id)}
              onRerollSceneKeyframe={(sceneId) => studio.rerollSceneKeyframe(active.id, sceneId)}
            />
          </motion.div>
        ) : (
          // ---- Landing page ----
          <main
            key="landing"
            className="z-10 flex w-full max-w-5xl flex-col items-center gap-6 p-6 mx-auto"
          >
            {/* Top Bar with Mode Switcher & Theme Toggle */}
            <div className="w-full flex items-center justify-between pb-1">
              {/* Studio Hub Selector */}
              <div className="flex items-center gap-1.5 rounded-xl bg-[#e6e8ee] dark:bg-[#14151b] p-1 border border-[#d2d5de] dark:border-[#272832]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("song")
                    if (typeof window !== "undefined") window.location.hash = ""
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                    activeTab === "song"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  <Music2 className="size-3.5 text-indigo-500" />
                  <span>Song & Video Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("youtube")
                    if (typeof window !== "undefined") window.location.hash = ""
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                    activeTab === "youtube"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  <SquarePlay className="size-3.5 text-red-500" />
                  <span>YouTube Publish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("character")
                    if (typeof window !== "undefined") window.location.hash = "#characters"
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                    activeTab === "character"
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Character Studio & Vault ({characters.length})</span>
                </button>
              </div>

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={() => setIsDark((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] px-3.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-[#e4e6ed] dark:hover:bg-[#1c1e25] transition-all shadow-xs"
                aria-label="Toggle dark/light theme"
              >
                {isDark ? (
                  <>
                    <Sun className="size-3.5 text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* View Switching: both tabs stay mounted (CSS-hidden) so in-flight
                character generation survives tab switches */}
            <div className={cn("w-full", activeTab !== "character" && "hidden")}>
              <CharacterStudio
                selectedId={selectedChar?.id || ""}
                onSelectCharacter={handleSelectCharacter}
                onClose={() => setActiveTab("song")}
              />
            </div>
            <div className={cn("w-full flex flex-col items-center gap-4", activeTab !== "youtube" && "hidden")}>
              <YouTubePanel />
            </div>
            <div className={cn("w-full flex flex-col items-center gap-6", activeTab !== "song" && "hidden")}>
              <>
                <header className="mt-2 flex flex-col items-center text-center">
                  {anyRunning && (
                    <div className="mb-3">
                      <RunningBanner
                        sessions={studio.sessions}
                        onOpen={(id) => studio.setActiveId(id)}
                      />
                    </div>
                  )}
                  <h1 className="flex items-center justify-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                    <Clapperboard className="size-7 text-indigo-600 dark:text-sky-400" /> YouTube Kids Studio
                  </h1>
                  <p className="mt-1.5 max-w-lg text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                    Describe an animated kids song or nursery rhyme concept. Agents compose catchy lyrics, generate 360° model sheets, and structure lip-sync tracks.
                  </p>
                </header>

                {/* Starring Mascot Selector Bar */}
                <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-2xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5]/90 dark:bg-[#14151b]/90 backdrop-blur shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Star className="size-3.5 text-amber-500 fill-amber-500" />
                      <span>Starring Mascot:</span>
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedChar ? selectedChar.name : "None (Vault Empty)"}
                    </span>
                    {selectedChar && (
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                        ({selectedChar.species})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCharacter(c)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                          selectedChar?.id === c.id
                            ? "bg-indigo-600 text-white shadow-xs font-semibold"
                            : "bg-[#e2e4ea] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e1] dark:hover:bg-[#252631] border border-[#d0d3dc] dark:border-[#2a2b35]"
                        )}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.palette.primary }}
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setActiveTab("character")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-dashed border-[#c5c8d2] dark:border-[#323340] hover:border-indigo-400 transition-colors"
                      title="Create or manage reusable mascots in Character Studio"
                    >
                      <UserPlus className="size-3" />
                      <span>+ Mascot</span>
                    </button>
                  </div>
                </div>

                {/* Format Toggle Switcher (16:9 Long-Form vs 9:16 Shorts) */}
                <div className="flex w-full items-center justify-center pt-1">
                  <FormatToggleSwitcher
                    value={selectedFormat}
                    onChange={setSelectedFormat}
                  />
                </div>

                <div className="flex w-full justify-center py-1">
                  <PromptInput
                    onSubmit={handleSend}
                    placeholder={
                      selectedChar
                        ? `Describe ${selectedChar.name}'s song… (e.g. counting rhyme, Big Feelings dance)`
                        : "Describe your song idea or theme… (e.g. upbeat 'Never Give Up' counting song)"
                    }
                  />
                </div>

                {/* Recent Productions / History Shelf */}
                <HistoryTabs
                  sessions={studio.sessions}
                  activeId={studio.activeId}
                  onOpen={(id) => studio.setActiveId(id)}
                  onRename={studio.renameSession}
                  onRemove={studio.removeSession}
                />

                <section className="w-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                        <ShieldCheck className="size-4 text-indigo-600 dark:text-sky-400" /> Production Agents
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Customize models, endpoints, and cognitive skills per role.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfigs((v) => !v)}
                      className="rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] px-3.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-xs hover:bg-[#e4e6ed] dark:hover:bg-[#1c1e25] transition-colors"
                    >
                      {showConfigs ? "Hide agent cards" : "Show agent cards"}
                    </button>
                  </div>
                  {showConfigs && (
                    <div className="mt-4 grid w-full grid-cols-1 gap-5 md:grid-cols-2">
                      {AGENTS.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          config={studio.configs[agent.id]}
                          onSave={(c) => studio.saveConfig(agent.id, c)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Monitor panel */}
                <section className="w-full rounded-2xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-[#d8dade] dark:border-[#27282f]">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                        System & Platform Monitor
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Self-checks endpoints, quota health, and YouTube COPPA compliance.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={studio.runMonitors}
                      disabled={studio.probing}
                      className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 shadow-xs transition-opacity"
                    >
                      {studio.probing && <Loader2 className="size-3.5 animate-spin" />}
                      Run Health Check
                    </button>
                  </div>
                  <AnimatePresence>
                    {studio.findings && (
                      <motion.div
                        key="findings"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="mt-3 divide-y divide-[#d8dade] dark:divide-[#27282f] overflow-hidden"
                      >
                        {studio.findings.map((f) => (
                          <div key={f.agent} className="grid grid-cols-[140px_1fr] items-center gap-3 py-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${f.ok ? "bg-emerald-500" : "bg-rose-500"}`} />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{f.agent}</span>
                            </div>
                            <span className={`truncate ${f.ok ? "text-zinc-600 dark:text-zinc-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {f.detail}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </>
            </div>
          </main>
        )}
      </AnimatePresence>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
