import { useMemo, useState } from "react"
import {
  addAccount,
  importNineRouter,
  moveAccount,
  removeAccount,
  saveAccounts,
  syncNineRouterQuotas,
  clearAccountLock,
  toggleAccount,
  updateAccount,
  NINE_ROUTER_BASE,
  providerOf,
  type AccountEntry,
  type NineRouterRow,
} from "@/lib/accounts"
import { Badge, Icon, ProviderIcon, Toggle, providerColor, providerSlug, statusFilterOptions, matchesStatusFilter } from "@/lib/nineui"
import { ConnectionRow } from "./ConnectionRow"
import { cn } from "@/lib/utils"

// Model access page — 9router /dashboard/providers replica:
// - status-filter <select> top-right (All / Connected / Error / No connections)
// - section blocks: "text-lg sm:text-xl font-semibold" headers + right-aligned
//   bordered action buttons + grid grid-cols-1 sm:2 lg:3 xl:4 gap-3/4
// - card = ProviderCard: size-8 icon tile + name + status Badges + sm Toggle
// - API-key section truncates at APIKEY_INITIAL_VISIBLE with Show all/less

const APIKEY_INITIAL_VISIBLE = 5
const STATUS_FILTERS = ["all", "active", "inactive", "none"] as const

function ProviderIconInline({ slug, family, label }: { slug?: string; family: string; label: string }) {
  return (
    <ProviderIcon
      providerId={slug}
      alt={family}
      size={30}
      className="max-h-[30px] max-w-[32px] rounded-lg object-contain"
      fallbackText={family.slice(0, 2).toUpperCase() || label.slice(0, 2).toUpperCase()}
      fallbackColor={providerColor(family)}
    />
  )
}


const PAGE_SIZE = 5

