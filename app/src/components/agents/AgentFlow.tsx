// Live agent graph: 5 agent nodes; a colored cursor hops to whichever agent
// is currently working, with the agent's name riding along.
import { cn } from "@/lib/utils"
import { type Stage } from "@/lib/pipeline"

const NODES: { id: string; name: string; stage: Stage; color: string }[] = [
  { id: "vision", name: "Vision Analyst", stage: "vision", color: "bg-fuchsia-500" },
  { id: "script", name: "Script Writer", stage: "script", color: "bg-amber-500" },
  { id: "video", name: "Video Generator", stage: "video", color: "bg-sky-500" },
  { id: "tts", name: "Voice (TTS)", stage: "tts", color: "bg-emerald-500" },
  { id: "monitor", name: "Monitor", stage: "idle", color: "bg-rose-500" },
]

function CursorGlyph({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className={color} aria-hidden="true">
      <path d="M5.5 3.2l14.2 8.1-6.3 1.5-3 5.9z" fill="currentColor" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function AgentFlow({ stage, done }: { stage: Stage; done: boolean }) {
  return (
    <div className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
      <h2 className="mb-3 text-sm font-semibold">Agent pipeline</h2>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {NODES.map((n) => {
          const active = stage === n.stage && !done
          const finished =
            (stage === "done" || done) ||
            // anything before the current stage in the list is finished
            NODES.findIndex((x) => x.stage === stage) > NODES.findIndex((x) => x.stage === n.stage) && stage !== "idle" && stage !== "error"
          return (
            <div key={n.id} className="relative flex flex-col items-center gap-1.5">
              {/* cursor sits above the active node */}
              <div className={cn("absolute -top-5 flex items-center gap-1 transition-all duration-300", active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1")}>
                <CursorGlyph color={n.color} />
                <span className={cn("text-[10px] font-semibold", n.color.replace("bg-", "text-"))}>{n.name}</span>
              </div>
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl border text-[10px] font-bold uppercase transition-all duration-300",
                  n.color.replace("bg-", "border-").replace("500", "200"),
                  active && `${n.color} text-white border-transparent scale-110 shadow-lg`,
                  finished && !active && "opacity-60",
                )}
                title={n.name}
              >
                {n.name.split(" ")[0].slice(0, 7)}
              </div>
              <span className={cn("text-[10px] text-muted-foreground", active && "font-semibold text-foreground")}>{n.name}</span>
              <span className={cn("text-[9px]", finished ? "text-emerald-500" : active ? "text-foreground" : "text-muted-foreground/50")}>
                {finished ? "✓ done" : active ? "working…" : "waiting"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}