// Production mode: Full Automation (AI pipeline + local ffmpeg render +
// auto-handoff to YouTube Publish) vs Manual Video Scripting (AI pipeline
// only — user renders/assembles themselves).
export type ProductionMode = "auto" | "manual"

const MODE_KEY = "yt-kids-mode"

export function loadMode(): ProductionMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    return raw === "manual" ? "manual" : "auto"
  } catch {
    return "auto"
  }
}

export function saveMode(m: ProductionMode) {
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    // ignore
  }
}