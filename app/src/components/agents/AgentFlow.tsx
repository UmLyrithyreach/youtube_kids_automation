// Live pipeline graph in Obsidian-graph-view style: dark canvas, filled
// round nodes per agent, hairline edges, small centered labels below nodes.
// A cursor rides the currently-working agent; finished nodes brighten.
import { type Stage } from "@/lib/pipeline"

interface Node {
  id: string
  name: string
  stage: Stage
  size: number
  x: number // % position on canvas — fixed organic scatter layout
  y: number
}

// Pipeline order flows left→right; monitor hangs below as a satellite.
const NODES: Node[] = [
  { id: "vision", name: "Vision Analyst", stage: "vision", size: 34, x: 10, y: 30 },
  { id: "script", name: "Script Writer", stage: "script", size: 40, x: 32, y: 18 },
  { id: "video", name: "Video Generator", stage: "video", size: 44, x: 55, y: 40 },
  { id: "tts", name: "Voice (TTS)", stage: "tts", size: 38, x: 78, y: 22 },
  { id: "done", name: "Movie", stage: "done", size: 48, x: 92, y: 58 },
  { id: "monitor", name: "Monitor", stage: "idle", size: 26, x: 42, y: 72 },
]

// hairline edges between pipeline stages + monitor link
const EDGES: [string, string][] = [
  ["vision", "script"],
  ["script", "video"],
  ["video", "tts"],
  ["tts", "done"],
  ["script", "monitor"],
  ["video", "monitor"],
  ["tts", "monitor"],
]


export function AgentFlow({ stage, done }: { stage: Stage; done: boolean }) {
  const order = ["vision", "script", "video", "tts"]
  const activeId =
    done || stage === "done"
      ? "done"
      : stage === "error"
        ? null
        : (NODES.find((n) => n.stage === stage)?.id ?? null)

  const finished = (id: string) => {
    if (id === "monitor") return false
    const idx = order.indexOf(id)
    if (id === "done") return done || stage === "done"
    return stage !== "idle" && stage !== "error" && idx >= 0 && order.findIndex((s) => s === stage) > idx
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className="relative h-52 w-full" style={{ background: "radial-gradient(ellipse at center, #23232b 0%, #16161c 75%)" }}>
        {/* hairline edges */}
        <svg className="absolute inset-0 size-full" aria-hidden="true">
          {EDGES.map(([a, b]) => {
            const na = NODES.find((n) => n.id === a)!
            const nb = NODES.find((n) => n.id === b)!
            const lit = activeId === a || activeId === b
            return (
              <line
                key={`${a}-${b}`}
                x1={`${na.x}%`} y1={`${na.y}%`}
                x2={`${nb.x}%`} y2={`${nb.y}%`}
                stroke={lit ? "#9a9aa8" : "#3d3d46"}
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {/* nodes */}
        {NODES.map((n) => {
          const isActive = n.id === activeId
          const isFinished = finished(n.id)
          const base = n.id === "done" ? "#b9a6e8" : "#c8c8d4"
          return (
            <div
              key={n.id}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {/* cursor above the active node */}
              <div
                className={`absolute -top-7 flex items-center gap-1 transition-all duration-300 ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5.5 3.2l14.2 8.1-6.3 1.5-3 5.9z" fill="#e8e8f2" stroke="#16161c" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px] font-semibold text-foreground">{n.name}</span>
              </div>
              <div
                className={`rounded-full transition-all duration-300 ${isActive ? "animate-pulse" : ""}`}
                style={{
                  width: n.size,
                  height: n.size,
                  background: base,
                  opacity: isActive ? 1 : isFinished ? 0.55 : 0.28,
                  boxShadow: isActive
                    ? "0 0 18px 4px rgba(200,200,212,0.45)"
                    : isFinished
                      ? "0 0 6px 1px rgba(200,200,212,0.18)"
                      : "none",
                }}
                title={n.name}
              />
              <span
                className={`mt-1 max-w-24 truncate text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                style={{ opacity: isActive || isFinished ? 1 : 0.6 }}
              >
                {n.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}