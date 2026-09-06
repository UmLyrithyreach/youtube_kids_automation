import { useState } from "react"
import { Settings, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { filterModelsByCapability, type AgentConfig, type AgentDef } from "@/lib/agents"
import { fetchModels } from "@/lib/byok"

interface Props {
  agent: AgentDef
  config: AgentConfig | null
  onSave: (c: AgentConfig) => void
  status?: { state: "idle" | "probe-ok" | "probe-fail" | "busy"; detail?: string }
}

export function AgentCard({ agent, config, onSave, status }: Props) {
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? "")
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "")
  const [model, setModel] = useState(config?.model ?? "")
  const [models, setModels] = useState<string[]>(config?.models ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = !!config?.baseUrl && !!config?.apiKey && !!config?.model

  const saveAndFetch = async () => {
    setBusy(true)
    setError(null)
    try {
      const fetched = await fetchModels({ baseUrl, apiKey, model, models: [] })
      const filtered = agent.capability === "monitor" ? fetched : filterModelsByCapability(fetched, agent.capability)
      setModels(filtered)
      // Keep prior pick if still valid, else first capability-matching model
      const keep = filtered.includes(model) ? model : filtered[0] ?? ""
      setModel(keep)
      onSave({ baseUrl, apiKey, model: keep, models: filtered })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pick = (m: string) => {
    setModel(m)
    onSave({ baseUrl, apiKey, model: m, models })
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm transition-all",
        status?.state === "probe-fail" && "border-destructive/50",
        status?.state === "probe-ok" && "border-emerald-500/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
            {status?.state === "busy" && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            {status?.state === "probe-ok" && <Check className="size-3.5 text-emerald-500" />}
            {status?.state === "probe-fail" && <span className="text-xs text-destructive">✕</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-accent hover:text-foreground",
            open && "bg-accent text-foreground"
          )}
          aria-label={`Configure ${agent.name}`}
        >
          <Settings className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-medium",
            configured ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          )}
        >
          {configured ? model : "not configured"}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">{agent.capability}</span>
      </div>

      {status?.detail && <p className="mt-2 text-xs text-destructive">{status.detail}</p>}

      {open && (
        <div className="mt-3 space-y-2">
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL (e.g. https://api.openai.com)"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring/40"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="API key (stays in your browser)"
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring/40"
          />
          <button
            type="button"
            onClick={saveAndFetch}
            disabled={busy || !baseUrl || !apiKey}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save + Fetch models
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {models.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(m)}
                  className={cn(
                    "block w-full truncate rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-accent",
                    model === m && "bg-accent font-medium"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}