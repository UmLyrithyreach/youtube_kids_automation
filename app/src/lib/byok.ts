// BYOK API layer — talks only to user-configured endpoints. Keys never logged.
import type { AgentConfig, Capability } from "./agents"

const CLEAN = (c: AgentConfig) => c.baseUrl.replace(/\/+$/, "")

function headers(c: AgentConfig): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` }
}

// fetch with auto-retry on 429/5xx — respects Retry-After, backs off exponentially.
// Network-level failures ("Failed to fetch") are NOT retried — they are explained instead:
// wrong URL, offline, or CORS (endpoint refuses browser requests).
async function fetchRetry(input: string, init: RequestInit, tries = 3, timeoutMs = 60_000): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < tries; attempt++) {
    let res: Response
    try {
      res = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (e) {
      if ((e as Error).name === "TimeoutError") throw new Error("endpoint timed out — it accepted the request but never answered")
      throw new Error(
        `Failed to reach endpoint (${(e as Error).message}). Check: 1) base URL is correct and reachable, 2) your internet, ` +
          `3) CORS — the endpoint must send Access-Control-Allow-Origin for browser apps; if it doesn't, use a CORS proxy or server-side endpoint`
      )
    }
    if (res.status !== 429 && res.status < 500) return res
    last = res
    if (attempt < tries - 1) {
      const retryAfter = Number(res.headers.get("retry-after"))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1500 * 2 ** attempt + Math.random() * 500
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  return last!
}

// Parse a chat-completions response that may be plain JSON or an SSE stream
// (many endpoints force `stream: true` regardless of what we ask for).
export async function parseChatResponse(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("text/event-stream")) {
    const raw = await res.text()
    let out = ""
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        const j = JSON.parse(payload)
        const delta = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content
        if (typeof delta === "string") out += delta
      } catch {
        // ignore malformed chunks
      }
    }
    return out
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== "string") throw new Error("unexpected chat response shape")
  return text
}

export async function fetchModels(c: AgentConfig): Promise<string[]> {
  const res = await fetchRetry(`${CLEAN(c)}/v1/models`, { headers: headers(c) })
  if (!res.ok) throw new Error(`GET /v1/models failed: ${res.status}`)
  const data = await res.json()
  const list = Array.isArray(data) ? data : (data.data ?? data.models ?? [])
  return list
    .map((m: unknown) => (typeof m === "string" ? m : ((m as { id?: string; name?: string })?.id ?? (m as { name?: string })?.name ?? "")))
    .filter(Boolean)
}

// Live probe: checks config is complete AND endpoint answers. Returns mismatch reason or null.
export async function probeAgent(capability: Capability, c: AgentConfig | null): Promise<string | null> {
  if (!c) return "not configured"
  if (!c.baseUrl) return "missing base URL"
  if (!c.apiKey) return "missing API key"
  if (!c.model) return "no model selected"
  try {
    const models = await fetchModels(c)
    if (models.length === 0) return "endpoint returned no models"
    if (capability !== "monitor" && !models.some((m) => m === c.model) && !models.some((m) => c.model.includes(m) || m.includes(c.model))) {
      return `model "${c.model}" not offered by endpoint`
    }
    return null
  } catch (e) {
    return `endpoint unreachable: ${(e as Error).message}`
  }
}

// text-to-text — OpenAI-compatible chat completions
export async function runScript(c: AgentConfig, prompt: string): Promise<string> {
  const res = await fetchRetry(`${CLEAN(c)}/v1/chat/completions`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: prompt }], stream: false }),
  })
  if (!res.ok) throw new Error(res.status === 429 ? "script agent rate-limited (429) — retries exhausted, wait a bit and try again" : `script agent failed: ${res.status}`)
  return parseChatResponse(res)
}

// text-to-video — returns playable video URL. Capability-mismatch checked by Monitor.
export async function runVideo(c: AgentConfig, prompt: string): Promise<string> {
  const res = await fetchRetry(`${CLEAN(c)}/v1/video/generations`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ model: c.model, prompt }),
  })
  if (!res.ok) throw new Error(`video agent failed: ${res.status}`)
  const data = await res.json()
  const url = data?.data?.[0]?.url ?? data?.url ?? data?.video?.url
  if (typeof url !== "string") throw new Error("no video URL in response (capability mismatch?)")
  return url
}

// text-to-speech — returns audio blob URL
export async function runTts(c: AgentConfig, text: string): Promise<string> {
  const res = await fetchRetry(`${CLEAN(c)}/v1/audio/speech`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ model: c.model, input: text }),
  })
  if (!res.ok) throw new Error(`TTS agent failed: ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith("audio")) throw new Error("response is not audio (capability mismatch?)")
  return URL.createObjectURL(blob)
}

// ---------------------------------------------------------------------------
// Vision agent: explains attachments for the other agents
// ---------------------------------------------------------------------------

// Client-side text extraction for texty files — no server round trip needed.
export async function extractFileText(file: File): Promise<string> {
  const texty = /^(text\/|application\/(json|xml|javascript|x-yaml|toml|x-sh))/.test(file.type) ||
    /\.(md|txt|json|csv|tsv|xml|yml|yaml|toml|html|css|js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|sh|sql|env|ini|log)$/i.test(file.name)
  if (!texty) return ""
  const text = await file.text()
  return text.slice(0, 12000) // cap context
}

// fileToBase64 for vision payload
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error(`could not read ${file.name}`))
    r.readAsDataURL(file)
  })
}

// Vision: describe images (OpenAI-compatible multimodal) + summarize attached text files.
export async function runVision(
  c: AgentConfig,
  files: File[],
  userPrompt: string
): Promise<string> {
  const images = files.filter((f) => f.type.startsWith("image/"))
  const textParts: string[] = []

  for (const f of files) {
    const t = await extractFileText(f)
    if (t) textParts.push(`--- file: ${f.name} ---\n${t}`)
  }
  if (images.length === 0 && textParts.length === 0) return ""

  const content: unknown[] = []
  if (images.length > 0) {
    content.push({
      type: "text",
      text: `The user attached ${images.length} image(s)${files.length - images.length > 0 ? ` and ${files.length - images.length} non-image file(s) (their text content is included below)` : ""} while asking: "${userPrompt}". Describe in detail everything visible/important in the attached images that the other AI agents (script writer, video generator, TTS) would need to know.`,
    })
    for (const img of images) {
      content.push({ type: "image_url", image_url: { url: await fileToDataUrl(img) } })
    }
  }
  if (textParts.length > 0) {
    content.push({
      type: "text",
      text: `Attached file contents:\n${textParts.join("\n\n")}\n\nSummarize the key information from these files relevant to: "${userPrompt}".`,
    })
  }

  const res = await fetchRetry(`${CLEAN(c)}/v1/chat/completions`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({
      model: c.model,
      messages: [{ role: "user", content }],
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`vision agent failed: ${res.status}`)
  return parseChatResponse(res)
}