// Per-section pager — shows 5 cards at a time, prev/next controls.
function SectionGrid<T>({ rows, render, cols }: { rows: T[]; render: (r: T, i: number) => React.ReactNode; cols: string }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(rows.length / PAGE_SIZE)
  const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  return (
    <>
      <div className={cols}>{slice.map((r, i) => render(r, page * PAGE_SIZE + i))}</div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs text-9r-muted">
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-9r-border bg-9r-surface-2 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          ><span className="material-symbols-outlined text-[16px]">chevron_left</span></button>
          <span className="min-w-10 text-center">{page + 1} / {pages}</span>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-9r-border bg-9r-surface-2 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/5"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          ><span className="material-symbols-outlined text-[16px]">chevron_right</span></button>
        </div>
      )}
    </>
  )
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState(loadInitial)
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all")
  const [showAllApikey, setShowAllApikey] = useState(false)
  const [openId, setOpenId] = useState("")
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState("")

  function loadInitial(): AccountEntry[] {
    try {
      const raw = localStorage.getItem("yt-kids-accounts-v2")
      return raw ? (JSON.parse(raw) as AccountEntry[]) : []
    } catch {
      return []
    }
  }

  function commit(next: AccountEntry[]) {
    setAccounts(next)
    saveAccounts(next)
  }

  // Group accounts by provider family (9router /dashboard/providers behaviour:
  // one card per PROVIDER, "N Connected" status, click → provider detail page).
  const familyStats = useMemo(() => {
    const map = new Map<string, { connected: number; error: number; total: number; disabled: number; rows: AccountEntry[] }>()
    for (const a of accounts) {
      const fam = providerOf(a)
      const g = map.get(fam) ?? { connected: 0, error: 0, total: 0, disabled: 0, rows: [] }
      g.total++
      g.rows.push(a)
      if (a.lastError) g.error++
      else if (a.enabled) g.connected++
      if (!a.enabled) g.disabled++
      map.set(fam, g)
    }
    return map
  }, [accounts])

  const openFamily = openId || ""
  const openRows = openFamily ? (familyStats.get(openFamily)?.rows ?? []) : []

  // Family-level search/filter (9router matchesStatusFilter on provider stats)
  const familyMatches = (fam: string, g: { connected: number; error: number; total: number; disabled: number } ) => {
    const q = filter.trim().toLowerCase()
    const hit = !q || fam.toLowerCase().includes(q)
    if (!hit) return false
    const status = g.disabled === g.total && g.total > 0 ? "inactive" : g.connected > 0 ? "active" : g.total > 0 ? "active" : "none"
    return matchesStatusFilter(status === "active", status === "inactive", statusFilter)
  }

  const searching = !!filter.trim() || statusFilter !== "all"
  const oauthFams = [...familyStats.entries()].filter(([f, g]) => g.rows.some((a) => a.authType === "oauth") && familyMatches(f, g))
  const keyFams = [...familyStats.entries()].filter(([f, g]) => g.rows.every((a) => a.authType !== "oauth") && familyMatches(f, g))
  const visibleKeyFams = searching || showAllApikey ? keyFams : keyFams.slice(0, APIKEY_INITIAL_VISIBLE)
  const hiddenKeyCount = keyFams.length - APIKEY_INITIAL_VISIBLE
  const totalFamilies = familyStats.size

  const statusSelect = (
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
      className="h-8 rounded-lg border border-black/10 bg-black/[0.02] px-2 text-xs text-text-primary outline-none transition-colors hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10"
      aria-label="Filter accounts by connection status"
    >
      {STATUS_FILTERS.map((v) => (
        <option key={v} value={v}>{statusFilterOptions()[v]}</option>
      ))}
    </select>
  )

  const search = (
    <div className="relative w-full sm:w-64">
      <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-9r-muted">search</span>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search accounts…"
        className="h-8 w-full rounded-lg border border-9r-border bg-9r-surface-2 pl-8 pr-2 text-xs text-9r-text placeholder:text-9r-muted"
      />
    </div>
  )

  // 9router ProviderCard — one card per PROVIDER FAMILY, status Badge,
  // per-family disable toggle, click → provider detail page.
  function providerCardFor(fam: string, g: { connected: number; error: number; total: number; disabled: number; rows: AccountEntry[] }) {
    const allDisabled = g.disabled === g.total && g.total > 0
    const iconColor = providerColor(fam)
    return (
      <button key={fam} onClick={() => setOpenId(fam)} className="group min-w-0 text-left">
        <div className={"h-full rounded-[14px] border border-9r-border bg-9r-surface p-1.5 shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.3))] transition-colors hover:bg-black/[0.01] dark:hover:bg-white/[0.01] " + (allDisabled ? "opacity-50" : "")}>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${iconColor}15` }}>
                <ProviderIconInline slug={providerSlug(fam)} family={fam} label={fam} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-9r-text">{fam}</h3>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                  {allDisabled ? (
                    <Badge variant="default" size="sm"><span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">pause_circle</span>Disabled</span></Badge>
                  ) : g.connected > 0 ? (
                    <Badge variant="success" size="sm" dot>{g.connected} Connected</Badge>
                  ) : (
                    <span className="text-9r-muted">No connections</span>
                  )}
                  {g.error > 0 && !allDisabled && <Badge variant="error" size="sm" dot>{g.error} Error</Badge>}
                </div>
              </div>
            </div>
            {g.total > 0 && (
              <div className="flex shrink-0 items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  title={allDisabled ? "Enable provider" : "Disable provider"}
                  onChange={() => {
                    const next = accounts.map((a) => providerOf(a) === fam ? { ...a, enabled: allDisabled ? true : false } : a)
                    commit(next)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </button>
    )
  }


  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 py-6 sm:px-6">
      {/* Top bar: status filter + actions — 9router providers-page toolbar */}
      <div className="flex items-center justify-between gap-2">
        {statusSelect}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setImporting(true)
              try {
                const res = await fetch("/api/9router-accounts")
                const j = (await res.json()) as { rows?: NineRouterRow[]; error?: string }
                if (j.error) throw new Error(j.error)
                const rows = j.rows ?? []
                const r = importNineRouter(rows)
                commit(r.list)
                setNotice(rows.length ? `Imported ${rows.length} connections from 9router` : "No 9router connections found")
              } catch (e) {
                setNotice(`Import failed: ${(e as Error).message}`)
              } finally {
                setImporting(false)
              }
            }}
            disabled={importing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-9r-border bg-9r-surface-2 px-3 text-xs font-medium text-9r-text hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            <span className={cn("material-symbols-outlined text-[14px]", importing && "animate-spin")}>sync</span>
            {importing ? "Importing…" : "Login / Import"}
          </button>
          <button
            onClick={async () => {
              setSyncing(true)
              try {
                const { updated } = await syncNineRouterQuotas()
                setAccounts(loadInitial())
                setNotice(updated ? `Synced quotas for ${updated} accounts` : "No quota rows returned")
              } catch (e) {
                setNotice(`Quota sync failed: ${(e as Error).message}`)
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-9r-border bg-9r-surface-2 px-3 text-xs font-medium text-9r-text hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            <span className={cn("material-symbols-outlined text-[14px]", syncing && "animate-spin")}>data_usage</span>
            {syncing ? "Syncing…" : "Sync quota"}
          </button>
          <button
            onClick={() => {
              const created = addAccount({ label: "New account", baseUrl: NINE_ROUTER_BASE, apiKey: "", enabled: true, priority: accounts.length })
              commit(created)
              setOpenId(providerOf(created[created.length - 1]))
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600"
          >
            <Icon name="add" className="!text-[16px]" /> Add account
          </button>
        </div>
      </div>
      {notice && <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">{notice}</div>}

      {/* Provider detail — 9router /dashboard/providers/[id] */}
      {openFamily && (
        <div className="flex min-w-0 flex-col gap-4">
          {/* Back bar — 9router "Back to Providers" arrow_back link */}
          <button className="inline-flex items-center gap-1 self-start text-sm text-9r-muted transition-colors hover:text-9r-brand" onClick={() => setOpenId("")}> 
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Providers
          </button>
          {/* Provider header — size-12 tile + text-3xl name + N connections */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${providerColor(openFamily)}15` }}>
              <ProviderIcon providerId={providerSlug(openFamily)} alt={openFamily} size={48} className="max-h-12 max-w-12 rounded-lg object-contain" fallbackText={openFamily.slice(0, 2).toUpperCase()} fallbackColor={providerColor(openFamily)} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-9r-text sm:text-3xl">{openFamily}</h1>
              <p className="text-9r-muted">{openRows.length} connection{openRows.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          {/* Connections card */}
          <div className="rounded-[14px] border border-9r-border bg-9r-surface p-4 shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.3))]">
            <h2 className="mb-4 text-lg font-semibold text-9r-text">Connections</h2>
            {openRows.length === 0 ? (
              <div className="flex items-center gap-3">
                <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-9r-brand/10 text-9r-brand">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <p className="text-sm text-9r-muted">No connections yet</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {openRows.map((a, i) => (
                  <ConnectionRow
                    key={a.id}
                    account={a}
                    isFirst={i === 0}
                    isLast={i === openRows.length - 1}
                    onToggle={() => commit(toggleAccount(a.id))}
                    onRemove={() => { commit(removeAccount(a.id)) }}
                    onMove={(d) => commit(moveAccount(a.id, d))}
                    onEdit={(patch) => commit(updateAccount(a.id, patch))}
                    onUnlock={() => commit(clearAccountLock(a.id))}
                    onQuota={(q) => commit(updateAccount(a.id, { quota: q }))}
                  />
                ))}
              </div>
            )}
            <div className="mt-4">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-9r-brand px-3 text-xs font-medium text-white hover:bg-9r-brand-600"
                onClick={() => {
                  const created = addAccount({ label: `${openFamily} account`, provider: openFamily, baseUrl: NINE_ROUTER_BASE, apiKey: "9router-gateway", enabled: true, priority: accounts.length })
                  commit(created)
                }}
              >
                <Icon name="add" className="!text-[16px]" /> Add Connection
              </button>
            </div>
          </div>
          {/* Available Models card — quota rows across all connections of this provider */}
          <div className="rounded-[14px] border border-9r-border bg-9r-surface p-4 shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.3))]">
            <h2 className="text-lg font-semibold text-9r-text">Available Models</h2>
            <p className="mt-1 text-xs text-9r-muted">Quota windows synced from 9router. Click a connection to edit its keys/rows.</p>
          </div>
        </div>
      )}
      {/* Sections — provider-family grid (9router structure), hidden while a provider detail is open */}
      {!openFamily && (
      <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold leading-tight text-9r-text sm:text-xl">OAuth Providers</h2>
          {search}
        </div>
        {oauthFams.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-9r-border py-2 text-sm text-9r-muted">
            <span className="material-symbols-outlined text-[18px]">extension</span>
            <span>No OAuth connections — click Login / Import to pull 9router sessions</span>
          </div>
        ) : (
          <SectionGrid rows={oauthFams} cols="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5" render={([fam, g]) => providerCardFor(fam, g)} />
        )}
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold leading-tight text-9r-text sm:text-xl">API Key Providers</h2>
        </div>
        {visibleKeyFams.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-9r-border py-2 text-sm text-9r-muted">
            <span className="material-symbols-outlined text-[18px]">extension</span>
            <span>No key-based accounts — click Add account to create one</span>
          </div>
        ) : (
          <SectionGrid rows={visibleKeyFams} cols="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5" render={([fam, g]) => providerCardFor(fam, g)} />
        )}
      </section>
      </>
      )}

      {/* API-key Show all/less */}
      {!openFamily && !searching && hiddenKeyCount > 0 && (
        <button
          onClick={() => setShowAllApikey((v) => !v)}
          className="mx-auto inline-flex h-8 items-center rounded-lg border border-9r-border bg-9r-surface-2 px-3 text-xs font-medium text-9r-text hover:bg-black/5 dark:hover:bg-white/5"
        >
          {showAllApikey ? "Show less" : `Show all (${hiddenKeyCount} more)`}
        </button>
      )}

      {/* Empty state — 9router search_off panel */}
      {!openFamily && totalFamilies > 0 && oauthFams.length + keyFams.length === 0 && (
        <div className="rounded-xl border border-dashed border-9r-border py-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-9r-muted">search_off</span>
          <p className="mt-2 text-sm text-9r-muted">No accounts match your search or filters</p>
        </div>
      )}
      {accounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-9r-border py-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-9r-muted">add_circle</span>
          <p className="mt-2 text-sm text-9r-muted">
            No accounts yet — <span className="font-medium text-9r-text">Login / Import</span> pulls your 9router connections; <span className="font-medium text-9r-text">Add account</span> adds a manual key.
          </p>
        </div>
      )}
    </div>
  )
}