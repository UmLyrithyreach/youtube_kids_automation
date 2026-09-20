// In-memory handoff from the full-automation render to the YouTube tab.
// The finished MP4 lives only until the YouTube tab picks it up (or the page
// reloads) — session data itself is persisted separately.
export type AutoHandoff = { sessionId: string; fileName: string; blob: Blob }

let pending: AutoHandoff | null = null
const listeners = new Set<() => void>()

export function setAutoHandoff(h: AutoHandoff) {
  pending = h
  listeners.forEach((l) => l())
}

export function takeAutoHandoff(): AutoHandoff | null {
  return pending
}

export function clearAutoHandoff() {
  pending = null
}

export function subscribeAutoHandoff(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}