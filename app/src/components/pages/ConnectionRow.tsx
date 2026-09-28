import { useState } from "react"
import type { AccountEntry, AccountQuota } from "@/lib/accounts"
import { quotaPct } from "@/lib/accounts"
import { Badge, Icon, Toggle, planVariant, quotaStatus } from "@/lib/nineui"
import { cn } from "@/lib/utils"

// 9router providers/[id]/ConnectionRow.js replica: priority arrows, auth icon
// (lock = oauth, key = apikey), name+email, status/auth/plan Badges, error line,
// Edit/Delete stacked icon buttons + sm Toggle, expandable detail body beneath.
function timeLeft(resetAt?: number): string {
  if (!resetAt) return ""
  const ms = resetAt - Date.now()
  if (ms <= 0) return "now"
  const m = Math.ceil(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  return d > 0 ? `in ${d}d ${h % 24}h` : h > 0 ? `in ${h}h ${m % 60}m` : `in ${m}m`
}

export function ConnectionRow({
  account: a,
  isFirst,
  isLast,
  onToggle,
  onRemove,
  onMove,
  onEdit,
  onUnlock,
  onQuota,
}: {
  account: AccountEntry
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onRemove: () => void
  onMove: (d: -1 | 1) => void
  onEdit: (patch: Partial<AccountEntry>) => void
  onUnlock: () => void
  onQuota: (q: AccountQuota[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [editLabel, setEditLabel] = useState(a.label)
  const [editEmail, setEditEmail] = useState(a.email ?? "")
  const [editModel, setEditModel] = useState(a.imageModel ?? "")
  const [qLabel, setQLabel] = useState("")
  const [qUsed, setQUsed] = useState("")
  const [qLimit, setQLimit] = useState("")
  const [quotaOpen, setQuotaOpen] = useState(false)

  const locked = !!a.lockedUntil && a.lockedUntil > Date.now()
  const error = !!a.lastError
  const ok = !locked && !error
  const isOAuth = a.authType === "oauth"
  const hasQuota = (a.quota?.length ?? 0) > 0
  const input = "rounded-lg border border-9r-border bg-9r-surface-2 px-2.5 py-1.5 text-xs text-9r-text placeholder:text-9r-muted"
  const ellipsis = "\u2026"
  const middot = "\u00b7"

  const addQuota = () => {
    const used = parseInt(qUsed || "0", 10) || 0
    const limit = parseInt(qLimit || "0", 10) || 0
    if (!qLabel.trim() || limit <= 0) return
    onQuota([...(a.quota ?? []), { label: qLabel.trim(), used, limit }])
    setQLabel(""); setQUsed(""); setQLimit("")
  }

  return (
    <div className={cn("group min-w-0 rounded-lg p-2 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]", !a.enabled && "opacity-60")}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-3">
          <div className="flex shrink-0 flex-col">
            <button onClick={() => onMove(-1)} disabled={isFirst} className={cn("rounded p-0.5", isFirst ? "cursor-not-allowed text-9r-muted/30" : "text-9r-muted hover:bg-9r-surface-3 hover:text-9r-brand")}>
              <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
            </button>
            <button onClick={() => onMove(1)} disabled={isLast} className={cn("rounded p-0.5", isLast ? "cursor-not-allowed text-9r-muted/30" : "text-9r-muted hover:bg-9r-surface-3 hover:text-9r-brand")}>
              <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
            </button>
          </div>
          <span className="material-symbols-outlined shrink-0 text-base text-9r-muted">{isOAuth ? "lock" : "key"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-9r-text">{a.label || (isOAuth ? "OAuth Account" : "API Key")}</p>
            {a.email && <p className="truncate text-xs text-9r-muted">{a.email}</p>}
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge variant={!a.enabled ? "default" : error ? "error" : locked ? "warning" : ok ? "success" : "default"} size="sm" dot>
                {!a.enabled ? "disabled" : error ? "error" : locked ? "cooldown" : ok ? "active" : "unknown"}
              </Badge>
              <Badge variant="default" size="sm">{isOAuth ? "OAuth" : "API Key"}</Badge>
              {a.plan && <Badge variant={planVariant(a.plan)} size="sm">{a.plan}</Badge>}
              {a.lastError && a.enabled && (
                <span className="max-w-full truncate text-xs text-red-500 sm:max-w-[300px]" title={a.lastError}>{a.lastError}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div className="grid flex-1 grid-cols-3 gap-1 sm:flex sm:flex-none">
            <button onClick={() => setExpanded((v) => !v)} className="flex flex-col items-center rounded px-2 py-1 text-9r-muted hover:bg-black/5 hover:text-9r-brand dark:hover:bg-white/5">
              <span className="material-symbols-outlined text-[18px]">edit</span>
              <span className="text-[10px] leading-tight">{expanded ? "Hide" : "Edit"}</span>
            </button>
            <button onClick={onRemove} className="flex flex-col items-center rounded px-2 py-1 text-red-500 hover:bg-red-500/10">
              <span className="material-symbols-outlined text-[18px]">delete</span>
              <span className="text-[10px] leading-tight">Delete</span>
            </button>
            {locked && (
              <button onClick={onUnlock} className="flex flex-col items-center rounded px-2 py-1 text-amber-500 hover:bg-amber-500/10">
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                <span className="text-[10px] leading-tight">Unlock</span>
              </button>
            )}
          </div>
          <Toggle size="sm" checked={a.enabled} onChange={onToggle} title={a.enabled ? "Disable connection" : "Enable connection"} />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-9r-border-subtle pt-3">
          <div className="flex items-center gap-2 text-[11px] text-9r-muted">
            <span className="material-symbols-outlined text-[14px]">key</span>
            <span className="truncate font-mono">{showKey ? a.apiKey : `${a.apiKey.slice(0, 4)}${ellipsis}${a.apiKey.slice(-4)}`}</span>
            <button className="hover:text-9r-text" onClick={() => setShowKey((v) => !v)} title={showKey ? "Hide key" : "Show key"}>
              <span className="material-symbols-outlined text-[14px]">{showKey ? "visibility_off" : "visibility"}</span>
            </button>
            <span>{middot}</span>
            <span className="truncate">{a.imagePath || "default image path"}</span>
            <span>{middot}</span>
            <span className="shrink-0">{a.totalImages ?? 0} images</span>
          </div>
          {hasQuota && (
            <div className="mt-3 space-y-4">
              {a.quota!.map((q, qi) => {
                const unlimited = !q.limit
                const remaining = unlimited ? 100 : quotaPct(q)
                const c = quotaStatus(remaining)
                const countdown = timeLeft(q.resetAt)
                return (
                  <div key={qi} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-9r-text">{q.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{c.emoji}</span>
                        <span className={cn("font-medium", c.text)}>{remaining}%</span>
                      </div>
                    </div>
                    {!unlimited && (
                      <div className={cn("h-2 overflow-hidden rounded-full", c.track)}>
                        <div className={cn("h-full transition-all duration-300", c.bar)} style={{ width: `${Math.min(remaining, 100)}%` }} />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-9r-muted">
                      <span>{unlimited ? <span className="text-green-500">{q.used.toLocaleString()} used {middot} Unlimited</span> : `${q.used.toLocaleString()} / ${q.limit.toLocaleString()} requests`}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{countdown ? `Reset ${countdown}` : <span className="italic">N/A</span>}</span>
                        <button className="text-9r-muted hover:text-red-500" title="Remove quota row" onClick={() => onQuota(a.quota!.filter((_, i) => i !== qi))}>
                          <Icon name="close" className="!text-[14px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input className={input} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Name" />
            <input className={input} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
            <input className={input} value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder="Image model" />
            <div className="flex items-center gap-2">
              <button className="inline-flex h-8 items-center gap-1 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600" onClick={() => { onEdit({ label: editLabel || a.label, email: editEmail || undefined, imageModel: editModel || undefined }) }}>
                <Icon name="check" className="!text-[16px]" /> Save
              </button>
              <button className="inline-flex h-8 items-center rounded-lg border border-9r-border px-3 text-xs text-9r-text hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setExpanded(false)}>Cancel</button>
            </div>
          </div>
          {quotaOpen ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              <input className={input} placeholder="Label (e.g. Weekly)" value={qLabel} onChange={(e) => setQLabel(e.target.value)} />
              <input className={input} placeholder="Used" inputMode="numeric" value={qUsed} onChange={(e) => setQUsed(e.target.value)} />
              <input className={input} placeholder="Limit" inputMode="numeric" value={qLimit} onChange={(e) => setQLimit(e.target.value)} />
              <button className="inline-flex h-9 items-center gap-1 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600" onClick={addQuota}>
                <Icon name="add" className="!text-[16px]" /> Add row
              </button>
            </div>
          ) : (
            <button className="mt-2 inline-flex h-7 items-center gap-1 rounded-lg border border-9r-border bg-9r-surface-2 px-2 text-xs text-9r-text hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setQuotaOpen(true)}>
              <Icon name="add" className="!text-[14px]" /> Quota row
            </button>
          )}
          <div className="mt-2 text-[10px] text-9r-muted">priority {a.priority + 1}</div>
        </div>
      )}
    </div>
  )
}
