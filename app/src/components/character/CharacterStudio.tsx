import { useState, useRef, useEffect } from "react"
import {
  Sparkles,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  Layers,
  Loader2,
  Sliders,
  Send,
  RefreshCw,
  Star,
  Compass,
  Palette,
  Info,
  Download,
  ClipboardCopy,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"
import {
  loadCharacterVault,
  saveCharacterVault,
  deleteCharacterFromVault,
  restoreCanonicalCharacters,
  setSelectedCharacterId,
  generateCharacterWithAI,
  build360TurnaroundPrompt,
  type Character,
} from "@/lib/characterVault"
import { loadConfigs } from "@/lib/agents"
import { runImage, runImageWithReference } from "@/lib/byok"
import { ShinyButton } from "@/components/ui/ShinyButton"
import { cn } from "@/lib/utils"

interface Props {
  selectedId: string
  onSelectCharacter: (c: Character | null) => void
  onClose?: () => void
}

const INSPIRATION_CHIPS = [
  {
    label: "🦖 Cyber Dino with Jetpack",
    prompt:
      "A brave emerald-green toddler T-Rex named Rexy wearing a miniature chrome jetpack, glowing blue aviator goggles, and tiny bright red sneakers. Energetic and lovable.",
    role: "hero" as const,
  },
  {
    label: "🦊 Astronaut Fox Cadet",
    prompt:
      "A spunky amber fox cub named Rusty wearing an oversized vintage cream astronaut helmet, orange pilot scarf, and dark slate space sneakers. Adventurous and curious.",
    role: "hero" as const,
  },
  {
    label: "🐻 Ukulele Explorer Bear",
    prompt:
      "Barnaby Bear, a gentle honey-gold bear cub with a soft caramel muzzle, forest-green exploration dungarees with brass buttons, holding a small wooden ukulele.",
    role: "friend" as const,
  },
  {
    label: "🤖 Little Assistant Drone",
    prompt:
      "Glow, a small round firefly robot with a shiny pale-blue metallic shell, glowing warm-amber belly monitor screen, tiny translucent wings, and friendly cyan LED eyes.",
    role: "sidekick" as const,
  },
  {
    label: "🦊 Detective Fox with Magnifier",
    prompt:
      "A clever little red-orange fox cub named Rusty wearing a beige tweed detective cap, oversized brass magnifying glass, and cozy navy blue scarf.",
    role: "mentor" as const,
  },
  {
    label: "🦄 Starry Pegasus with Rainbow Mane",
    prompt:
      "A celestial baby pegasus named Nova with iridescent pearlescent white fur, shimmering pastel rainbow mane and tail, and tiny golden hooves that leave stardust trails.",
    role: "friend" as const,
  },
]

export function CharacterStudio({ selectedId, onSelectCharacter }: Props) {
  const [characters, setCharacters] = useState<Character[]>(() => loadCharacterVault())
  const [activeChar, setActiveChar] = useState<Character | null>(() => {
    const chars = loadCharacterVault()
    return chars.find((c) => c.id === selectedId) || chars[0] || null
  })

  // Promptable AI state
  const [promptInput, setPromptInput] = useState("")
  const [selectedRole, setSelectedRole] = useState<Character["role"]>("hero")
  const [selectedStyle, setSelectedStyle] = useState<"3d" | "2d">("3d")
  const [generating, setGenerating] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copied360Prompt, setCopied360Prompt] = useState(false)
  const [renderingImage, setRenderingImage] = useState(false)
  const [renderingPortrait, setRenderingPortrait] = useState(false)
  const [activeAssetTab, setActiveAssetTab] = useState<"turnaround" | "portrait">("turnaround")
  const [showPromptDetails, setShowPromptDetails] = useState(false)
  const [showByokSettings, setShowByokSettings] = useState(false)

  // BYOK configs from agents store
  const configs = loadConfigs()
  const scriptModel = configs.script?.model || "Claude"
  const imageModel = configs.image?.model || "Gemini-PRO-Combo"

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Responsive textarea: auto-expand from 3 to 15 lines, then sleek custom scroll
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    const adjustHeight = () => {
      el.style.height = "auto"
      const computed = window.getComputedStyle(el)
      const lineHeight = parseFloat(computed.lineHeight) || 20
      const paddingTop = parseFloat(computed.paddingTop) || 0
      const paddingBottom = parseFloat(computed.paddingBottom) || 0

      const minHeight = lineHeight * 3 + paddingTop + paddingBottom
      const maxHeight = lineHeight * 15 + paddingTop + paddingBottom

      const scrollHeight = el.scrollHeight
      if (scrollHeight > maxHeight) {
        el.style.height = `${maxHeight}px`
        el.style.overflowY = "auto"
      } else {
        el.style.height = `${Math.max(minHeight, scrollHeight)}px`
        el.style.overflowY = "hidden"
      }
    }

    adjustHeight()
    window.addEventListener("resize", adjustHeight)
    return () => window.removeEventListener("resize", adjustHeight)
  }, [promptInput])

  const handleSelect = (c: Character) => {
    setActiveChar(c)
    setSelectedCharacterId(c.id)
    onSelectCharacter(c)
  }

  // Unrestricted deletion — user can delete ANY character, even down to 0
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = deleteCharacterFromVault(id)
    setCharacters(updated)
    if (activeChar?.id === id) {
      const nextActive = updated.length > 0 ? updated[0] : null
      setActiveChar(nextActive)
      if (nextActive) {
        setSelectedCharacterId(nextActive.id)
        onSelectCharacter(nextActive)
      } else {
        onSelectCharacter(null)
      }
    }
  }

  const handleRestoreDefaults = () => {
    const restored = restoreCanonicalCharacters()
    setCharacters(restored)
    if (restored.length > 0) {
      setActiveChar(restored[0])
      setSelectedCharacterId(restored[0].id)
      onSelectCharacter(restored[0])
    }
  }

  // Textable Prompt-to-AI Character Creation
  const handleGenerateAI = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!promptInput.trim() || generating) return

    setGenerating(true)
    setError(null)
    setProgressText("Dispatching to AI Character Designer...")

    try {
      const fullPrompt = `Role: ${selectedRole.toUpperCase()} MASCOT.\nStyle: ${selectedStyle === "3d" ? "3D Pixar Animation with volumetric lighting" : "2D Storybook Vector Cartoon with clean dark outlines"}.\nRequest: ${promptInput.trim()}`

      const currentConfigs = loadConfigs()
      const newChar = await generateCharacterWithAI(
        fullPrompt,
        currentConfigs.script,
        currentConfigs.image,
        (status) => setProgressText(status)
      )

      // Ensure custom role and style preference
      newChar.role = selectedRole

      const updated = loadCharacterVault()
      setCharacters(updated)
      setActiveChar(newChar)
      setSelectedCharacterId(newChar.id)
      onSelectCharacter(newChar)
      setPromptInput("")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
      setProgressText("")
    }
  }

  // AI Re-render Turnaround Sheet — 2-step: portrait first → reference for sheet
  const handleAiRenderSheet = async () => {
    if (!activeChar) return
    const cimg = configs.image
    if (!cimg || !cimg.baseUrl || !cimg.apiKey || !cimg.model) {
      setError("Configure 360° Modeler in Agents to use AI Image rendering.")
      return
    }

    setRenderingImage(true)
    setError(null)
    try {
      const promptToUse = activeChar.turnaroundPrompt || build360TurnaroundPrompt(activeChar)

      // Step 1: ensure we have a portrait to use as reference
      let referenceUrl = activeChar.portraitUrl
      if (!referenceUrl || referenceUrl.startsWith("data:image/svg")) {
        setProgressText("1/2 Generating character portrait...")
        referenceUrl = await runImage(cimg, activeChar.frozenPrompt)
        // Save the generated portrait
        const withPortrait: Character = { ...activeChar, portraitUrl: referenceUrl }
        const all = loadCharacterVault()
        saveCharacterVault(all.map((c) => (c.id === activeChar.id ? withPortrait : c)))
      }

      // Step 2: generate the 360° sheet (frozen prompt keeps character consistent)
      setProgressText("2/2 Generating 360° sheet...")
      const imgUrl = await runImageWithReference(cimg, promptToUse, referenceUrl)

      const updated: Character = {
        ...activeChar,
        portraitUrl: referenceUrl,
        turnaroundSheetUrl: imgUrl,
        turnaroundPrompt: promptToUse,
      }
      const all = loadCharacterVault()
      const nextList = all.map((c) => (c.id === activeChar.id ? updated : c))
      saveCharacterVault(nextList)
      setCharacters(nextList)
      setActiveChar(updated)
      onSelectCharacter(updated)
      toast.success("360° Model Sheet generated successfully!")
    } catch (err) {
      setError(`AI Render failed: ${(err as Error).message}`)
    } finally {
      setRenderingImage(false)
      setProgressText("")
    }
  }

  // AI Re-render 3D Hero Portrait
  const handleAiRenderPortrait = async () => {
    if (!activeChar) return
    const cimg = configs.image
    if (!cimg || !cimg.baseUrl || !cimg.apiKey || !cimg.model) {
      setError("Configure 360° Modeler in Agents to use AI Image rendering.")
      return
    }

    setRenderingPortrait(true)
    setError(null)
    try {
      const imgUrl = await runImage(cimg, activeChar.frozenPrompt)
      const updated: Character = {
        ...activeChar,
        portraitUrl: imgUrl,
      }
      const all = loadCharacterVault()
      const nextList = all.map((c) => (c.id === activeChar.id ? updated : c))
      saveCharacterVault(nextList)
      setCharacters(nextList)
      setActiveChar(updated)
      onSelectCharacter(updated)
      toast.success("3D Hero Concept Portrait generated successfully!")
    } catch (err) {
      setError(`AI Render failed: ${(err as Error).message}`)
    } finally {
      setRenderingPortrait(false)
    }
  }

  // Copy Image directly to clipboard so user can paste into Google Veo / Wan
  const copyImageBlob = async (url: string, label = "Image") => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      let pngBlob = blob

      // Ensure blob is PNG for ClipboardItem compatibility
      if (blob.type !== "image/png") {
        const img = new Image()
        img.crossOrigin = "anonymous"
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = url
        })
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth || 1024
        canvas.height = img.naturalHeight || 1024
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0)
        pngBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png")
        )
      }

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2500)
      toast.success(`${label} copied to clipboard! Ready to paste into Veo.`)
    } catch {
      await navigator.clipboard.writeText(url)
      toast.info(`${label} URL copied to clipboard.`)
    }
  }

  const copyTurnaroundPromptText = () => {
    if (!activeChar) return
    const text = activeChar.turnaroundPrompt || build360TurnaroundPrompt(activeChar)
    navigator.clipboard.writeText(text)
    setCopied360Prompt(true)
    setTimeout(() => setCopied360Prompt(false), 2000)
    toast.success("360° Turnaround Prompt copied to clipboard!")
  }

  const copyPrompt = () => {
    if (!activeChar) return
    navigator.clipboard.writeText(activeChar.frozenPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Concept Portrait prompt copied!")
  }

  const downloadSheet = (url: string, filename: string) => {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    toast.success(`Downloading ${filename}...`)
  }

  const handleApplyChip = (chip: typeof INSPIRATION_CHIPS[number]) => {
    setPromptInput(chip.prompt)
    setSelectedRole(chip.role)
  }

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Top Banner: Info & BYOK Status */}
      <div className="rounded-2xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Compass className="size-5 text-indigo-500 dark:text-sky-400" />
              <span>Character Studio & Reusable Cast Vault</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Characters are designed once and reused across songs. You can delete whatever you want and prompt as much detail as you need.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-[#e4e6ed] dark:bg-[#1c1e25] px-3 py-1.5 border border-[#d2d5de] dark:border-[#272832] text-xs">
              <span className="text-zinc-500 font-medium">BYOK:</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{scriptModel}</span>
              <span className="text-zinc-400">•</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{imageModel}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowByokSettings((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors shadow-xs",
                showByokSettings
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
                  : "border-[#d2d5de] dark:border-[#272832] bg-[#e4e6ed] dark:bg-[#1c1e25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d8dbe3]"
              )}
            >
              <Sliders className="size-3.5" />
              <span>Configure</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-[#e4e6ed] dark:bg-[#1c1e25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d8dbe3] dark:hover:bg-[#252731] text-xs font-medium transition-colors shadow-xs"
              title="Restore canonical characters"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Collapsible BYOK Model Status */}
        {showByokSettings && (
          <div className="p-4 rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-[#e6e8ee] dark:bg-[#101115] text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-500">LLM Designer:</span>
                <span className="font-mono bg-[#f0f1f5] dark:bg-[#1c1e25] px-2 py-0.5 rounded border border-[#d2d5de] dark:border-[#272832] text-zinc-900 dark:text-zinc-100">
                  {scriptModel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-500">360° Modeler:</span>
                <span className="font-mono bg-[#f0f1f5] dark:bg-[#1c1e25] px-2 py-0.5 rounded border border-[#d2d5de] dark:border-[#272832] text-zinc-900 dark:text-zinc-100">
                  {imageModel}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Configured via Production Agents (9router / OpenAI / Custom).
            </p>
          </div>
        )}

        {/* Expansive Promptable AI Creation Workshop */}
        <form onSubmit={handleGenerateAI} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="size-4 text-indigo-500 dark:text-sky-400" />
              <span>Prompt New Character to AI</span>
            </label>

            {/* Quick Controls: Role & Style Selection */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center rounded-lg bg-[#e2e4ea] dark:bg-[#1c1d25] p-0.5 border border-[#d0d3dc] dark:border-[#2b2c34]">
                {(["hero", "sidekick", "mentor", "friend"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-medium capitalize transition-all",
                      selectedRole === r
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex items-center rounded-lg bg-[#e2e4ea] dark:bg-[#1c1d25] p-0.5 border border-[#d0d3dc] dark:border-[#2b2c34]">
                {(["3d", "2d"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStyle(st)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-md text-[11px] font-medium uppercase transition-all",
                      selectedStyle === st
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                    )}
                  >
                    {st === "3d" ? "3D Pixar" : "2D Vector"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Inspiration Chips - responsive wrap, no horizontal scroll */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0">Ideas:</span>
            {INSPIRATION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleApplyChip(chip)}
                className="rounded-full border border-[#d0d3dc] dark:border-[#2a2b35] bg-[#e4e6ec] dark:bg-[#181920] px-2.5 py-1 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-sky-400 dark:hover:text-sky-300 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Redesigned Responsive Prompt Textarea */}
          <div className="relative flex flex-col rounded-2xl border border-zinc-300/80 dark:border-[#272832] bg-white dark:bg-[#111217] p-3.5 shadow-xs transition-all duration-200 focus-within:border-indigo-500/80 dark:focus-within:border-sky-500/80 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:focus-within:ring-sky-400/10">
            <textarea
              ref={textareaRef}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void handleGenerateAI()
                }
              }}
              disabled={generating}
              rows={3}
              placeholder="Describe your mascot in full creative freedom...&#10;• Name, species & traits (e.g. A brave cyber-dino or magical kitten)&#10;• Colors, clothing, goggles, wings, jetpack, or signature items&#10;• Personality vibe for kids (upbeat, silly, gentle, heroic)"
              className="w-full bg-transparent text-[13px] leading-relaxed text-zinc-900 dark:text-zinc-100 outline-none resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 custom-scrollbar pr-1"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 mt-1">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                <span>Press</span>
                <kbd className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700/80 font-semibold text-zinc-600 dark:text-zinc-300 shadow-2xs">
                  Cmd+Enter
                </kbd>
                <span>to generate</span>
              </div>

              <div className="flex items-center gap-2">
                {promptInput.trim() && (
                  <button
                    type="button"
                    onClick={() => setPromptInput("")}
                    className="inline-flex items-center justify-center p-2 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                    title="Clear prompt"
                    aria-label="Clear prompt"
                  >
                    <Trash2 className="size-4 text-rose-500" />
                  </button>
                )}

                <ShinyButton
                  type="submit"
                  disabled={generating || !promptInput.trim()}
                  loading={generating}
                  icon={<Send className="size-3.5" />}
                >
                  {generating ? "Creating Mascot DNA..." : "Generate Mascot with AI"}
                </ShinyButton>
              </div>
            </div>
          </div>

          {progressText && (
            <p className="text-xs text-indigo-600 dark:text-sky-400 flex items-center gap-1.5 animate-pulse mt-0.5">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{progressText}</span>
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
              Error: {error}
            </p>
          )}
        </form>
      </div>

      {/* Main Grid: Left Roster List (Unrestricted Deletion), Right Detail Sheet View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Reusable Cast List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Cast Vault ({characters.length})
            </h3>
            <span className="text-[11px] text-zinc-500">Select to Inspect</span>
          </div>

          {characters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5]/50 dark:bg-[#14151b]/50 p-6 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <Sparkles className="size-5 text-zinc-400" />
              <span>Cast Vault is completely empty.</span>
              <span className="text-[11px] text-zinc-500">Prompt above to create characters, or click Reset Defaults.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
              {characters.map((c) => {
                const isSelected = activeChar?.id === c.id
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={cn(
                      "group relative flex flex-col gap-2 p-4 rounded-2xl border transition-all cursor-pointer shadow-xs",
                      isSelected
                        ? "border-indigo-500 dark:border-sky-400 bg-white dark:bg-[#16171e] ring-1 ring-indigo-500/20 shadow-md"
                        : "border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] hover:border-zinc-400 dark:hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="size-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                          style={{ backgroundColor: c.palette.primary }}
                        >
                          <span className="text-white text-xs font-bold uppercase">
                            {c.name.slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {c.name}
                            </h4>
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold bg-[#e4e6ed] dark:bg-[#1f202a] text-zinc-700 dark:text-zinc-300">
                              {c.role}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {c.species}
                          </p>
                        </div>
                      </div>

                      {/* Delete icon — Unrestricted deletion on ANY character */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(c.id, e)}
                        className="opacity-60 group-hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                        title={`Delete ${c.name} from vault`}
                      >
                        <Trash2 className="size-3.5 text-zinc-400 hover:text-rose-600" />
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {c.tagline || c.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-1">
                        <span
                          className="size-3 rounded-full border border-black/20"
                          style={{ backgroundColor: c.palette.primary }}
                          title={`Primary: ${c.palette.primary}`}
                        />
                        <span
                          className="size-3 rounded-full border border-black/20"
                          style={{ backgroundColor: c.palette.secondary }}
                          title={`Secondary: ${c.palette.secondary}`}
                        />
                        <span
                          className="size-3 rounded-full border border-black/20"
                          style={{ backgroundColor: c.palette.accent }}
                          title={`Accent: ${c.palette.accent}`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelect(c)
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-[#e2e4ea] dark:bg-[#1e1f28] text-zinc-700 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 hover:text-indigo-600"
                        )}
                      >
                        {isSelected ? "★ Starring" : "Set Star"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Character Inspection or Empty State (8 cols) */}
        {!activeChar ? (
          <div className="lg:col-span-8 flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5]/50 dark:bg-[#14151b]/50 text-center min-h-[460px]">
            <div className="size-14 rounded-2xl bg-[#e4e6ed] dark:bg-[#1c1e25] flex items-center justify-center mb-3">
              <Sparkles className="size-7 text-indigo-500 dark:text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Cast Vault is Empty
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-5">
              You can delete as many characters as you want. Use the prompt box above to generate your custom mascot with AI, or restore canonical mascots.
            </p>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="size-4" />
              <span>Restore Canonical Mascots</span>
            </button>
          </div>
        ) : (
          <div className="lg:col-span-8 flex flex-col gap-5 rounded-2xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] p-6 shadow-sm">
            {/* Active Header & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div
                  className="size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                  style={{ backgroundColor: activeChar.palette.primary }}
                >
                  <Star className="size-5 text-white fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {activeChar.name}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#e2e4ea] dark:bg-[#1e1f28] text-zinc-700 dark:text-zinc-300">
                      {activeChar.role}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {activeChar.species} • {activeChar.tagline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAiRenderSheet}
                  disabled={renderingImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#d0d3dc] dark:border-[#2c2d36] bg-[#e4e6ec] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e0] dark:hover:bg-[#252631] text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                  title="Call 360 Modeler agent via BYOK to generate an AI turnaround sheet"
                >
                  {renderingImage ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-indigo-500" />
                      <span>Rendering...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" />
                      <span>AI Render Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Description */}
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-[#e8eaf0] dark:bg-[#0e0f13] p-3 rounded-xl border border-[#d0d3dc] dark:border-[#24252c]">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Character Description: </span>
              {activeChar.description}
            </div>

            {/* Dual Asset Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#e4e6ed] dark:bg-[#181920] border border-[#d0d3dc] dark:border-[#272832]">
                <button
                  type="button"
                  onClick={() => setActiveAssetTab("turnaround")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    activeAssetTab === "turnaround"
                      ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-sky-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  )}
                >
                  <Layers className="size-3.5" />
                  <span>360° Turnaround Model Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAssetTab("portrait")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    activeAssetTab === "portrait"
                      ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-sky-400 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                  )}
                >
                  <ImageIcon className="size-3.5" />
                  <span>3D Hero Concept Portrait</span>
                </button>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex items-center gap-1.5">
                {activeAssetTab === "turnaround" && activeChar.turnaroundSheetUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      copyImageBlob(activeChar.turnaroundSheetUrl!, "360° Model Sheet")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-xs font-semibold shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                    title="Copy image directly to clipboard to paste into Google Veo"
                  >
                    <ClipboardCopy className="size-3.5" />
                    <span>{copiedImage ? "Copied Image!" : "Copy Image (Paste into Veo)"}</span>
                  </button>
                )}

                {activeAssetTab === "portrait" && activeChar.portraitUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      copyImageBlob(activeChar.portraitUrl!, "3D Hero Portrait")
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white text-xs font-semibold shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                    title="Copy hero portrait to clipboard"
                  >
                    <ClipboardCopy className="size-3.5" />
                    <span>{copiedImage ? "Copied Portrait!" : "Copy Portrait (Paste into Veo)"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Viewport: 360 Turnaround Sheet Viewport */}
            {activeAssetTab === "turnaround" && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-indigo-500" />
                    360° Turnaround Reference Sheet (7 Poses + Details + Expressions)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeChar.turnaroundSheetUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadSheet(
                            activeChar.turnaroundSheetUrl!,
                            `${activeChar.name.toLowerCase()}-360-sheet.png`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d0d3dc] dark:border-[#2c2d36] bg-[#e4e6ec] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e0] text-xs transition-colors"
                      >
                        <Download className="size-3" />
                        <span>Download PNG</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyTurnaroundPromptText}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d0d3dc] dark:border-[#2c2d36] bg-[#e4e6ec] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e0] text-xs transition-colors"
                    >
                      <Copy className="size-3 text-sky-500" />
                      <span>{copied360Prompt ? "Copied!" : "Copy 360° Prompt"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAiRenderSheet}
                      disabled={renderingImage}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                    >
                      {renderingImage ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      <span>AI Render Sheet</span>
                    </button>
                  </div>
                </div>

                <div className="w-full rounded-2xl border border-[#d0d3dc] dark:border-[#2b2c34] bg-white dark:bg-[#0c0d11] overflow-hidden shadow-inner">
                  {activeChar.turnaroundSheetUrl ? (
                    <div className="relative group p-3 flex flex-col items-center justify-center">
                      <img
                        src={activeChar.turnaroundSheetUrl}
                        alt={`${activeChar.name} 360 Turnaround`}
                        className="max-h-[380px] w-full object-contain rounded-xl"
                      />
                      <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() =>
                            copyImageBlob(
                              activeChar.turnaroundSheetUrl!,
                              "360° Model Sheet"
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold backdrop-blur hover:bg-indigo-500 shadow-lg cursor-pointer flex items-center gap-1"
                        >
                          <ClipboardCopy className="size-3.5" />
                          <span>Copy for Veo</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAiRenderSheet}
                          disabled={renderingImage}
                          className="px-3 py-1.5 rounded-xl bg-black/70 text-white text-xs font-semibold backdrop-blur hover:bg-black shadow-lg cursor-pointer disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center min-h-[220px]">
                      <Layers className="size-8 text-zinc-300 dark:text-zinc-600" />
                      <p className="text-xs text-zinc-500">No 360° model sheet generated yet.</p>
                      <button
                        type="button"
                        onClick={handleAiRenderSheet}
                        disabled={renderingImage}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
                      >
                        {renderingImage ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        <span>{renderingImage ? progressText || "Generating..." : "Generate 360° Sheet with AI"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Viewport: 3D Hero Concept Portrait */}
            {activeAssetTab === "portrait" && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <ImageIcon className="size-3.5 text-indigo-500" />
                    3D Hero Concept Portrait (Pixar / Disney Stylized Render)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeChar.portraitUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadSheet(
                            activeChar.portraitUrl!,
                            `${activeChar.name.toLowerCase()}-portrait.png`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d0d3dc] dark:border-[#2c2d36] bg-[#e4e6ec] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e0] text-xs transition-colors"
                      >
                        <Download className="size-3" />
                        <span>Download PNG</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#d0d3dc] dark:border-[#2c2d36] bg-[#e4e6ec] dark:bg-[#1c1d25] text-zinc-700 dark:text-zinc-300 hover:bg-[#d6d9e0] text-xs transition-colors"
                    >
                      <Copy className="size-3 text-indigo-500" />
                      <span>{copied ? "Copied!" : "Copy Portrait Prompt"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAiRenderPortrait}
                      disabled={renderingPortrait}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                    >
                      {renderingPortrait ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      <span>AI Render Portrait</span>
                    </button>
                  </div>
                </div>

                <div className="w-full rounded-2xl border border-[#d0d3dc] dark:border-[#2b2c34] bg-white dark:bg-[#0c0d11] overflow-hidden shadow-inner">
                  {activeChar.portraitUrl ? (
                    <div className="relative group p-3 flex flex-col items-center justify-center">
                      <img
                        src={activeChar.portraitUrl}
                        alt={`${activeChar.name} 3D Portrait`}
                        className="max-h-[380px] w-full object-contain rounded-xl"
                      />
                      <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() =>
                            copyImageBlob(
                              activeChar.portraitUrl!,
                              "3D Hero Portrait"
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold backdrop-blur hover:bg-indigo-500 shadow-lg cursor-pointer flex items-center gap-1"
                        >
                          <ClipboardCopy className="size-3.5" />
                          <span>Copy for Veo</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center min-h-[220px]">
                      <ImageIcon className="size-8 text-zinc-300 dark:text-zinc-600" />
                      <p className="text-xs text-zinc-500">No 3D concept portrait generated yet.</p>
                      <button
                        type="button"
                        onClick={handleAiRenderPortrait}
                        disabled={renderingPortrait}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                      >
                        Generate 3D Portrait
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible 360 Turnaround Prompt Inspector */}
            <div className="flex flex-col gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPromptDetails((v) => !v)}
                className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 p-2 rounded-xl bg-[#e4e6ed] dark:bg-[#181920] border border-[#d0d3dc] dark:border-[#272832] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-sky-500" />
                  <span>Asset Bible 360° Turnaround Prompt (7 Poses + Panels)</span>
                </span>
                {showPromptDetails ? (
                  <ChevronUp className="size-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="size-3.5 text-zinc-400" />
                )}
              </button>

              {showPromptDetails && (
                <div className="relative flex flex-col gap-2 rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#e8eaf0] dark:bg-[#0e0f13] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-500">Full 360° Modeler Prompt:</span>
                    <button
                      type="button"
                      onClick={copyTurnaroundPromptText}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-500 hover:underline cursor-pointer"
                    >
                      <Copy className="size-3" />
                      <span>{copied360Prompt ? "Copied!" : "Copy Full Prompt"}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={activeChar.turnaroundPrompt || build360TurnaroundPrompt(activeChar)}
                    rows={8}
                    className="w-full bg-transparent text-xs font-mono leading-relaxed text-zinc-800 dark:text-zinc-200 outline-none select-all resize-none"
                  />
                </div>
              )}
            </div>

            {/* Canonical Palette Swatches */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Palette className="size-3.5 text-amber-500" />
                  Canonical Palette (Locked Hex Tokens)
                </span>
                <span className="text-[11px] font-normal text-zinc-500">
                  Enforced in all scene prompts
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(activeChar.palette)
                  .filter(([k]) => !["name", "species"].includes(k))
                  .map(([key, val]) => (
                    <div
                      key={key}
                      className="flex flex-col gap-1 p-2 rounded-xl bg-[#e6e8ee] dark:bg-[#1c1d25] border border-[#d0d3dc] dark:border-[#292a34]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-3.5 rounded-md border border-black/20 shrink-0"
                          style={{ backgroundColor: val as string }}
                        />
                        <span className="text-[10px] capitalize font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {key}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        {val as string}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Frozen Master Prompt Block (Jack Vs. AI Pattern) */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-indigo-500 dark:text-sky-400" />
                  Frozen Master Prompt Block
                </span>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-sky-400 hover:underline"
                >
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copied ? "Copied!" : "Copy Frozen Prompt"}</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={activeChar.frozenPrompt}
                  rows={4}
                  className="w-full rounded-xl border border-[#d0d3dc] dark:border-[#262730] bg-[#e8eaf0] dark:bg-[#0e0f13] p-3 text-xs font-mono leading-relaxed text-zinc-800 dark:text-zinc-200 outline-none select-all"
                />
              </div>

              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Info className="size-3" />
                <span>
                  This block is injected verbatim into every scene generation to prevent character drift in Seedance, Veo, or Kling.
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
