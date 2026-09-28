import { useCallback, useEffect, useMemo, useState } from "react"
import {
  loadAccounts, syncNineRouterQuotas, quotaPct, resetCountdown,
  ACCOUNTS_CHANGED, providerOf, type AccountEntry, type AccountQuota,
} from "@/lib/accounts"
import { Badge, Icon, ProviderIcon, providerColor, providerSlug, planVariant, quotaStatus } from "@/lib/nineui"
import { cn } from "@/lib/utils"

// Quota tracker — its own tab (9router dashboard parity): live per-model quota
// across every provider/account. Providers tab stays account management; this
// page only watches usage bars and reset countdowns. Auto-syncs on open.
// Visual language copied verbatim from 9router ProviderLimits (QuotaProgressBar
// + QuotaTable + Card tokens): #1a1a1a/#262626 surfaces, #2a2a2a borders,
// rounded-[14px] cards, emoji status dots, h-2 rounded-full bars, plan badges.

function QuotaRow({ q }: { q: AccountQuota }) {
  const unlimited = !q.limit
  const pct = unlimited ? 100 : quotaPct(q)
  const c = quotaStatus(pct)
  const countdown = resetCountdown(q.resetAt)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-9r-text">{q.label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">{c.emoji}</span>
          <span className={cn("font-medium", c.text)}>{pct}%</span>
        </div>
      </div>
      {!unlimited && (
        <div className={cn("h-2 overflow-hidden rounded-full", c.track)}>
          <div className={cn("h-full transition-all duration-300", c.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-9r-muted">
        <span>{unlimited ? <span className="text-green-500">{q.used.toLocaleString()} used · Unlimited</span> : `${q.used.toLocaleString()} / ${q.limit.toLocaleString()} requests`}</span>
        <span className="font-medium">{countdown ? `Reset ${countdown}` : <span className="italic">N/A</span>}</span>
      </div>
    </div>
  )
}

function ProviderCard({ a, syncing, onSync }: { a: AccountEntry; syncing: boolean; onSync: () => void }) {
  const color = providerColor(providerOf(a))
  return (
    // 9router Card (padding none) with header row + quota body — dark tokens.
    <div className="min-w-0 rounded-[14px] border border-9r-border bg-9r-surface shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.3))]">
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg p-1.5" style={{ backgroundColor: `${color}15` }}>
              <ProviderIcon
                providerId={providerSlug(providerOf(a))}
                alt={providerOf(a)}
                size={40}
                className="max-h-[40px] max-w-[40px] rounded-lg object-contain"
                fallbackText={(a.label || providerOf(a)).slice(0, 2).toUpperCase()}
                fallbackColor={color}
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-9r-text">{a.label || providerOf(a)}</h3>
              <p className="truncate text-xs text-9r-muted">{a.email || providerOf(a)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {a.plan && <Badge variant={planVariant(a.plan)} size="sm">{a.plan}</Badge>}
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex size-8 items-center justify-center rounded-lg text-9r-muted transition-colors hover:bg-white/[0.05] hover:text-9r-brand disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh quota"
            >
              <Icon name="refresh" className={cn("text-[20px] text-9r-muted", syncing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>
      {/* Quota progress bars — 9router QuotaProgressBar spacing */}
      <div className="space-y-4 border-t border-9r-border-subtle px-4 py-4">
        {a.quota!.map((q, qi) => <QuotaRow key={`${q.label}-${qi}`} q={q} />)}
      </div>
    </div>
  )
}

export function QuotaPage() {
  const [accounts, setAccounts] = useState<AccountEntry[]>([])
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState("")

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const r = await syncNineRouterQuotas()
      setMsg(r.updated ? `Live quota refreshed for ${r.updated} account${r.updated > 1 ? "s" : ""}` : "No live quota rows from 9router")
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    const refresh = () => setAccounts(loadAccounts())
    refresh()
    window.addEventListener(ACCOUNTS_CHANGED, refresh)
    void sync()
    return () => window.removeEventListener(ACCOUNTS_CHANGED, refresh)
  }, [sync])

  const withQuota = useMemo(() => accounts.filter((a) => (a.quota?.length ?? 0) > 0), [accounts])
  const providers = useMemo(() => [...new Set(withQuota.map(providerOf))], [withQuota])
  const windows = useMemo(() => withQuota.reduce((n, a) => n + (a.quota?.length ?? 0), 0), [withQuota])
  const drained = useMemo(
    () => withQuota.filter((a) => a.quota!.every((q) => quotaPct(q) === 0)).length,
    [withQuota]
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 text-sm">
      {/* Header — 9router quota tracker toolbar: title + status chips + h-8 controls */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-9r-text sm:text-xl">Quota Tracker</h2>
          <p className="mt-1 text-xs text-9r-muted">
            Live per-model usage across every provider. Accounts and keys live in Providers.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
            <Badge size="sm">{windows} quota windows</Badge>
            <Badge size="sm">{providers.length} providers</Badge>
            {drained > 0 && (
              <Badge variant="error" size="sm" dot>{drained} drained</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {msg && <span className="max-w-52 truncate text-xs text-9r-muted" title={msg}>{msg}</span>}
          {/* 9router toolbar mini-control: h-8, border-white/10, bg-white/[0.03] */}
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-9r-border bg-9r-surface-2 px-2 text-xs font-medium text-9r-text transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            title="Pull live per-model quota from 9router"
          >
            <Icon name="refresh" className={cn("text-[14px]", syncing && "animate-spin")} /> Sync
          </button>
        </div>
      </div>

      {/* Provider-grouped live quota cards — 9router 2-col grid */}
      {providers.map((prov) => {
        const group = withQuota.filter((a) => providerOf(a) === prov)
        if (!group.length) return null
        return (
          <section key={prov} className="mb-7">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-9r-text">{prov}</h3>
              <span className="text-[11px] text-[#6b7280]">{group.length} account{group.length > 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {group.map((a) => (
                <ProviderCard key={a.id} a={a} syncing={syncing} onSync={sync} />
              ))}
            </div>
          </section>
        )
      })}

      {accounts.length === 0 && (
        // 9router empty state verbatim (icon cloud_off, lg padding)
        <div className="rounded-[14px] border border-[#2a2a2a] bg-[#262626] py-12 text-center">
          <span className="material-symbols-outlined mx-auto block text-[48px] text-9r-muted opacity-20">cloud_off</span>
          <h3 className="mt-4 text-lg font-semibold text-9r-text">No Providers Connected</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-9r-muted">
            Connect to providers with OAuth to track your API quota limits and usage.
          </p>
        </div>
      )}
      {accounts.length > 0 && windows === 0 && (
        // 9router secondary empty state (dashed border box)
        <div className="rounded-xl border border-dashed border-[#2a2a2a] py-8 text-center">
          <span className="material-symbols-outlined mx-auto mb-2 block text-[32px] text-9r-muted">data_usage</span>
          <p className="text-sm text-9r-muted">No quota data available. Sync pulls live rows from 9router; manual rows can be added per account in Providers.</p>
        </div>
      )}
    </div>
  )
}