import { useState } from "react"
import { motion } from "motion/react"
import { Play, Pause, RefreshCw, ClipboardPaste, Volume2, Clock, CheckCircle2 } from "lucide-react"
import { type SceneBeat } from "@/lib/characterGenerator"
import { cn } from "@/lib/utils"

interface Props {
  scenes: SceneBeat[]
  activeSceneId?: string
  onSelectScene?: (id: string) => void
  onRerollScene?: (id: string) => void
  onPasteScene?: (id: string, dataUrl: string) => void
  format?: "16:9" | "9:16"
  className?: string
}

export function InteractiveStoryboardReel({
  scenes,
  activeSceneId,
  onSelectScene,
  onRerollScene,
  onPasteScene,
  format = "16:9",
  className,
}: Props) {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const isShorts = format === "9:16"

  const toggleAudio = (scene: SceneBeat, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!scene.audioUrl) return

    if (playingAudioId === scene.id) {
      setPlayingAudioId(null)
    } else {
      setPlayingAudioId(scene.id)
      const audio = new Audio(scene.audioUrl)
      audio.onended = () => setPlayingAudioId(null)
      audio.play().catch(() => setPlayingAudioId(null))
    }
  }

  const pasteImage = (sceneId: string, file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => onPasteScene?.(sceneId, String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn("w-full overflow-hidden flex flex-col gap-2", className)}>
      {/* Horizontal Reel Scroller */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {scenes.map((scene) => {
          const isSelected = scene.id === activeSceneId
          const isAudioPlaying = playingAudioId === scene.id

          return (
            <motion.div
              key={scene.id}
              whileHover={{ y: -2 }}
              onClick={() => onSelectScene?.(scene.id)}
              className={cn(
                "group relative flex shrink-0 flex-col justify-between overflow-hidden rounded-2xl border p-3 transition-all duration-300 cursor-pointer select-none",
                isShorts ? "w-64" : "w-72",
                isSelected
                  ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                  : "border-border/80 bg-card/70 hover:bg-card hover:border-border"
              )}
            >
              {/* Scene Number & Timing Tag */}
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-500 text-[10px]">
                    {scene.sceneNumber}
                  </span>
                  <span className="truncate max-w-36">{scene.title}</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono font-medium text-muted-foreground">
                  <Clock className="size-3" />
                  {scene.timingSeconds}s
                </span>
              </div>

              {/* Keyframe Thumbnail Container */}
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-xl border border-border/50 bg-black/40 flex items-center justify-center mb-2.5",
                  isShorts ? "aspect-[9/16] max-h-56" : "aspect-[16/9] max-h-36"
                )}
              >
                {scene.keyframeUrl ? (
                  <img
                    src={scene.keyframeUrl}
                    alt={scene.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-muted-foreground/60">
                    <span className="text-xs">Framing Scene...</span>
                  </div>
                )}

                {/* Audio Playing Pulse Badge */}
                {isAudioPlaying && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold animate-pulse">
                    <Volume2 className="size-2.5" />
                    <span>Ducking Audio</span>
                  </div>
                )}

                {/* QC Passed Checkmark */}
                <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-black/60 text-emerald-400 backdrop-blur-xs">
                  <CheckCircle2 className="size-3" />
                </div>
              </div>

              {/* Character Action & Dialogue Snippet */}
              <div className="flex flex-col gap-1 text-xs">
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Action: </span>
                  {scene.characterAction}
                </p>
                <p className="line-clamp-2 text-[11px] font-medium text-foreground italic">
                  "{scene.voiceNarration}"
                </p>
              </div>

              {/* Bottom Actions (Audio Playback & Targeted Re-roll) */}
              <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => toggleAudio(scene, e)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-xs text-foreground font-medium transition-colors"
                  title="Play TTS voice stem"
                >
                  {isAudioPlaying ? (
                    <>
                      <Pause className="size-3 text-rose-500" />
                      <span className="text-[10px]">Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3 text-indigo-500 fill-indigo-500" />
                      <span className="text-[10px]">Audio Stem</span>
                    </>
                  )}
                </button>

                {onRerollScene && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRerollScene(scene.id)
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs transition-colors"
                    title="Subagent E: Autonomous targeted re-roll"
                  >
                    <RefreshCw className="size-3" />
                    <span className="text-[10px]">Re-roll</span>
                  </button>
                )}

                {onPasteScene && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      document.getElementById(`paste-input-${scene.id}`)?.click()
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs transition-colors"
                    title="Paste your own keyframe (AI image or file) for this scene"
                  >
                    <ClipboardPaste className="size-3" />
                    <span className="text-[10px]">Paste</span>
                  </button>
                )}
                <input
                  id={`paste-input-${scene.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    pasteImage(scene.id, e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
