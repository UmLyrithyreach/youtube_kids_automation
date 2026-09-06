import { Clapperboard, ShieldCheck, Download, Play, Loader2 } from "lucide-react"
import { PromptInput } from "@/components/ui/ai-chat-input"
import { AgentCard } from "@/components/agents/AgentCard"
import { AgentFlow } from "@/components/agents/AgentFlow"
import { AGENTS } from "@/lib/agents"
import { useStudio } from "@/lib/pipeline"

export default function App() {
  const studio = useStudio()

  const handleSend = (message: string, meta: { attachments: File[] }) => {
    studio.makeMovie(message, meta.attachments)
  }

  const stageLabel: Record<string, string> = {
    idle: "",
    vision: "Analyzing attachments…",
    script: "Writing script…",
    video: "Generating video…",
    tts: "Recording voice…",
    done: "Movie ready",
    error: "Something went wrong",
  }

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center overflow-y-auto"
      style={{
        backgroundImage:
          "radial-gradient(125% 125% at 50% 101%, rgba(245,87,2,1) 10.5%, rgba(245,120,2,1) 16%, rgba(245,140,2,1) 17.5%, rgba(245,170,100,1) 25%, rgba(238,174,202,1) 40%, rgba(202,179,214,1) 65%, rgba(148,201,233,1) 100%)",
      }}
    >
      <main className="z-10 flex w-full max-w-3xl flex-col items-center gap-6 p-6">
        <header className="mt-6 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
            <Clapperboard className="size-6" /> YouTube Kids Studio
          </h1>
          <p className="mt-1 text-sm text-foreground/70">Describe a movie. Your agents write, film and narrate it.</p>
        </header>

        {/* Ask-anything bar triggers the movie pipeline */}
        <div className="flex w-full justify-center py-6">
          <PromptInput
            onSubmit={handleSend}
            placeholder="Ask for a movie… (e.g. a bunny who builds a rocket)"
          />
        </div>

        {/* Live agent graph — colored cursors hop between agents as they work */}
        {studio.stage !== "idle" && <AgentFlow stage={studio.stage} done={studio.stage === "done"} />}

        {/* Pipeline status */}
        {studio.stage !== "idle" && (
          <section className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium">
              {studio.stage === "error" ? (
                <span className="text-destructive">{studio.stageError}</span>
              ) : studio.stage === "done" ? (
                <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Clapperboard className="size-4" /> {stageLabel[studio.stage]}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> {stageLabel[studio.stage]}
                </span>
              )}
            </div>
            {studio.stageError && <p className="mt-1 text-xs text-destructive">{studio.stageError}</p>}
            {studio.script && studio.stage !== "done" && (
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{studio.script}</pre>
            )}
            {studio.deliverable && (
              <div className="mt-3 space-y-3">
                <video src={studio.deliverable.videoUrl} controls className="w-full rounded-xl border border-border" />
                <audio src={studio.deliverable.audioUrl} controls className="w-full" />
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs">{studio.deliverable.script}</pre>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={studio.deliverable.videoUrl}
                    download="movie.mp4"
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    <Download className="size-3.5" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      // User-confirmed YouTube posting: opens YouTube upload with the file saved locally.
                      if (confirm("Open YouTube Studio to upload this movie?")) {
                        window.open("https://studio.youtube.com/channel/upload", "_blank", "noopener")
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    <Play className="size-3.5" /> Post to YouTube
                  </button>
                  <button
                    type="button"
                    onClick={studio.reset}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    New movie
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Four agents, single page, no routes */}
        <section className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              config={studio.configs[agent.id]}
              onSave={(c) => studio.saveConfig(agent.id, c)}
              status={
                agent.capability === "monitor"
                  ? undefined
                  : {
                      state:
                        studio.stage === "error"
                          ? "probe-fail"
                          : studio.configs[agent.id]
                            ? "idle"
                            : "idle",
                    }
              }
            />
          ))}
        </section>

        {/* Monitor panel */}
        <section className="w-full rounded-2xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" /> Monitor
            </h2>
            <button
              type="button"
              onClick={studio.runMonitors}
              disabled={studio.probing}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {studio.probing && <Loader2 className="size-3.5 animate-spin" />}
              Run self-check
            </button>
          </div>
          {studio.findings && (
            <ul className="mt-3 space-y-1.5">
              {studio.findings.map((f) => (
                <li key={f.agent} className="flex items-start gap-2 text-xs">
                  <span className={f.ok ? "text-emerald-500" : "text-destructive"}>{f.ok ? "✓" : "✕"}</span>
                  <span className="font-medium">{f.agent}</span>
                  <span className="text-muted-foreground">{f.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}