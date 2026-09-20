// YouTube publish tab. Connect path uses PKCE OAuth + resumable upload
// (youtube.ts); manual path skips OAuth entirely — fills the metadata pack,
// copies it, and opens YouTube Studio's upload page where Google handles the
// account sign-in itself.
import { useEffect, useRef, useState } from "react"
import {
  SquarePlay,
  Loader2,
  Link2,
  LogOut,
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  Copy,
  ClipboardCheck,
  Download,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { takeAutoHandoff, clearAutoHandoff, subscribeAutoHandoff } from "@/lib/autoHandoff"
import { FileUploadCard, type UploadedFile } from "@/components/ui/file-upload-card"
import { runVisionFromDataUrls } from "@/lib/byok"
import { loadConfigs } from "@/lib/agents"
import {
  connectYouTube,
  handleRedirect,
  loadClientId,
  loadClientSecret,
  saveClientId,
  saveClientSecret,
  clearAuth,
  uploadVideo,
  setThumbnail,
  type YtAuth,
  type UploadMeta,
} from "@/lib/youtube"

const inputCls =
  "w-full rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-white dark:bg-[#1c1d25] px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/40"

export function YouTubePanel() {
  const [auth, setAuth] = useState<YtAuth | null>(null)
  const [booting, setBooting] = useState(true)
  const [clientIdInput, setClientIdInput] = useState(() => loadClientId())
  const [secretInput, setSecretInput] = useState(() => loadClientSecret())
  const [meta, setMeta] = useState<UploadMeta>({ title: "", description: "", visibility: "public", madeForKids: true, format: "video" })
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fileLocal, setFileLocal] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [aiBusy, setAiBusy] = useState(false)
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null)
  const bootRan = useRef(false)

  // Auto-handoff: a finished full-automation render pre-fills the dropzone —
  // user clicks straight to Publish. Runs on mount AND when a new render
  // completes while this tab is open.
  useEffect(() => {
    const apply = () => {
      const h = takeAutoHandoff()
      if (!h) return
      const f = new File([h.blob], h.fileName, { type: "video/mp4" })
      setFileLocal(f)
      toast.success(`Full automation finished — "${h.fileName}" is ready to publish`)
    }
    apply()
    return subscribeAutoHandoff(apply)
  }, [])

  useEffect(() => {
    if (bootRan.current) return
    bootRan.current = true
    handleRedirect(loadClientId())
      .then((a) => {
        if (a) {
          setAuth(a)
          toast.success("YouTube connected")
        }
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setBooting(false))
  }, [])

  const onConnect = () => {
    if (!clientIdInput.trim()) {
      toast.error("Paste your OAuth Client ID first — see the numbered steps below the button")
      return
    }
    if (!secretInput.trim()) {
      toast.error("Paste the client secret too (same Credentials page as the Client ID)")
      return
    }
    saveClientId(clientIdInput)
    saveClientSecret(secretInput)
    toast.message("Redirecting to Google sign-in…")
    connectYouTube(clientIdInput).catch((e: Error) => toast.error(e.message))
  }

  const packText = `Title: ${meta.title}\n\nDescription: ${meta.description}\n\nVisibility: ${meta.visibility}\nMade for kids: ${meta.madeForKids ? "yes" : "no"}\nPublish as: ${meta.format === "shorts" ? "YouTube Short (vertical, ≤3 min)" : "Regular YouTube video"}`

  const onManualUpload = async () => {
    if (!meta.title.trim()) {
      toast.error("Fill at least the title first")
      return
    }
    try {
      await navigator.clipboard.writeText(packText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Clipboard blocked — copy the fields manually below")
    }
    toast.message("Metadata copied — pick the file in YouTube Studio")
    window.open("https://studio.youtube.com/channel/UC/videos/upload", "_blank", "noopener")
  }

  // AI title/description: grab frames from the dropped video, let the Vision
  // agent watch them, then write the metadata itself. Frames stay in-memory
  // (data URLs) — nothing is uploaded except to the user's own endpoint.
  const onAiMeta = async () => {
    if (!fileLocal) {
      toast.error("Drop the video file first — the AI watches it to write the details")
      return
    }
    setAiBusy(true)
    try {
      const url = URL.createObjectURL(fileLocal)
      const video = document.createElement("video")
      video.muted = true
      video.src = url
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res()
        video.onerror = () => rej(new Error("browser can't decode this video for frame grabs"))
      })
      // ponytail: 3 evenly-spaced frames (start/middle/late) — enough to read
      // the story; upgrade path = scene-detection sampling for long videos.
      const stamps = [0.1, 0.5, 0.9].map((f) => Math.min(video.duration * f, video.duration - 0.1))
      const frames: string[] = []
      const canvas = document.createElement("canvas")
      canvas.width = 640
      canvas.height = Math.round((640 * video.videoHeight) / Math.max(video.videoWidth, 1))
      const ctx = canvas.getContext("2d")!
      for (const t of stamps) {
        await new Promise<void>((res, rej) => {
          video.onseeked = () => res()
          video.onerror = () => rej(new Error("seek failed"))
          video.currentTime = t
        })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        frames.push(canvas.toDataURL("image/jpeg", 0.7))
      }
      URL.revokeObjectURL(url)

      const vision = loadConfigs().vision
      if (!vision?.baseUrl || !vision.apiKey) {
        toast.error("Configure the Vision agent first (Agents tab → Visual Prompter & Framing)")
        return
      }
      const out = await runVisionFromDataUrls(
        vision,
        frames,
        "You just watched key frames from a YouTube kids video. Write the upload metadata as JSON: {\"title\": string (max 95 chars, fun, emoji ok), \"description\": string (2-4 sentences, kid-friendly, what happens + gentle positive takeaway), \"hashtags\": string[] (exactly 10, no # symbol, mix broad reach like kidsvideos with specific topic tags matching what you saw — think what parents would search)}. JSON only, no markdown fences."
      )
      const m = out.match(/\{[\s\S]*\}/)
      if (!m) throw new Error("model didn't return JSON")
      const parsed = JSON.parse(m[0]) as { title?: string; description?: string; hashtags?: string[] }
      // YouTube: >60 hashtags on a video gets ALL ignored — cap at 15, prefix #
      const tagLine = (parsed.hashtags || [])
        .slice(0, 15)
        .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`)
        .filter((t) => t.length > 1)
        .join(" ")
      setMeta((prev) => ({
        ...prev,
        title: parsed.title?.slice(0, 100) || prev.title,
        description: [parsed.description || prev.description, tagLine].filter(Boolean).join("\n\n"),
      }))
      toast.success("Title, description & hashtags written from the video")
    } catch (e) {
      toast.error((e as Error).message || "Couldn't generate metadata")
    } finally {
      setAiBusy(false)
    }
  }

  // Thumbnail: AI watches candidate frames, picks the best moment, that exact
  // timestamp is re-grabbed at full resolution and cropped to the target
  // ratio (16:9 regular, 9:16 Shorts).
  const onAiThumb = async () => {
    if (!fileLocal) {
      toast.error("Drop the video file first — the AI picks a frame from it")
      return
    }
    setAiBusy(true)
    try {
      const url = URL.createObjectURL(fileLocal)
      const video = document.createElement("video")
      video.muted = true
      video.src = url
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res()
        video.onerror = () => rej(new Error("browser can't decode this video for frame grabs"))
      })
      const stamps = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.min(video.duration * f, video.duration - 0.1))
      const frames: string[] = []
      const small = document.createElement("canvas")
      small.width = 480
      small.height = Math.round((480 * video.videoHeight) / Math.max(video.videoWidth, 1))
      const sctx = small.getContext("2d")!
      for (const t of stamps) {
        await new Promise<void>((res, rej) => {
          video.onseeked = () => res()
          video.onerror = () => rej(new Error("seek failed"))
          video.currentTime = t
        })
        sctx.drawImage(video, 0, 0, small.width, small.height)
        frames.push(small.toDataURL("image/jpeg", 0.7))
      }

      const vision = loadConfigs().vision
      if (!vision?.baseUrl || !vision.apiKey) {
        toast.error("Configure the Vision agent first (Agents tab → Visual Prompter & Framing)")
        return
      }
      // ponytail: lettered grid instead of per-image indices — some vision
      // models skip image order; upgrade path = single-image calls per frame.
      const out = await runVisionFromDataUrls(
        vision,
        frames,
        `These are 5 frames (A-E in order) from a kids YouTube video at ${Math.round(video.duration)}s. Pick the SINGLE best thumbnail frame: clear view of the main character's face, bright, simple composition. Reply ONLY the letter A, B, C, D or E.`
      )
      const idx = Math.max(0, "ABCDE".indexOf(out.trim().toUpperCase().charAt(0)))
      const picked = stamps[idx] ?? stamps[2]

      // Re-grab the chosen moment at full resolution, crop to ratio.
      const crop = meta.format === "shorts" ? 9 / 16 : 16 / 9
      await new Promise<void>((res, rej) => {
        video.onseeked = () => res()
        video.onerror = () => rej(new Error("seek failed"))
        video.currentTime = picked
      })
      const vw = video.videoWidth
      const vh = video.videoHeight
      let sw = vw
      let sh = Math.round(vw / crop)
      if (sh > vh) {
        sh = vh
        sw = Math.round(vh * crop)
      }
      const big = document.createElement("canvas")
      // Thumbnails render max 1280 wide — cap to keep uploads small.
      big.width = Math.min(1280, sw)
      big.height = Math.round((Math.min(1280, sw) * sh) / sw)
      big.getContext("2d")!.drawImage(video, Math.round((vw - sw) / 2), Math.round((vh - sh) / 2), sw, sh, 0, 0, big.width, big.height)
      URL.revokeObjectURL(url)
      const blob = await new Promise<Blob | null>((res) => big.toBlob(res, "image/jpeg", 0.9))
      if (!blob) throw new Error("couldn't render the thumbnail image")
      setThumbBlob(blob)
      toast.success(`Thumbnail from frame ${"ABCDE"[idx] ?? "C"} (${Math.round(picked)}s)`)
    } catch (e) {
      toast.error((e as Error).message || "Couldn't generate thumbnail")
    } finally {
      setAiBusy(false)
    }
  }

  const onUpload = () => {
    if (!fileLocal) {
      toast.error("Drop a video file first")
      return
    }
    setUploading(true)
    setProgress(0)
    uploadVideo(fileLocal, meta, setProgress)
      .then(async (id) => {
        setVideoUrl(`https://youtu.be/${id}`)
        toast.success("Uploaded to YouTube 🎉")
        if (thumbBlob) {
          try {
            await setThumbnail(id, thumbBlob)
            toast.success("Thumbnail set")
          } catch (e) {
            toast.error(`Thumbnail failed (${(e as Error).message}) — set it manually in Studio`)
          }
        }
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setUploading(false))
  }

  const downloadThumb = () => {
    if (!thumbBlob) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(thumbBlob)
    a.download = `${meta.title.slice(0, 40).replace(/[^\w-]+/g, "_") || "thumbnail"}-thumb.jpg`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const clearVideoFile = () => {
    setFileLocal(null)
    setThumbBlob(null)
    clearAutoHandoff()
  }

  // Single-video upload: derive the card's tracked-file list from existing state.
  const uploadFiles: UploadedFile[] = fileLocal
    ? [
        {
          id: "video",
          file: fileLocal,
          progress,
          status: uploading ? "uploading" : videoUrl ? "completed" : "ready",
        },
      ]
    : []

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SquarePlay className="size-4 text-red-600" />
          <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">YouTube Publish</h2>
        </div>
        {auth && (
          <button
            type="button"
            onClick={() => {
              clearAuth()
              setAuth(null)
              toast.message("Disconnected — tokens removed from this browser")
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d5de] dark:border-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[#e9ebf2] dark:hover:bg-[#24252d] transition-colors"
          >
            <LogOut className="size-3" /> Disconnect
          </button>
        )}
      </div>

      {booting ? (
        <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" /> Checking connection…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Connection strip — optional, only needed for one-click uploads */}
          {auth ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#d8dade] dark:border-[#27282f] bg-white dark:bg-[#1c1d25] p-3">
              {auth.channel?.thumb ? (
                <img src={auth.channel.thumb} alt="" className="size-9 rounded-full" />
              ) : (
                <SquarePlay className="size-9 text-red-600" />
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {auth.channel?.title ?? "Connected channel"}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {auth.channel?.subscribers ?? "—"} subscribers · one-click uploads ready
                </div>
              </div>
            </div>
          ) : (
            <details className="rounded-xl border border-[#d8dade] dark:border-[#27282f] bg-white dark:bg-[#1c1d25] p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-zinc-700 dark:text-zinc-200">
                Connect channel (optional — for one-click upload)
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  OAuth Client ID
                  <input
                    className={inputCls + " mt-1.5 font-mono"}
                    placeholder="1234-abc.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Client secret
                  <input
                    type="password"
                    className={inputCls + " mt-1.5 font-mono"}
                    placeholder="GOCSPX-…"
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={onConnect}
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:opacity-90 shadow-xs transition-opacity"
                >
                  <Link2 className="size-3.5" /> Connect YouTube account
                </button>
                <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  <li>
                    Google Cloud Console → new project → "YouTube Data API v3" → <b>Enable</b>.
                  </li>
                  <li>
                    APIs &amp; Services → OAuth consent screen → External → add yourself as test user.
                  </li>
                  <li>
                    Credentials → Create OAuth client ID → <b>Web application</b> → Authorized redirect URI:{" "}
                    <code className="rounded bg-[#e2e4ea] dark:bg-[#1c1d25] px-1">http://localhost:5173/</code>
                  </li>
                  <li>Paste the Client ID + secret above and connect.</li>
                </ol>
              </div>
            </details>
          )}

          <FileUploadCard
            single
            accept="video/*"
            formats="MP4 or WebM video — uploaded straight to your channel."
            files={uploadFiles}
            onFilesChange={(fs) => {
              const f = fs[0]
              if (!f) return
              setFileLocal(f)
              setThumbBlob(null)
              clearAutoHandoff()
              setVideoUrl(null)
            }}
            onFileRemove={() => clearVideoFile()}
            className="max-w-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onAiThumb()}
              disabled={aiBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
            >
              {aiBusy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {aiBusy ? "Picking frame…" : meta.format === "shorts" ? "AI thumbnail (9:16)" : "AI thumbnail (16:9)"}
            </button>
            {thumbBlob && (
              <>
                <img src={URL.createObjectURL(thumbBlob)} alt="thumbnail preview" className="h-14 rounded border border-[#d2d5de] dark:border-[#272832]" />
                <button
                  type="button"
                  onClick={downloadThumb}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d5de] dark:border-[#272832] px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-[#e9ebf2] dark:hover:bg-[#24252d] transition-colors"
                >
                  <Download className="size-3" /> Download
                </button>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {auth ? "auto-set after upload" : "manual mode: upload in Studio after publishing"}
                </span>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              <span className="flex items-center justify-between">
                Title
                <button
                  type="button"
                  title="AI watches the video and writes the title & description"
                  onClick={() => void onAiMeta()}
                  disabled={aiBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                >
                  {aiBusy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  {aiBusy ? "Watching video…" : "AI write"}
                </button>
              </span>
              <input
                className={inputCls + " mt-1.5"}
                placeholder="SpidyCat — Never Give Up! 🎵"
                value={meta.title}
                onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Description
              <textarea
                className={inputCls + " mt-1.5 min-h-20"}
                placeholder="An encouraging kids song about trying again!"
                value={meta.description}
                onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Publish as
              <select
                className={inputCls + " mt-1.5"}
                value={meta.format}
                onChange={(e) => setMeta((m) => ({ ...m, format: e.target.value as UploadMeta["format"] }))}
              >
                <option value="video">Regular video</option>
                <option value="shorts">Short (vertical, ≤3 min)</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Visibility
              <select
                className={inputCls + " mt-1.5"}
                value={meta.visibility}
                onChange={(e) => setMeta((m) => ({ ...m, visibility: e.target.value as UploadMeta["visibility"] }))}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 self-end rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-white dark:bg-[#1c1d25] px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                className="size-3.5 accent-indigo-600"
                checked={meta.madeForKids}
                onChange={(e) => setMeta((m) => ({ ...m, madeForKids: e.target.checked }))}
              />
              Made for Kids (COPPA)
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {auth ? (
              <button
                type="button"
                onClick={() => void onUpload()}
                disabled={uploading || !fileLocal}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 shadow-xs transition-opacity"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                {uploading ? `Uploading ${progress}%` : "Upload to YouTube"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onManualUpload()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-xs transition-opacity"
              >
                {copied ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy details + open YouTube Studio
              </button>
            )}
            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <CheckCircle2 className="size-3.5" /> Uploaded — open video <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Manual mode: metadata is copied to your clipboard and YouTube Studio opens — pick the file there and paste.
            One-click mode needs the OAuth client above; tokens stay in this browser. Unverified API projects upload
            private-only until Google verifies the app.
          </p>
        </div>
      )}
    </section>
  )
}