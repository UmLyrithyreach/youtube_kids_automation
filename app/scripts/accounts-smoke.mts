// Smoke test: 9router-style account pool rotation (run with: npx tsx scripts/accounts-smoke.mts)
const listeners: Array<() => void> = []
;(globalThis as any).window = {
  dispatchEvent: () => { listeners.forEach((f) => f()) },
  addEventListener: (_t: string, f: () => void) => { listeners.push(f) },
  removeEventListener: () => {},
}
const store: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}

const { addAccount, loadAccounts, pickAccount, markAccountUsed, markAccountQuotaLocked, nextUnlockMs, clearAccountLock } =
  await import("../src/lib/accounts")

const assert = (cond: boolean, msg: string) => { if (!cond) { console.error("FAIL:", msg); process.exit(1) } }

// equal priority → pure LRU round-robin (9router strategy)
addAccount({ label: "acc-a", baseUrl: "https://a.example", apiKey: "key-a", imageModel: "gemini-2.5-flash-image", enabled: true, priority: 0 })
addAccount({ label: "acc-b", baseUrl: "https://b.example", apiKey: "key-b", imageModel: "gpt-image-1", enabled: true, priority: 0 })
addAccount({ label: "acc-c", baseUrl: "https://c.example", apiKey: "key-c", enabled: true, priority: 0 })

let p = pickAccount()!; console.log("pick1", p.label); markAccountUsed(p.id)
p = pickAccount()!; console.log("pick2", p.label); markAccountUsed(p.id)
p = pickAccount()!; console.log("pick3", p.label); markAccountUsed(p.id)
p = pickAccount()!; console.log("pick4 (LRU wrap)", p.label)
assert(p.label === "acc-a", "LRU wraps to first")

markAccountQuotaLocked(p.id, 60000, "429 quota exceeded")
p = pickAccount()!; console.log("pick5 (skip locked a)", p.label)
assert(p.label === "acc-b", "locked account skipped")

// drain: lock everything
loadAccounts().forEach((a) => markAccountQuotaLocked(a.id, 60000, "limit: 0"))
assert(pickAccount() === null, "pool drains when all locked")
assert(nextUnlockMs() !== null, "nextUnlockMs reports earliest unlock")

// recover
clearAccountLock(loadAccounts()[0].id)
assert(pickAccount() !== null, "pool recovers after unlock")

// priority: higher priority (lower number) wins even if recently used
clearAccountLock(loadAccounts()[1].id)
clearAccountLock(loadAccounts()[2].id)
const pool = loadAccounts()
pool[1].priority = -1
localStorage.setItem("yt-kids-accounts-v2", JSON.stringify(pool))
assert(pickAccount()!.label === "acc-b", "priority beats LRU")

console.log("OK: rotation, locking, drain, recover, priority all pass")
process.exit(0)