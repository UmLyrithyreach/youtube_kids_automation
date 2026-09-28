// 9router-style account pool: bring as many accounts (API keys) as you have,
// generation rotates to whichever account still has image capacity.
// Mirrors 9router's providerConnections + modelLock_*: per-account quota lock
// with reset time, priority, enable toggle, round-robin (least-recently-used).

import type { AgentConfig } from "./agents"

export interface AccountEntry {
  id: string
  label: string
  email?: string // whose account this is — shown on every card (9router quota tracker style)
  provider?: string // provider family for grouping (e.g. "Antigravity", "OpenAI") — derived from host when empty
  authType?: "oauth" | "apikey" // oauth = logged in via provider auth (imported from 9router sessions)
  plan?: string // provider plan tier shown as badge (9router: free/pro/ultra/enterprise)
  importedAt?: number // epoch ms — set when imported from 9router (used for dedupe)
  baseUrl: string
  apiKey: string
  imagePath?: string // /v1/images/generations, or Google …/v1beta/openai
  imageModel?: string // preferred image model on this account
  chatModel?: string // optional chat model on this account (pool-routed text later)
  enabled: boolean
  priority: number // lower = tried first
  // learned quota state
  lockedUntil?: number // epoch ms — image quota lock (9router modelLock_*)
  lastError?: string
  lastUsedAt?: number
  totalImages?: number
  // declared quota rows (9router quota tracker): user enters them from provider dashboard
  quota?: AccountQuota[]
}

export interface AccountQuota {
  label: string // e.g. "Gemini (Weekly)" / "5h window"
  used: number
  limit: number
  resetAt?: number // epoch ms
}

// Provider family from the endpoint host — groups cards the way 9router does.
export function providerOf(a: Pick<AccountEntry, "provider" | "baseUrl">): string {
  if (a.provider) return a.provider
  try {
    const host = new URL(a.baseUrl.startsWith("http") ? a.baseUrl : `http://${a.baseUrl}`).host
    if (host.includes("127.0.0.1") || host.includes("localhost")) return "9router (local)"
    if (host.includes("generativelanguage") || host.includes("ai.google")) return "Google AI Studio"
    if (host.includes("openai.com")) return "OpenAI"
    if (host.includes("openrouter")) return "OpenRouter"
    if (host.includes("anthropic")) return "Anthropic"
    return host
  } catch {
    return "Unknown"
  }
}

export function quotaPct(q: AccountQuota): number {
  if (!q.limit) return 0
  return Math.max(0, Math.min(100, Math.round(((q.limit - q.used) / q.limit) * 100)))
}

// Countdown to a quota reset — 9router format: "45m" / "3h 12m" / "2d 5h"
export function resetCountdown(resetAt?: number): string {
  if (!resetAt) return ""
  const ms = resetAt - Date.now()
  if (ms <= 0) return "now"
  const m = Math.ceil(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  return d > 0 ? `in ${d}d ${h % 24}h` : h > 0 ? `in ${h}h ${m % 60}m` : `in ${m}m`
}

const KEY = "yt-kids-accounts-v2"
export const ACCOUNTS_CHANGED = "yk-accounts-changed"

// v1 → v2 migrate: preserves keys added before email/provider/quota existed.
export function loadAccounts(): AccountEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AccountEntry[]
    const v1 = localStorage.getItem("yt-kids-accounts-v1")
    if (v1) {
      const list = JSON.parse(v1) as AccountEntry[]
      localStorage.setItem(KEY, JSON.stringify(list))
      localStorage.removeItem("yt-kids-accounts-v1")
      return list
    }
  } catch {
    // corrupted store — start clean
  }
  return []
}

export function saveAccounts(list: AccountEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED))
}

export function addAccount(a: Omit<AccountEntry, "id">): AccountEntry[] {
  const list = loadAccounts()
  list.push({ ...a, id: crypto.randomUUID() })
  saveAccounts(list)
  return list
}

export function removeAccount(id: string): AccountEntry[] {
  const list = loadAccounts().filter((a) => a.id !== id)
  saveAccounts(list)
  return list
}

export function toggleAccount(id: string): AccountEntry[] {
  const list = loadAccounts().map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
  saveAccounts(list)
  return list
}

export function clearAccountLock(id: string): AccountEntry[] {
  const list = loadAccounts().map((a) =>
    a.id === id ? { ...a, lockedUntil: undefined, lastError: undefined } : a
  )
  saveAccounts(list)
  return list
}

