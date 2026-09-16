// YouTube connect: PKCE OAuth + Data API v3 + resumable upload.
// ponytail: tokens in localStorage like agent keys — swap for a real backend
// with server-side token storage if the studio is ever multi-user.
import { loadChannelInfo } from "./youtubeTypes"
const AUTH_KEY = "yt-kids-youtube-v1"
const CLIENT_KEY = "yt-kids-youtube-clientid"
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
]

export interface YtChannel {
  id: string
  title: string
  thumb: string | null
  subscribers: string
}

export interface YtAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
  channel: YtChannel | null
}

export function loadClientId(): string {
  return localStorage.getItem(CLIENT_KEY) ?? ""
}

export function saveClientId(id: string): void {
  localStorage.setItem(CLIENT_KEY, id.trim())
}

function b64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { verifier, challenge: b64url(new Uint8Array(digest)) }
}

// Kick off the OAuth dance. Redirects the whole page to Google, then back to
// this same app URL with ?code=... which handleRedirect() exchanges.
export async function connectYouTube(clientId: string): Promise<void> {
  if (!clientId.trim()) throw new Error("paste your OAuth Client ID first")
  const { verifier, challenge } = await pkcePair()
  sessionStorage.setItem("yt-pkce-verifier", verifier)
  const redirect = window.location.origin + window.location.pathname
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", clientId.trim())
  url.searchParams.set("redirect_uri", redirect)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", SCOPES.join(" "))
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", crypto.randomUUID())
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent") // force refresh_token issuance
  window.location.href = url.toString()
}

interface Tokens {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch("/cors-proxy/", {
    method: "POST",
    headers: { "x-target-url": "https://oauth2.googleapis.com/token" },
    body: new URLSearchParams(body), // urlencoded content-type set automatically
  })
  const data = (await res.json().catch(() => ({}))) as Tokens & { error_description?: string; error?: string }
  if (!res.ok) throw new Error(`token exchange failed: ${data.error_description ?? data.error ?? res.status}`)
  return data
}

async function toAuth(tokens: Tokens, refreshToken?: string): Promise<YtAuth> {
  const auth: YtAuth = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken ?? "",
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
    channel: null,
  }
  if (!auth.refreshToken) throw new Error("Google did not return a refresh token — reconnect and approve again")
  auth.channel = await loadChannelInfo(auth.accessToken)
  saveAuth(auth)
  return auth
}

export function loadAuth(): YtAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as YtAuth) : null
  } catch {
    return null
  }
}

function saveAuth(auth: YtAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY)
}

// Boot path: exchanges ?code=... after the redirect, or restores + refreshes
// the saved session. Returns null when nothing to restore.
export async function handleRedirect(clientId: string): Promise<YtAuth | null> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get("code")
  if (code) {
    const verifier = sessionStorage.getItem("yt-pkce-verifier") ?? ""
    window.history.replaceState({}, "", window.location.pathname)
    if (!clientId.trim() || !verifier) throw new Error("missing client ID or PKCE verifier — connect again")
    const tokens = await tokenRequest({
      client_id: clientId.trim(),
      code,
      code_verifier: verifier,
      redirect_uri: window.location.origin + window.location.pathname,
      grant_type: "authorization_code",
    })
    sessionStorage.removeItem("yt-pkce-verifier")
    return toAuth(tokens)
  }
  const saved = loadAuth()
  if (!saved?.refreshToken) return null
  if (Date.now() < saved.expiresAt) return saved
  // refresh expired access token
  const tokens = await tokenRequest({
    client_id: clientId.trim(),
    refresh_token: saved.refreshToken,
    grant_type: "refresh_token",
  }).catch((e: Error) => {
    clearAuth()
    throw new Error(`session expired (${e.message}) — reconnect your channel`)
  })
  return toAuth(tokens, saved.refreshToken)
}

// Always-current access token; refreshes transparently.
export async function getAccessToken(): Promise<string> {
  const auth = loadAuth()
  if (!auth?.refreshToken) throw new Error("no YouTube account connected")
  if (Date.now() < auth.expiresAt) return auth.accessToken
  const clientId = loadClientId()
  if (!clientId) throw new Error("missing OAuth client ID — reconnect your channel")
  const tokens = await tokenRequest({
    client_id: clientId,
    refresh_token: auth.refreshToken,
    grant_type: "refresh_token",
  }).catch((e: Error) => {
    clearAuth()
    throw new Error(`session expired (${e.message}) — reconnect your channel`)
  })
  const next: YtAuth = { ...auth, accessToken: tokens.access_token, expiresAt: Date.now() + (tokens.expires_in - 60) * 1000 }
  saveAuth(next)
  return next.accessToken
}

// Resumable upload: init call returns a session URL, then one streamed PUT
// (final chunk rules allow a single whole-file PUT) with XHR progress events.
export interface UploadMeta {
  title: string
  description: string
  visibility: "public" | "unlisted" | "private"
  madeForKids: boolean
  tags?: string[]
}

export async function uploadVideo(
  file: File,
  meta: UploadMeta,
  onProgress: (pct: number) => void
): Promise<string> {
  const token = await getAccessToken()
  const initRes = await fetch("/cors-proxy/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "x-target-url":
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    },
    body: JSON.stringify({
      snippet: {
        title: meta.title,
        description: meta.description,
        tags: meta.tags?.filter(Boolean),
        categoryId: "24", // Entertainment
      },
      status: {
        privacyStatus: meta.visibility,
        madeForKids: meta.madeForKids,
        selfDeclaredMadeForKids: meta.madeForKids,
      },
    }),
  })
  if (!initRes.ok) {
    const detail = (await initRes.text().catch(() => "")).slice(0, 160)
    throw new Error(`upload init failed: HTTP ${initRes.status} ${detail}`)
  }
  const uploadUrl = initRes.headers.get("location")
  if (!uploadUrl) throw new Error("YouTube returned no upload session URL")

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", "/cors-proxy/")
    xhr.setRequestHeader("x-target-url", uploadUrl)
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const id = (JSON.parse(xhr.responseText) as { id?: string }).id
          if (id) return resolve(id)
        } catch {
          /* fall through */
        }
        reject(new Error("upload finished but response was unreadable — check YouTube Studio"))
      } else {
        reject(new Error(`upload failed: HTTP ${xhr.status} ${xhr.responseText.slice(0, 140)}`))
      }
    }
    xhr.onerror = () => reject(new Error("network error during upload"))
    xhr.send(file)
  })
}