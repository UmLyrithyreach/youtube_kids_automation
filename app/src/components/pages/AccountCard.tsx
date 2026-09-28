import { useState } from "react"
import type { AccountEntry, AccountQuota } from "@/lib/accounts"
import { quotaPct } from "@/lib/accounts"
import { Badge, Icon, ProviderIcon, Toggle, planVariant, providerColor, providerSlug, quotaStatus } from "@/lib/nineui"
import { cn } from "@/lib/utils"

// One account card — 9router ProviderLimitCard anatomy, verbatim tokens:
// rounded-[14px] Card, size-10 icon tile (providerColor + "15" alpha), name +
// plan Badge, refresh-style icon buttons, material-symbols status icons,
// h-2 rounded-full bars with emoji + remaining-%, reset countdown lines.

function timeLeft(resetAt?: number): string {
  if (!resetAt) return ""
  const ms = resetAt - Date.now()
  if (ms <= 0) return "now"
  const m = Math.ceil(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  return d > 0 ? `in ${d}d ${h % 24}h` : h > 0 ? `in ${h}h ${m % 60}m` : `in ${m}m`
}

export function AccountCard({
  account: a,
  locked,
  showKey,
  index,
  isLast,
  onQuota,
  onEdit,
  onUnlock,
  onToggle,
  onRemove,
  onMove,
}: {
  account: AccountEntry
  locked: boolean
  showKey: boolean
  index: number
  isLast: boolean
  onQuota: (q: AccountQuota[]) => void
  onEdit: (patch: Partial<AccountEntry>) => void
  onUnlock: () => void
  onToggle: () => void
  onRemove: () => void
  onMove: (d: -1 | 1) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [editLabel, setEditLabel] = useState(a.label)
  const [editEmail, setEditEmail] = useState(a.email ?? "")
  const [editModel, setEditModel] = useState(a.imageModel ?? "")
  const [quotaOpen, setQuotaOpen] = useState(false)
  const [qLabel, setQLabel] = useState("")
  const [qUsed, setQUsed] = useState("")
  const [qLimit, setQLimit] = useState("")

  const addQuota = () => {
    const used = parseInt(qUsed || "0", 10) || 0
    const limit = parseInt(qLimit || "0", 10) || 0
    if (!qLabel.trim() || limit <= 0) return
    onQuota([...(a.quota ?? []), { label: qLabel.trim(), used, limit }])
    setQLabel("")
    setQUsed("")
    setQLimit("")
  }

  const family = a.provider || ""
  const color = providerColor(family)
  const slug = providerSlug(family)
  const hasQuota = (a.quota?.length ?? 0) > 0
  const ok = hasQuota && !locked && a.quota!.some((q) => quotaPct(q) > 0)
  const error = !locked && !!a.lastError

  const input = "rounded-lg border border-9r-border bg-9r-surface-2 px-2.5 py-1.5 text-xs text-9r-text placeholder:text-9r-muted"

  return (
    <div className={cn("rounded-[14px] border bg-9r-surface p-3.5 shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.3))]", locked ? "border-amber-500/40" : "border-9r-border")}>
      {/* Header — 9router ProviderLimitCard header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {/* Provider logo tile (size-10, brand color at 15 alpha) */}
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg p-1.5"
            style={{ backgroundColor: `${color}15` }}
          >
            <ProviderIcon
              providerId={slug}
              alt={family}
              size={40}
              className="max-h-[40px] max-w-[40px] rounded-lg object-contain"
              fallbackText={family.slice(0, 2).toUpperCase() || a.label.slice(0, 2).toUpperCase()}
              fallbackColor={color}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-9r-text">{a.label}</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              {a.authType === "oauth" ? (
                <Badge variant="info" size="sm" dot>OAuth</Badge>
              ) : (
                <Badge variant="default" size="sm" dot>API Key</Badge>
              )}
              {a.plan && <Badge variant={planVariant(a.plan)} size="sm">{a.plan}</Badge>}
              {a.email && <span className="truncate text-9r-muted">{a.email}</span>}
              {locked && (
                <Badge variant="warning" size="sm" icon="pause_circle">
                  quota-locked {Math.max(0, Math.ceil((a.lockedUntil! - Date.now()) / 60000))}m
                </Badge>
              )}
              {error && (
                <Badge variant="error" size="sm" icon="error" className="max-w-40 truncate">{a.lastError}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions — 9router icon-button cluster + sm Toggle */}
        <div className="flex shrink-0 items-center gap-1">
          <button className="rounded p-1.5 text-9r-muted hover:bg-black/5 hover:text-9r-text dark:hover:bg-white/5" title="Edit account" onClick={() => setEditOpen(!editOpen)}>
            <Icon name="edit" className="!text-[16px]" />
          </button>
          <button className="rounded p-1.5 text-9r-muted hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/5" title="Remove account" onClick={onRemove}>
            <Icon name="delete" className="!text-[16px]" />
          </button>
          <div className="flex flex-col">
            <button className="text-9r-muted hover:text-9r-text disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
              <Icon name="keyboard_arrow_up" className="!text-[14px]" />
            </button>
            <button className="text-9r-muted hover:text-9r-text disabled:opacity-30" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down">
              <Icon name="keyboard_arrow_down" className="!text-[14px]" />
            </button>
          </div>
          <Toggle size="sm" checked={a.enabled} onChange={onToggle} title={a.enabled ? "Disable account" : "Enable account"} />
        </div>
      </div>

      {/* Key / path / counter line — 9router connection meta row */}
      <div className="mt-2 flex items-center gap-2 pl-[52px] text-[11px] text-9r-muted">
        <span className="material-symbols-outlined text-[14px]">key</span>
        <span className="truncate font-mono">{showKey ? a.apiKey : `${a.apiKey.slice(0, 4)}…${a.apiKey.slice(-4)}`}</span>
        <span>·</span>
        <span className="truncate">{a.imagePath || "default image path"}</span>
        <span>·</span>
        <span className="shrink-0">{a.totalImages ?? 0} images</span>
        <span className={cn("material-symbols-outlined text-[14px]", locked || error ? "text-amber-400" : ok ? "text-green-500" : "text-9r-muted")} title={locked ? "quota-locked" : error ? a.lastError : ok ? "available" : "no quota rows"}>{locked || error ? "pause_circle" : ok ? "check_circle" : "check_circle"}</span>
        <span className="ml-auto shrink-0 text-[10px]">priority {a.priority + 1}</span>
      </div>

      {/* Quota rows — 9router QuotaProgressBar verbatim: label+emoji+%, h-2 bar, used/total + countdown */}
      {hasQuota && (
        <div className="mt-3 space-y-4 border-t border-9r-border-subtle pt-3">
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
                  <span>{unlimited ? <span className="text-green-500">{q.used.toLocaleString()} used · Unlimited</span> : `${q.used.toLocaleString()} / ${q.limit.toLocaleString()} requests`}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{countdown || <span className="italic">N/A</span>}</span>
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

      {/* Inline editors */}
      {editOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-9r-border-subtle pt-3">
          <input className={input} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Name" />
          <input className={input} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" />
          <input className={input} value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder="Image model" />
          <div className="flex items-center gap-2">
            <button className="inline-flex h-8 items-center gap-1 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600" onClick={() => { onEdit({ label: editLabel || a.label, email: editEmail || undefined, imageModel: editModel || undefined }); setEditOpen(false) }}>
              <Icon name="check" className="!text-[16px]" /> Save
            </button>
            <button className="inline-flex h-8 items-center rounded-lg border border-9r-border px-3 text-xs text-9r-text hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setEditOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {quotaOpen && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          <input className={input} placeholder="Label (e.g. Weekly)" value={qLabel} onChange={(e) => setQLabel(e.target.value)} />
          <input className={input} placeholder="Used" inputMode="numeric" value={qUsed} onChange={(e) => setQUsed(e.target.value)} />
          <input className={input} placeholder="Limit" inputMode="numeric" value={qLimit} onChange={(e) => setQLimit(e.target.value)} />
          <button className="inline-flex h-9 items-center gap-1 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600" onClick={addQuota}>
            <Icon name="add" className="!text-[16px]" /> Add row
          </button>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-9r-border-subtle pt-2.5">
        <button className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-9r-muted hover:bg-black/5 hover:text-9r-text dark:hover:bg-white/5" onClick={() => setQuotaOpen((v) => !v)}>
          <Icon name="add" className="!text-[14px]" /> Quota row
        </button>
        <button className="inline-flex h-7 items-center rounded-lg px-2 text-xs text-9r-muted hover:bg-black/5 hover:text-9r-text disabled:opacity-30 dark:hover:bg-white/5" onClick={onUnlock} disabled={!locked}>
          Unlock
        </button>
      </div>
    </div>
  )
}