// BYOK API layer — talks only to user-configured endpoints. Keys never logged.
import type { AgentConfig, Capability } from "./agents"

const CLEAN = (c: AgentConfig) => c.baseUrl.replace(/\/+$/, "")

function headers(c: AgentConfig): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` }
}

export async function fetchModels(c: AgentConfig): Promise<string[]> {
  const res = await fetch(`${CLEAN(c)}/v1/models`, { headers: headers(c) })
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
  const res = await fetch(`${CLEAN(c)}/v1/chat/completions`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: prompt }] }),
  })
  if (!res.ok) throw new Error(`script agent failed: ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== "string") throw new Error("unexpected script response shape")
  return text
}

// text-to-video — returns playable video URL. Capability-mismatch checked by Monitor.
export async function runVideo(c: AgentConfig, prompt: string): Promise<string> {
  const res = await fetch(`${CLEAN(c)}/v1/video/generations`, {
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
  const res = await fetch(`${CLEAN(c)}/v1/audio/speech`, {
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

  const res = await fetch(`${CLEAN(c)}/v1/chat/completions`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({
      model: c.model,
      messages: [{ role: "user", content }],
    }),
  })
  if (!res.ok) throw new Error(`vision agent failed: ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== "string") throw new Error("unexpected vision response shape")
  return text
}