import { useEffect, useState } from "react"
import { SquarePlay, Loader2, Link2, LogOut, UploadCloud, CheckCircle2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { MediaUploadDropzone } from "@/components/ui/MediaUploadDropzone"
import {
  connectYouTube,
  handleRedirect,
  loadClientId,
  saveClientId,
  clearAuth,
  uploadVideo,
  type YtAuth,
  type UploadMeta,
} from "@/lib/youtube"

const inputCls =
  "w-full rounded-xl border border-[#d2d5de] dark:border-[#272832] bg-white dark:bg-[#1c1d25] px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"

export function YouTubePanel() {
  const [auth, setAuth] = useState<YtAuth | null>(null)
  const [booting, setBooting] = useState(true)
  const [clientIdInput, setClientIdInput] = useState(() => loadClientId())
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<UploadMeta>({ title: "", description: "", visibility: "public", madeForKids: true })
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    // OAuth redirect lands back here with ?code=... — exchange it, or restore
    // the saved (auto-refreshed) session.
    handleRedirect(loadClientId())
      .then((a) => {
        if (a) {
          setAuth(a)
          toast.success(`Connected to ${a.channel?.title ?? "your channel"}`)
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
    saveClientId(clientIdInput)
    toast.message("Redirecting to Google sign-in…")
    connectYouTube(clientIdInput).catch((e: Error) => toast.error(e.message))
  }

  const onUpload = async () => {
    if (!file) return toast.error("pick a video file first")
    if (!meta.title.trim()) return toast.error("give the video a title")
    setUploading(true)
    setProgress(0)
    setVideoUrl(null)
    try {
      const id = await uploadVideo(file, meta, setProgress)
      setVideoUrl(`https://youtu.be/${id}`)
      toast.success("Upload complete — processing on YouTube")
      setFile(null)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="w-full rounded-2xl border border-[#d2d5de] dark:border-[#272832] bg-[#f0f1f5] dark:bg-[#14151b] p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#d8dade] dark:border-[#27282f]">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <SquarePlay className="size-4 text-red-600" /> YouTube Channel
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Connect your channel and publish finished videos straight from the studio.
          </p>
        </div>
        {auth && (
          <button
            type="button"
            onClick={() => {
              clearAuth()
              setAuth(null)
              toast.message("Channel disconnected")
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#d2d5de] dark:border-[#272832] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-[#e4e6ed] dark:hover:bg-[#1c1e25] transition-colors"
          >
            <LogOut className="size-3" /> Disconnect
          </button>
        )}
      </div>

      {booting ? (
        <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin" /> Checking connection…
        </div>
      ) : !auth ? (
        <div className="pt-4 flex flex-col gap-3">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            OAuth Client ID
            <input
              className={inputCls + " mt-1.5 font-mono"}
              placeholder="1234-abc.apps.googleusercontent.com"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
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
            <li>Paste the Client ID above and connect.</li>
          </ol>
        </div>
      ) : (
        <div className="pt-4 flex flex-col gap-4">
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
                {auth.channel?.subscribers ?? "—"} subscribers · connected
              </div>
            </div>
          </div>

          <MediaUploadDropzone
            accept="video/*"
            onFileSelect={setFile}
            onClear={() => setFile(null)}
            label={file ? file.name : "Drop your finished video here"}
            sublabel="MP4 or WebM — uploaded as-is"
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onUpload()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 shadow-xs transition-opacity"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              {uploading ? `Uploading ${progress}%` : "Upload to YouTube"}
            </button>
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
            Uploads through your own Google OAuth client — tokens stay in this browser. New API projects need YouTube
            audit-free test mode: uploads are private-only until Google verifies the app.
          </p>
        </div>
      )}
    </section>
  )
}