// Reorder priority: dir=-1 moves account up (tried sooner), +1 down.
export function moveAccount(id: string, dir: -1 | 1): AccountEntry[] {
  const sorted = [...loadAccounts()].sort((a, b) => a.priority - b.priority)
  const i = sorted.findIndex((a) => a.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return sorted
  const a = sorted[i]
  sorted[i] = sorted[j]
  sorted[j] = a
  const list = sorted.map((acc, idx) => (acc.priority === idx ? acc : { ...acc, priority: idx }))
  saveAccounts(list)
  return list
}

// Pick the next usable account: enabled, image quota not locked, priority
// ascending, then least-recently-used (9router round-robin + backoff).
export function pickAccount(now = Date.now()): AccountEntry | null {
  const usable = loadAccounts()
    .filter((a) => a.enabled && (!a.lockedUntil || a.lockedUntil <= now))
    .sort((x, y) => {
      if (x.priority !== y.priority) return x.priority - y.priority
      return (x.lastUsedAt ?? 0) - (y.lastUsedAt ?? 0)
    })
  return usable[0] ?? null
}

// Earliest future lock expiry across enabled accounts, or null when none locked.
export function nextUnlockMs(now = Date.now()): number | null {
  const locks = loadAccounts()
    .filter((a) => a.enabled && a.lockedUntil && a.lockedUntil > now)
    .map((a) => a.lockedUntil!)
  return locks.length ? Math.min(...locks) : null
}

export function markAccountUsed(id: string) {
  const list = loadAccounts().map((a) =>
    a.id === id
      ? { ...a, lastUsedAt: Date.now(), lockedUntil: undefined, lastError: undefined, totalImages: (a.totalImages ?? 0) + 1 }
      : a
  )
  saveAccounts(list)
}

export function markAccountQuotaLocked(id: string, resetMs: number, error: string) {
  const list = loadAccounts().map((a) =>
    a.id === id ? { ...a, lockedUntil: Date.now() + Math.max(resetMs, 5_000), lastError: error } : a
  )
  saveAccounts(list)
}

export function markAccountError(id: string, error: string) {
  const list = loadAccounts().map((a) => (a.id === id ? { ...a, lastError: error } : a))
  saveAccounts(list)
}

// Edit any account fields (email, provider, quota rows, models…).
export function updateAccount(id: string, patch: Partial<AccountEntry>): AccountEntry[] {
  const list = loadAccounts().map((a) => (a.id === id ? { ...a, ...patch } : a))
  saveAccounts(list)
  return list
}

// ---------------------------------------------------------------------------
// Login-through-authentication: import accounts the user already OAuth-logged
// into elsewhere (9router holds real antigravity/codex/copilot OAuth sessions).
// No tokens enter the app — imported entries call the local gateway, which
// holds the credentials. 9router's modelLock_* state imports as lockedUntil.
// ---------------------------------------------------------------------------
export const NINE_ROUTER_BASE = "http://127.0.0.1:20128"
export const GATEWAY_KEY = "9router-gateway" // gateway accepts any bearer for /v1/*

const PROVIDER_LABELS: Record<string, string> = {
  antigravity: "Antigravity",
  codex: "OpenAI Codex",
  gemini: "Gemini",
  github: "GitHub Copilot",
  openrouter: "OpenRouter",
  ollama: "Ollama Cloud",
  nvidia: "NVIDIA NIM",
  claude: "Claude",
  openai: "OpenAI",
  venice: "Venice",
}
export function providerLabel(p: string): string {
  if (PROVIDER_LABELS[p]) return PROVIDER_LABELS[p]
  return p.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface NineRouterRow {
  provider: string
  email?: string
  authType?: string
  isActive?: number | boolean
  lockUntil?: string | null // ISO from 9router modelLock_* (future = still locked)
}

export interface ImportResult {
  list: AccountEntry[]
  added: number
  updated: number
}

export function importNineRouter(rows: NineRouterRow[]): ImportResult {
  const list = loadAccounts()
  let priority = list.reduce((max, a) => Math.max(max, a.priority), -1) + 1
  let added = 0
  let updated = 0
  const now = Date.now()
  for (const r of rows) {
    if (!r.provider) continue
    const email = r.email || ""
    const label = `${providerLabel(r.provider)}${email ? ` · ${email}` : ""}`
    const existing = list.find((a) => a.label === label && a.baseUrl === NINE_ROUTER_BASE)
    const lockMs = r.lockUntil ? Date.parse(r.lockUntil) : NaN
    const lockedUntil = Number.isFinite(lockMs) && lockMs > now ? lockMs : undefined
    if (existing) {
      updated++
      updateAccount(existing.id, {
        email: email || existing.email,
        authType: r.authType === "oauth" ? "oauth" : existing.authType,
        enabled: (r.isActive ?? 1) ? true : existing.enabled,
        lockedUntil,
      })
      continue
    }
    added++
    list.push({
      id: crypto.randomUUID(),
      label,
      email: email || undefined,
      provider: providerLabel(r.provider),
      authType: r.authType === "oauth" ? "oauth" : "apikey",
      importedAt: now,
      baseUrl: NINE_ROUTER_BASE,
      apiKey: GATEWAY_KEY,
      imagePath: "/v1/images/generations",
      enabled: !!r.isActive,
      priority: priority++,
      lockedUntil,
    })
  }
  saveAccounts(list)
  return { list, added, updated }
}
export function setAccountQuota(id: string, quota: AccountQuota[]): AccountEntry[] {
  return updateAccount(id, { quota })
}

// ---------------------------------------------------------------------------
// Live quota tracker (9router parity): pull the gateway's own per-model quota
// rows for every imported 9router account and write them onto the entries as
// AccountQuota rows. Same shape as 9router's quota page: used / total /
// resetAt / remainingPercentage / unlimited.
// ---------------------------------------------------------------------------
export interface NineRouterQuotaRow {
  id: string
  provider?: string
  email?: string
  name?: string
  plan?: string
  quotas: Record<string, { used?: number; total?: number; resetAt?: string; remainingPercentage?: number; unlimited?: boolean; displayName?: string }>
}

export async function syncNineRouterQuotas(): Promise<{ list: AccountEntry[]; updated: number; error?: string }> {
  const res = await fetch("/api/9router-quota")
  const j = (await res.json()) as { rows?: NineRouterQuotaRow[]; error?: string }
  if (j.error) throw new Error(j.error)
  const rows = j.rows ?? []
  const list = loadAccounts()
  let updated = 0
  for (const r of rows) {
    // Match imported accounts: they were created with baseUrl = NINE_ROUTER_BASE
    // and label "Provider · email" (or email match when labels were edited).
    const targets = list.filter(
      (a) => a.baseUrl === NINE_ROUTER_BASE && (!r.email || !a.email || a.email === r.email)
    )
    const target = r.email ? targets.find((a) => a.email === r.email) ?? targets[0] : targets[0]
    if (!target) continue
    const quota: AccountQuota[] = Object.entries(r.quotas).map(([key, q]) => ({
      label: q.displayName || key,
      used: q.used ?? 0,
      limit: q.total ?? (q.unlimited ? 0 : 100),
      resetAt: q.resetAt ? Date.parse(q.resetAt) : undefined,
    }))
    updateAccount(target.id, { quota, plan: r.plan ?? target.plan })
    updated++
  }
  return { list: loadAccounts(), updated }
}

let lastUsedLabel = ""
export function getLastUsedLabel(): string {
  return lastUsedLabel
}

export function setLastUsedLabel(label: string) {
  lastUsedLabel = label
}

// Adapt an account to the AgentConfig shape byok.ts already consumes.
export function accountToConfig(a: AccountEntry, base?: AgentConfig | null): AgentConfig {
  return {
    baseUrl: a.baseUrl,
    apiKey: a.apiKey,
    model: a.imageModel || base?.model || "",
    models: a.imageModel ? [a.imageModel] : (base?.models ?? []),
    imagePath: a.imagePath || base?.imagePath,
    skill: base?.skill,
  }
}

// One-click bootstrap: import every distinct agent endpoint/key as an account.
export function importFromConfigs(configs: Record<string, AgentConfig | null>): AccountEntry[] {
  const list = loadAccounts()
  let priority = list.reduce((max, a) => Math.max(max, a.priority), 0)
  for (const c of Object.values(configs)) {
    if (!c?.apiKey || !c.baseUrl) continue
    if (list.some((a) => a.apiKey === c.apiKey && a.baseUrl === c.baseUrl)) continue
    priority += 1
    list.push({
      id: crypto.randomUUID(),
      label: `Imported (${new URL(c.baseUrl.startsWith("http") ? c.baseUrl : `http://${c.baseUrl}`).host})`,
      baseUrl: c.baseUrl,
      apiKey: c.apiKey,
      imagePath: c.imagePath,
      imageModel: c.model,
      enabled: true,
      priority,
    })
  }
  saveAccounts(list)
  return list
}