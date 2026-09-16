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
} from "lucide-react"
import { toast } from "sonner"
import { MediaUploadDropzone } from "@/components/ui/MediaUploadDropzone"
import {
  connectYouTube,
  handleRedirect,
  loadClientId,
  loadClientSecret,
  saveClientId,
  saveClientSecret,
  clearAuth,
  uploadVideo,
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
  const [meta, setMeta] = useState<UploadMeta>({ title: "", description: "", visibility: "public", madeForKids: true })
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [fileLocal, setFileLocal] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const bootRan = useRef(false)

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

  const packText = `Title: ${meta.title}\n\nDescription: ${meta.description}\n\nVisibility: ${meta.visibility}\nMade for kids: ${meta.madeForKids ? "yes" : "no"}`

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

  const onUpload = () => {
    if (!fileLocal) {
      toast.error("Drop a video file first")
      return
    }
    setUploading(true)
    setProgress(0)
    uploadVideo(fileLocal, meta, setProgress)
      .then((id) => {
        setVideoUrl(`https://youtu.be/${id}`)
        toast.success("Uploaded to YouTube 🎉")
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setUploading(false))
  }

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

          <MediaUploadDropzone
            accept="video/*"
            onFileSelect={setFileLocal}
            onClear={() => setFileLocal(null)}
            label={fileLocal ? fileLocal.name : "Drop your finished video here"}
            sublabel={auth ? "MP4 or WebM — uploaded as-is" : "Manual mode: Studio copies it from your computer"}
            className="min-h-[100px]"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Title
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
          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e4ea] dark:bg-[#1c1d25]">
              <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
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