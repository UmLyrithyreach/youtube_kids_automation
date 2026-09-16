import { useState } from "react"
import {
  SlidersHorizontal,
  Sparkles,
  Check,
  Loader2,
  RotateCcw,
  Eye,
  EyeOff,
  Palette,
  Eye as VisionIcon,
  Shield,
  Music,
  ChevronUp,
  Volume2,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { filterModelsByCapability, type AgentConfig, type AgentDef, type AgentId } from "@/lib/agents"
import { fetchModels } from "@/lib/byok"

interface Props {
  agent: AgentDef
  config: AgentConfig | null
  onSave: (c: AgentConfig) => void
  status?: { state: "idle" | "probe-ok" | "probe-fail" | "busy"; detail?: string }
}

const AGENT_ICONS: Record<AgentId, React.ComponentType<{ className?: string }>> = {
  script: Music,
  image: Palette,
  voice: Volume2,
  vision: VisionIcon,
  monitor: Shield,
}

export function AgentCard({ agent, config, onSave, status }: Props) {
  const [panel, setPanel] = useState<"none" | "skill" | "model">("none")
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? agent.defaultBaseUrl)
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "")
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState(config?.model ?? agent.defaultModel)
  const [models, setModels] = useState<string[]>(config?.models ?? [])
  const [imagePath, setImagePath] = useState(config?.imagePath ?? agent.defaultImagePath ?? "")
  const [skillText, setSkillText] = useState(config?.skill ?? agent.defaultSkill)
  const [modelFilter, setModelFilter] = useState("")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const Icon = AGENT_ICONS[agent.id] || Sparkles
  const configured = Boolean(baseUrl && apiKey && model)
  const isCustomSkill = skillText.trim() !== agent.defaultSkill.trim()

  const handleFetchModels = async () => {
    setBusy(true)
    setError(null)
    try {
      const fetched = await fetchModels({ baseUrl, apiKey, model, models: [] })
      const filtered = agent.capability === "monitor" ? fetched : filterModelsByCapability(fetched, agent.capability)
      setModels(filtered)
      const keep = filtered.includes(model) ? model : filtered[0] ?? model
      setModel(keep)
      onSave({
        baseUrl,
        apiKey,
        model: keep,
        models: filtered,
        imagePath: imagePath || undefined,
        skill: skillText,
        escalateModel: config?.escalateModel,
      })
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleSelectModel = (selected: string) => {
    setModel(selected)
    onSave({
      baseUrl,
      apiKey,
      model: selected,
      models,
      imagePath: imagePath || undefined,
      skill: skillText,
      escalateModel: config?.escalateModel,
    })
  }

  const handleSaveSkill = () => {
    onSave({
      baseUrl,
      apiKey,
      model,
      models,
      imagePath: imagePath || undefined,
      skill: skillText,
      escalateModel: config?.escalateModel,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const handleResetSkill = () => {
    setSkillText(agent.defaultSkill)
    onSave({
      baseUrl,
      apiKey,
      model,
      models,
      imagePath: imagePath || undefined,
      skill: agent.defaultSkill,
      escalateModel: config?.escalateModel,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const filteredModelsList = models.filter((m) =>
    m.toLowerCase().includes(modelFilter.toLowerCase())
  )

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#d3d6de] dark:border-[#27282f] bg-[#f0f1f4] dark:bg-[#14151a] shadow-xs transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-700 overflow-hidden">
      {/* Main Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e2e4ea] dark:bg-[#1f2026] text-zinc-800 dark:text-zinc-200 border border-[#d1d4dc] dark:border-[#2f313a]">
              <Icon className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {agent.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {agent.role}
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="shrink-0">
            {status?.state === "busy" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#e2e4ea] dark:bg-[#1f2026] text-zinc-600 dark:text-zinc-400 border border-[#d1d4dc] dark:border-[#2f313a]">
                <Loader2 className="size-3 animate-spin" />
                <span>Checking</span>
              </span>
            ) : status?.state === "probe-fail" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                <span className="size-1.5 rounded-full bg-rose-500" />
                <span>Error</span>
              </span>
            ) : configured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Ready</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <span className="size-1.5 rounded-full bg-amber-500" />
                <span>Needs Setup</span>
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {agent.description}
        </p>

        {/* Specs Details Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#d8dade] dark:border-[#27282f] text-xs">
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">Model:</span>
            <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-[#e2e4ea] dark:bg-[#1c1d23] border border-[#d1d4dc] dark:border-[#2b2c34] px-2 py-0.5 rounded-md">
              {model || "None"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">Skill:</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-md text-xs font-medium border",
                isCustomSkill
                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60"
                  : "bg-[#e2e4ea] dark:bg-[#1c1d23] text-zinc-800 dark:text-zinc-300 border-[#d1d4dc] dark:border-[#2b2c34]"
              )}
            >
              {isCustomSkill ? "Custom" : "Default"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer (Segmented Controls) */}
      <div className="px-5 py-3 bg-[#e6e8ee] dark:bg-[#101115] border-t border-[#d8dade] dark:border-[#27282f] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Skill Button */}
          <button
            type="button"
            onClick={() => setPanel((curr) => (curr === "skill" ? "none" : "skill"))}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              panel === "skill"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                : "bg-[#e2e4ea] dark:bg-[#1c1d24] text-zinc-800 dark:text-zinc-300 border-[#d1d4dc] dark:border-[#2b2c35] hover:bg-[#d8dbe2] dark:hover:bg-[#252731]"
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Edit Skill</span>
          </button>

          {/* Model Button */}
          <button
            type="button"
            onClick={() => setPanel((curr) => (curr === "model" ? "none" : "model"))}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              panel === "model"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                : "bg-[#e2e4ea] dark:bg-[#1c1d24] text-zinc-800 dark:text-zinc-300 border-[#d1d4dc] dark:border-[#2b2c35] hover:bg-[#d8dbe2] dark:hover:bg-[#252731]"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Configure</span>
          </button>
        </div>

        {panel !== "none" && (
          <button
            type="button"
            onClick={() => setPanel("none")}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <span>Close</span>
            <ChevronUp className="size-3.5" />
          </button>
        )}
      </div>

      {/* Expandable Panels */}
      <AnimatePresence initial={false}>
        {panel === "skill" && (
          <motion.div
            key="skill-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="border-t border-[#d8dade] dark:border-[#27282f] p-5 bg-[#e8ebf0] dark:bg-[#0e0f13] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Agent Skill & System Instructions
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Controls the reasoning rules, narrative format, and behavior for this agent.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetSkill}
                className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                title="Reset to canonical default skill"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <textarea
              value={skillText}
              onChange={(e) => setSkillText(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] p-3 text-xs font-mono leading-relaxed text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-xs resize-y"
              placeholder="Enter skill instructions..."
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-500">
                {isCustomSkill ? "Modified custom skill" : "Canonical skill active"}
              </span>
              <button
                type="button"
                onClick={handleSaveSkill}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
              >
                {savedSuccess ? <Check className="size-3.5" /> : null}
                <span>{savedSuccess ? "Skill Saved" : "Save Skill"}</span>
              </button>
            </div>
          </motion.div>
        )}

        {panel === "model" && (
          <motion.div
            key="model-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="border-t border-[#d8dade] dark:border-[#27282f] p-5 bg-[#e8ebf0] dark:bg-[#0e0f13] space-y-4"
          >
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                BYOK Endpoint & Model Selection
              </h4>
              <p className="text-[11px] text-zinc-500">
                Configure your API provider. Keys remain strictly inside browser local storage.
              </p>
            </div>

            {/* Base URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Base URL
              </label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:20128"
                className="w-full rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-xs"
              />
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] px-3 pr-10 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Image Endpoint Path (image agent only) */}
            {agent.capability === "text-to-image" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Image Path (default /v1/images/generations)
                </label>
                <input
                  value={imagePath}
                  onChange={(e) => setImagePath(e.target.value)}
                  placeholder="/v1/images/generations"
                  className="w-full rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-xs"
                />
              </div>
            )}

            {/* Fetch Models Button */}
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={busy || !baseUrl}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity shadow-xs"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span>{busy ? "Fetching..." : "Save & Fetch Available Models"}</span>
            </button>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                {error}
              </p>
            )}

            {/* Models Dropdown / Picker */}
            {models.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#d8dade] dark:border-[#27282f]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    Select Model ({models.length} available)
                  </label>
                  <input
                    type="text"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    placeholder="Filter models..."
                    className="rounded-lg border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] px-2.5 py-1 text-[11px] outline-none"
                  />
                </div>

                <div className="max-h-48 divide-y divide-[#dcdfe7] dark:divide-[#23242c] overflow-y-auto rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#f8f9fb] dark:bg-[#14151a] p-1.5 shadow-inner">
                  {filteredModelsList.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors truncate flex items-center justify-between",
                        model === m
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-[#e6e8ee] dark:hover:bg-[#1f2026]"
                      )}
                    >
                      <span className="truncate">{m}</span>
                      {model === m && <Check className="size-3 shrink-0 ml-2" />}
                    </button>
                  ))}
                  {filteredModelsList.length === 0 && (
                    <p className="text-center py-3 text-xs text-zinc-500">
                      No models match filter
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
