// BYOK API layer — talks only to user-configured endpoints. Keys never logged.
import type { AgentConfig, Capability } from "./agents"

// Normalize base URL: trim slashes, de-duplicate /v1 (user may paste
// https://host/v1 or https://host — we always append /v1/... paths).
function normalizeBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "")
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed
}

// CLEAN adds /v1/... paths after the base. But Google's OpenAI-compat layer
// already ends in /openai and wants /chat/completions directly after it.
function CLEAN(c: AgentConfig): string {
  return normalizeBase(c.baseUrl)
}

// Build the full endpoint target for an OpenAI-style path, honoring the
// Google compat layer (…/v1beta/openai/chat/completions, no /v1 segment).
function targetFor(c: AgentConfig, path: string): string {
  const base = CLEAN(c)
  if (/\/openai$/.test(base)) {
    // Google OpenAI-compat: base already includes the version root
    return `${base}${path.replace(/^\/v1/, "")}`
  }
  return `${base}${path}`
}

// All endpoint calls go through the dev-server CORS proxy (/cors-proxy/,
// real URL passed via x-target-url header) so endpoints that don't send
// CORS headers work. Path is always /cors-proxy/ — target in header only.
function endpointUrl(): string {
  return "/cors-proxy/"
}

function headers(c: AgentConfig): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` }
}

// fetch with auto-retry on 429/5xx — respects Retry-After, backs off exponentially.
// timeoutMs: 15s default for text endpoints; image generation is SLOW (15-60s+)
// through combo routers, so image calls pass a longer timeout explicitly.
// Backoff caps at 20s so per-minute quota windows get a chance to reset.
async function fetchRetry(input: string, init: RequestInit, tries = 2, timeoutMs = 15_000): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < tries; attempt++) {
    let res: Response
    try {
      res = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (e) {
      if ((e as Error).name === "TimeoutError") throw new Error(`endpoint timed out after ${timeoutMs / 1000}s`)
      throw new Error(
        `Failed to reach endpoint (${(e as Error).message}). Check base URL & CORS.`
      )
    }
    // retry on 429 AND 5xx (routers often wrap upstream 429s as 502)
    if (res.status !== 429 && res.status < 500) return res
    last = res
    if (attempt < tries - 1) {
      const retryAfter = Number(res.headers.get("retry-after"))
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20_000)
        : Math.min(2000 * 3 ** attempt, 20_000)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  return last!
}

// res.json() with clear error when endpoint returns HTML (404 page, login page).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function jsonOrExplain(res: Response): Promise<any> {
  const ct = (res.headers.get("content-type") ?? "").toLowerCase()
  if (ct.includes("text/html") || ct === "") {
    const snippet = (await res.text()).slice(0, 120).replace(/\s+/g, " ")
    throw new Error(
      `endpoint returned HTML instead of JSON (HTTP ${res.status}) — usually a wrong base URL/404 page. Got: "${snippet}"`
    )
  }
  return res.json()
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
  const data = await jsonOrExplain(res)
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== "string") throw new Error("unexpected chat response shape")
  return text
}

export async function fetchModels(c: AgentConfig): Promise<string[]> {
  const res = await fetchRetry(endpointUrl(), { headers: { ...headers(c), "x-target-url": targetFor(c, "/v1/models") } })
  if (!res.ok) throw new Error(`GET /v1/models failed: ${res.status}`)
  const data = await jsonOrExplain(res)
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
// Chat-model fallback chain: when a subagent's model is quota-dead (429/502),
// the router rotates to the next candidate instead of failing the stage.
const CHAT_FALLBACK_MODELS = ["GLM-5.2", "ag/gemini-3.8-flash-high", "ag/gemini-3.7-flash-medium", "ag/gemini-3.5-flash-low", "cheap-model"]

async function runChatWithFallback(
  c: AgentConfig,
  messages: unknown[],
  what: string,
  timeoutMs = 15_000
): Promise<string> {
  const candidates = [c.model, c.escalateModel, ...CHAT_FALLBACK_MODELS]
    .filter((m): m is string => Boolean(m))
  const seen = new Set<string>()
  const errors: string[] = []
  for (const model of candidates) {
    if (seen.has(model)) continue
    seen.add(model)
    let res: Response
    try {
      res = await fetchRetry(endpointUrl(), {
        method: "POST",
        headers: { ...headers(c), "x-target-url": targetFor(c, "/v1/chat/completions") },
        body: JSON.stringify({ model, messages, stream: false }),
      }, 2, timeoutMs)
    } catch (e) {
      // timeout/network on one candidate shouldn't kill the fallback chain
      errors.push(`${model}: ${(e as Error).message}`)
      continue
    }
    if (res.ok) return parseChatResponse(res)
    errors.push(`${model}: HTTP ${res.status}`)
    // non-quota client errors (400/401/403/404) = config problem, don't rotate
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) break
  }
  throw new Error(`${what} failed — tried ${seen.size} model(s), all quota-limited or unavailable. Last: ${errors.slice(-2).join(" | ")}`)
}

export async function runScript(c: AgentConfig, prompt: string): Promise<string> {
  const messages = []
  if (c.skill?.trim()) {
    messages.push({ role: "system", content: c.skill.trim() })
  }
  messages.push({ role: "user", content: prompt })
  return runChatWithFallback(c, messages, "Script agent")
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

// text-to-image — portrait or model sheet generator
// ponytail: image gen takes 15-60s+ through combo routers — 120s timeout.
// Combo round-robin can rotate onto dead/quota'd backends (429/502/503), so
// after the combo fails we retry the working antigravity image tag directly.
// Router tags (ag/…, gemini/…) only exist on 9router; Google's OpenAI-compat
// layer needs bare model names. Tag → bare maps cleanly (segment after "/").
function googleModelName(model: string, target: string): string {
  return target.includes("/openai") && model.includes("/") ? (model.split("/").pop() as string) : model
}

const IMAGE_FALLBACK_MODELS = ["ag/gemini-3.1-flash-image", "gemini/gemini-3.1-flash-image"]
// Bare names for Google OpenAI-compat targets (no 9router tags).
// Verified 2026-09-16: only gemini-2.5-flash-image + gemini-3-pro-image-preview
// are recognized by the compat endpoint; 3.1 variants 404 there (v1main).
const GOOGLE_IMAGE_FALLBACK_MODELS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"]

// Image endpoints take only a prompt (no system messages), so the agent's custom
// skill text gets prepended to the prompt — the agent's style/layout rules apply.
function withSkill(c: AgentConfig, prompt: string): string {
  const skill = c.skill?.trim()
  return skill ? `${skill}\n\n${prompt}` : prompt
}

async function tryImageOnce(c: AgentConfig, target: string, model: string, prompt: string, size: string): Promise<Response> {
  return fetchRetry(endpointUrl(), {
    method: "POST",
    headers: { ...headers(c), "x-target-url": target },
    body: JSON.stringify({
      prompt: withSkill(c, prompt).slice(0, 4000),
      model,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  // ponytail: inner tries=1 — the caller's retry loop already rotates models,
  // so re-trying the same dead backend here just burns 20s backoffs.
  }, 1, 120_000)
}

function parseImageResponse(res: Response): Promise<string> {
  if (res.headers.get("content-type")?.startsWith("image/")) {
    // ponytail: blob→base64 so URLs survive page reload (blob: URLs die on refresh)
    return res.blob().then((blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    )
  }
  return jsonOrExplain(res).then((data) => {
    const b64 = data?.data?.[0]?.b64_json
    if (b64) return `data:image/png;base64,${b64}`
    const imgUrl = data?.data?.[0]?.url
    if (typeof imgUrl === "string") return imgUrl
    throw new Error("no image returned from endpoint")
  })
}

// Parse the shortest reset delay from a quota error body so we can
// wait exactly as long as the freshest capacity window needs (usually seconds-minutes).
// Handles both antigravity's "reset after X" and Google's RetryInfo retryDelay.
function parseMinResetMs(text: string): number | null {
  const matches = [
    ...text.matchAll(/reset after\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/g),
    ...text.matchAll(/retryDelay"?\s*[:=]\s*"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?"/g),
    ...text.matchAll(/retry after\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)/gi),
  ]
  let minMs: number | null = null
  for (const m of matches) {
    const [, h, mm, ss] = m
    if (!h && !mm && !ss) continue
    const total = ((h ? parseInt(h) : 0) * 3600 + (mm ? parseInt(mm) : 0) * 60 + (ss ? parseInt(ss) : 0)) * 1000
    if (total > 0 && (minMs === null || total < minMs)) minMs = total
  }
  return minMs
}

const IMAGE_RETRY_BUDGET_MS = 360_000 // keep trying up to 6 minutes total
const IMAGE_MIN_WAIT_MS = 5_000
const IMAGE_MAX_WAIT_MS = 90_000

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

// text-to-image — portrait or model sheet generator with model fallback chain
// Persists across capacity windows: antigravity resets are often seconds-minutes,
// each request rotates to a different account, so retrying until the budget
// runs out lands on an account with image capacity.
export async function runImage(c: AgentConfig, prompt: string): Promise<string> {
  const path = c.imagePath?.trim() || "/v1/images/generations"
  return runImageRetry(c, targetFor(c, path), prompt, "1792x1024", "Image generation")
}

class QuotaResetError extends Error {}

function quotaResetError(what: string, errors: string[], resetMs: number | null, daily = false): string {
  const wait = daily
    ? " Free-tier image quota is hard-exhausted (limit: 0) — this won't clear in minutes. Add another antigravity account, enable billing, or switch the image provider."
    : resetMs ? ` Quota resets in ~${Math.ceil(resetMs / 60000)} min — retry then, or switch the Image Generator model in Agents.`
    : " Wait for the quota to reset or switch the model in Agents."
  return `${what} failed — all image models quota-limited.${wait} ` +
    `Last errors: ${errors.slice(-3).join(" | ")}`
}

async function runImageRetry(
  c: AgentConfig,
  target: string,
  prompt: string,
  size: string,
  what: string
): Promise<string> {
  // Pollinations: free GET-per-prompt image endpoint (no key, no /models).
  // Prompt lives in the URL path; response body IS the image. Intermittent
  // 403s (verified) — the retry loop absorbs them. Random seed busts caching.
  if (target.includes("pollinations.ai")) {
    const [w, h] = size.split("x")
    const origin = new URL(target).origin
    const errors: string[] = []
    const deadline = Date.now() + IMAGE_RETRY_BUDGET_MS
    let waitMs = IMAGE_MIN_WAIT_MS
    while (Date.now() < deadline) {
      const q = encodeURIComponent(withSkill(c, prompt).slice(0, 2000))
      const url = `${origin}/prompt/${q}?width=${w}&height=${h}&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e6)}`
      const res = await fetchRetry(endpointUrl(), {
        method: "GET",
        headers: { ...headers(c), "x-target-url": url },
      }, 2, 120_000)
      if (res.ok) return parseImageResponse(res)
      errors.push(`pollinations: HTTP ${res.status}`)
      if (Date.now() + waitMs >= deadline) break
      await sleep(waitMs)
      waitMs = Math.min(waitMs * 2, IMAGE_MAX_WAIT_MS)
    }
    throw new Error(`${what} failed — Pollinations unavailable (${errors.slice(-2).join(" | ")}).`)
  }
  // Google OpenAI-compat targets can't parse 9router tags (ag/…, gemini/…) —
  // they 404 as "models/ag/… is not found for API version v1main". Use bare names.
  const bare = target.includes("/openai")
  const sourceModels = bare ? GOOGLE_IMAGE_FALLBACK_MODELS : IMAGE_FALLBACK_MODELS
  const candidates = [googleModelName(c.model, target), ...sourceModels.filter((m) => googleModelName(m, target) !== googleModelName(c.model, target))]
  const errors: string[] = []
  const deadline = Date.now() + IMAGE_RETRY_BUDGET_MS
  let waitMs = IMAGE_MIN_WAIT_MS

  while (Date.now() < deadline) {
    for (const model of candidates) {
      // one attempt can take up to the full timeout — re-check between models
      if (Date.now() >= deadline) break
      try {
        const res = await tryImageOnce(c, target, model, prompt, size)
        if (!res.ok) {
          const detail = await res.text().catch(() => "")
          errors.push(`${model}: HTTP ${res.status} ${detail.slice(0, 120)}`)
          // Daily quotas report a tiny retryDelay but never recover mid-day —
          // "retry in 33s" on a PerDay violation is a lie. Detect and fail fast.
          const isDaily = /quotaId.\s*:\s*.[^"]*PerDay/i.test(detail) ||
            /generate_content_free_tier_(requests|input_token_count), limit: 0/.test(detail)
          const resetMs = parseMinResetMs(detail)
          if (isDaily) {
            throw new QuotaResetError(quotaResetError(what, errors, null, true))
          }
          if (resetMs !== null) {
            if (resetMs >= deadline - Date.now()) {
              // quota resets after our budget expires — retrying is futile, fail now
              throw new QuotaResetError(quotaResetError(what, errors, resetMs))
            }
            waitMs = Math.min(Math.max(resetMs, IMAGE_MIN_WAIT_MS), IMAGE_MAX_WAIT_MS)
          }
          continue
        }
        return await parseImageResponse(res)
      } catch (e) {
        if (e instanceof QuotaResetError) throw e
        errors.push(`${model}: ${(e as Error).message}`)
      }
    }
    if (Date.now() + waitMs >= deadline) break
    await sleep(waitMs)
    waitMs = Math.min(waitMs * 2, IMAGE_MAX_WAIT_MS)
  }
  throw new Error(quotaResetError(what, errors, null))
}

// image reference flow — 9router's /v1/images/generations IGNORES reference
// images (verified: returns unrelated content), so consistency must come from
// the frozen master prompt. Reference existence just re-emphasizes the prompt.
export async function runImageWithReference(
  c: AgentConfig,
  prompt: string,
  _referenceDataUrl?: string
): Promise<string> {
  return runImage(c, prompt)
}


export async function runKeyframeImage(
  c: AgentConfig,
  prompt: string,
  aspectRatio: "16:9" | "9:16" = "16:9"
): Promise<string> {
  const path = c.imagePath?.trim() || "/v1/images/generations"
  const target = targetFor(c, path)
  const size = aspectRatio === "16:9" ? "1792x1024" : "1024x1792"
  const fullPrompt = `${prompt.slice(0, 900)}, 3D digital animation render, volumetric soft lighting, vibrant preschool palette, cinematic depth of field, no text`
  return runImageRetry(c, target, fullPrompt, size, "Keyframe generation")
}

// text-to-speech — High-speed parallel edge-tts speech synthesis stems
export async function synthesizeSpeech(
  text: string,
  voice: string = "en-US-AnaNeural"
): Promise<string> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    })
    if (res.ok) {
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }
  } catch {
    // API endpoint unavailable — fall through to silent/Web Audio fallback
  }

  // Fallback: Generate minimal silent MP3 or empty data URI to maintain pipeline integrity
  return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=="
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

// Vision from ready-made frame data URLs (video frame grabs — see YouTubePanel)
export async function runVisionFromDataUrls(
  c: AgentConfig,
  dataUrls: string[],
  userPrompt: string
): Promise<string> {
  if (dataUrls.length === 0) return ""
  const content: unknown[] = [{ type: "text", text: userPrompt }]
  for (const url of dataUrls) content.push({ type: "image_url", image_url: { url } })
  const messages: unknown[] = []
  if (c.skill?.trim()) messages.push({ role: "system", content: c.skill.trim() })
  messages.push({ role: "user", content })
  // ponytail: multi-frame base64 vision calls take 30-120s through combo
  // routers — 15s text timeout kills them mid-flight. Same ceiling as image gen.
  return runChatWithFallback(c, messages, "Vision agent", 120_000)
}
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
      text: `The user attached ${images.length} image(s)${files.length - images.length > 0 ? ` and ${files.length - images.length} non-image file(s) (their text content is included below)` : ""} while asking: "${userPrompt}". Describe in detail everything visible/important in the attached images that the other AI agents (script writer, 360° character modeler) would need to know.`,
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

  const messages: unknown[] = []
  if (c.skill?.trim()) {
    messages.push({ role: "system", content: c.skill.trim() })
  }
  messages.push({ role: "user", content })

  return runChatWithFallback(c, messages, "Vision agent")
}