// Agent definitions + BYOK config storage (localStorage, keys stay in browser)

export type Capability = "text-to-text" | "text-to-video" | "text-to-speech" | "monitor"

export interface AgentConfig {
  baseUrl: string
  apiKey: string
  model: string
  models: string[] // fetched from endpoint
}

export type AgentId = "script" | "video" | "tts" | "monitor"

export interface AgentDef {
  id: AgentId
  name: string
  description: string
  capability: Capability
  acceptsImages?: boolean
}

export const AGENTS: AgentDef[] = [
  { id: "script", name: "Script Writer", description: "Turns the movie idea into a shooting script", capability: "text-to-text" },
  { id: "video", name: "Video Generator", description: "Generates video clips from script (keyframe image fallback)", capability: "text-to-video", acceptsImages: true },
  { id: "tts", name: "Voice (TTS)", description: "Narrates the script", capability: "text-to-speech" },
  { id: "monitor", name: "Monitor", description: "Self-checks the other agents for config/capability mismatches", capability: "monitor" },
]

const STORE_KEY = "yt-kids-agents-v1"

export function loadConfigs(): Record<AgentId, AgentConfig | null> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // corrupted store — start fresh
  }
  return { script: null, video: null, tts: null, monitor: null }
}

export function saveConfigs(configs: Record<AgentId, AgentConfig | null>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(configs))
}

// Capability keyword filter applied to a model id list.
export function filterModelsByCapability(models: string[], capability: Capability): string[] {
  const all = models.map((m) => (typeof m === "string" ? m : String(m ?? ""))).filter(Boolean)
  const kw: Record<Capability, string[]> = {
    "text-to-text": ["gpt", "claude", "glm", "gemini", "text", "chat", "llama", "mistral", "deepseek", "qwen", "grok", "opus", "sonnet", "haiku"],
    "text-to-video": ["video", "sora", "veo", "kling", "runway", "pika", "luma", "wan", "cosmos", "animate", "moviegen", "seedance", "hunyuan-video", "movi"],
    "text-to-speech": ["tts", "speech", "voice", "audio", "eleven", "piper", "kokoro", "espeak", "festival", "vits", "bark"],
    monitor: all, // monitor accepts anything (it probes)
  }
  const hits = all.filter((m) => kw[capability].some((k) => m.toLowerCase().includes(k)))
  // If endpoint naming doesn't match any keyword, return everything — user picks manually.
  return hits.length > 0 ? hits : all
}