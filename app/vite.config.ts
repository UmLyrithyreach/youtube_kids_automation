import path from "node:path"
import http from "node:http"
import https from "node:https"
import os from "node:os"
import fs from "node:fs/promises"
import { createReadStream, existsSync, readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import react from "@vitejs/plugin-react"
import { defineConfig, type Connect, type Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"

// edge-tts integration plugin: streams high-speed neural voice synthesis stems
function ttsPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/tts") || req.method !== "POST") {
      return next()
    }
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      try {
        const { text, voice = "en-US-AnaNeural" } = JSON.parse(body)
        if (!text || typeof text !== "string") {
          res.statusCode = 400
          res.end(JSON.stringify({ error: "missing text" }))
          return
        }
        // Spawn edge-tts CLI directly to stream MP3 audio
        const proc = spawn("edge-tts", ["--voice", voice, "--text", text, "--write-media", "-"])
        res.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=3600",
        })
        proc.stdout.pipe(res)
        proc.stderr.on("data", () => {
          // suppress CLI debug output
        })
        proc.on("error", (err) => {
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: `edge-tts execution failed: ${err.message}` }))
          }
        })
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ error: "invalid json payload" }))
      }
    })
  }

  return {
    name: "edge-tts-api",
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// Local FFmpeg Render Server: turns the AI pipeline's deliverable (keyframes
// + TTS stems) into a finished, YouTube-ready MP4 — Ken Burns zoompan per
// scene, AAC voice track, concat. This is the "full automation" engine; the
// copy-paste assemble.sh path stays as the manual fallback.
function renderPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    // Health endpoint for the Production Agents monitor (GET /api/health).
    if (req.url?.startsWith("/api/health") && (req.method === "GET" || req.method === "HEAD")) {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
      res.end(JSON.stringify({ ok: true, engine: "ffmpeg" }))
      return
    }
    if (!req.url?.startsWith("/api/render") || req.method !== "POST") {
      return next()
    }
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", async () => {
      try {
        const { format = "16:9", scenes } = JSON.parse(body)
        if (!Array.isArray(scenes) || scenes.length === 0 || scenes.length > 80) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: "scenes[] required (1-80)" }))
          return
        }
        const W = format === "9:16" ? 1080 : 1920
        const H = format === "9:16" ? 1920 : 1080
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ytrender-"))
        const list: string[] = []
        try {
          for (let i = 0; i < scenes.length; i++) {
            const sc = scenes[i]
            const dur = Math.max(0.5, Math.min(600, Number(sc.timingSeconds) || 4))
            const imgPath = path.join(tmp, `kf${i}.img`)
            let haveImg = false
            if (typeof sc.keyframeUrl === "string" && sc.keyframeUrl.startsWith("data:")) {
              const m = /^data:([^;,]+);base64,(.*)$/s.exec(sc.keyframeUrl)
              if (m) {
                await fs.writeFile(imgPath, Buffer.from(m[2], "base64"))
                haveImg = true
              }
            } else if (typeof sc.keyframeUrl === "string" && /^https?:\/\//.test(sc.keyframeUrl)) {
              const r = await fetch(sc.keyframeUrl)
              if (r.ok) {
                await fs.writeFile(imgPath, Buffer.from(await r.arrayBuffer()))
                haveImg = true
              }
            }
            const sceneMp4 = path.join(tmp, `scene_${i}.mp4`)
            const args = ["-y"]
            if (haveImg) {
              args.push("-loop", "1", "-framerate", "30", "-t", String(dur), "-i", imgPath)
            } else {
              args.push("-f", "lavfi", "-t", String(dur), "-i", `color=c=0x232338:s=${W}x${H}`)
            }
            let haveAudio = false
            if (typeof sc.audioUrl === "string" && sc.audioUrl.startsWith("data:") && sc.audioUrl.length > 500) {
              const m = /^data:([^;,]+);base64,(.*)$/s.exec(sc.audioUrl)
              if (m) {
                await fs.writeFile(path.join(tmp, `au${i}.bin`), Buffer.from(m[2], "base64"))
                args.push("-i", path.join(tmp, `au${i}.bin`))
                haveAudio = true
              }
            }
            if (!haveAudio) {
              args.push("-f", "lavfi", "-t", String(dur), "-i", "anullsrc=r=44100:cl=stereo")
            }
            args.push(
              "-filter_complex",
              `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},zoompan=z='min(1.001+0.00028*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30,format=yuv420p[v]`,
              "-map", "[v]", "-map", "1:a",
              "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
              "-c:a", "aac", "-b:a", "128k",
              "-t", String(dur), "-shortest",
              sceneMp4
            )
            await runFfmpeg(args)
            list.push(`file '${sceneMp4}'`)
          }
          const listPath = path.join(tmp, "list.txt")
          await fs.writeFile(listPath, list.join("\n"))
          const outPath = path.join(tmp, "final.mp4")
          await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outPath])
          const stat = await fs.stat(outPath)
          res.writeHead(200, {
            "Content-Type": "video/mp4",
            "Content-Length": String(stat.size),
            "Cache-Control": "no-store",
          })
          const stream = createReadStream(outPath)
          stream.pipe(res)
          stream.on("close", () => fs.rm(tmp, { recursive: true, force: true }).catch(() => {}))
          stream.on("error", () => fs.rm(tmp, { recursive: true, force: true }).catch(() => {}))
        } catch (e) {
          fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
          throw e
        }
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: `render failed: ${(e as Error).message}` }))
        }
      }
    })
  }
  return {
    name: "ffmpeg-render-api",
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args)
    let errTail = ""
    proc.stderr.on("data", (d: Buffer) => {
      errTail = (errTail + d.toString()).slice(-600)
    })
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${errTail.slice(-300)}`))
    )
    proc.on("error", reject)
  })
}

// CORS bypass for BYOK endpoints: the browser calls /cors-proxy/* with an
// x-target-url header; this plugin forwards the request server-side (where
// CORS doesn't apply) and relays the response back.
function corsProxy(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res) => {
    const target = req.headers["x-target-url"]
    if (typeof target !== "string" || !/^https?:\/\//.test(target)) {
      res.statusCode = 400
      res.end("missing or invalid x-target-url header")
      return
    }
    const u = new URL(target)
    const mod = u.protocol === "http:" ? http : https
    const fwdHeaders = { ...req.headers, host: u.host } as Record<string, string | string[] | undefined>
    delete fwdHeaders["x-target-url"] // never forward to endpoint
    const fwd = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: req.method,
        headers: fwdHeaders,
      },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers)
        upstream.pipe(res)
      }
    )
    fwd.on("error", (e: Error) => {
      res.statusCode = 502
      res.end(`proxy error: ${e.message}`)
    })
    req.pipe(fwd)
  }
  return {
    name: "cors-proxy",
    // dev server
    configureServer(server) {
      server.middlewares.use("/cors-proxy", handler)
    },
    // production preview (npm run preview / dist build) — same proxy needed
    configurePreviewServer(server) {
      server.middlewares.use("/cors-proxy", handler)
    },
  }
}

// ---------------------------------------------------------------------------
// 9router OAuth account import + live quota: reads the local 9router sqlite
// (READ-ONLY) and serves its providerConnections as import rows — provider,
// email, authType, active, and any still-active modelLock_* as lockUntil. API
// keys and OAuth tokens NEVER leave the file: imported accounts call the
// gateway, which holds the credentials. Login state lives in 9router; we
// mirror it. /api/9router-quota additionally calls the 9router usage API
// (x-9r-cli-token = sha256(machine-id + "9r-cli-auth" + cli-secret)[:16],
// same auth the 9router CLI uses) to serve its live quota tracker rows.
// ---------------------------------------------------------------------------
function nineRouterImportPlugin(): Plugin {
  type Row = {
    provider: string
    email?: string
    authType?: string
    isActive?: boolean
    lockUntil?: string | null
    quota?: Array<{ label: string; used: number; limit: number; resetAt?: string }>
  }
  function readRows(): Row[] {
    const dbPath = path.join(os.homedir(), ".9router/db/data.sqlite")
    if (!existsSync(dbPath)) return []
    const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (p: string, o?: { readOnly?: boolean }) => { prepare(sql: string): { all(): unknown[] }; close(): void } }
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const rows = db.prepare("SELECT provider, email, authType, isActive, data FROM providerConnections WHERE isActive=1").all() as Array<{
        provider: string; email: string | null; authType: string | null; isActive: number | string | null; data: string | null
      }>
      return rows.map((r) => {
        let lockUntil: string | null = null
        let quota: Row["quota"]
        try {
          const data = JSON.parse(r.data || "{}") as Record<string, unknown>
          for (const [k, v] of Object.entries(data)) {
            if (!k.startsWith("modelLock_")) continue
            const s = typeof v === "string" ? Date.parse(v) : NaN
            if (Number.isFinite(s) && s > Date.now() && (!lockUntil || s < Date.parse(lockUntil))) lockUntil = String(v)
          }
          // optional usage windows if 9router stores them (e.g. usageHistory-derived)
          const q = data.quota
          if (Array.isArray(q)) quota = q as Row["quota"]
        } catch { /* malformed data cell — import without state */ }
        return {
          provider: r.provider,
          email: r.email || undefined,
          authType: r.authType || undefined,
          isActive: !!r.isActive,
          lockUntil,
          quota,
        }
      })
    } finally {
      db.close()
    }
  }
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const route = req.url?.split("?")[0]
    if (route !== "/api/9router-accounts" && route !== "/api/9router-quota") return next()
    try {
      if (route === "/api/9router-quota") {
        // Live quota tracker: derive the 9router CLI token (same sha256 of
        // machine-id + salt + cli-secret the CLI sends) and pull per-connection
        // usage. Secrets stay in ~/.9router — the app never sees them.
        const { createHash } = require("node:crypto") as typeof import("node:crypto")
        const read = (p: string) => readFileSync(p, "utf8").trim()
        const token = createHash("sha256")
          .update(read(path.join(os.homedir(), ".9router/machine-id")) + "9r-cli-auth" + read(path.join(os.homedir(), ".9router/auth/cli-secret")))
          .digest("hex")
          .slice(0, 16)
        const headers = { "x-9r-cli-token": token }
        const base = "http://127.0.0.1:20128"
        const getJson = (u: string) => fetch(u, { headers }).then((r) => r.json())
        const connsRes = (await getJson(`${base}/api/providers`)) as {
          data?: { connections?: Array<{ id: string; provider?: string; email?: string; name?: string }> }
          connections?: Array<{ id: string; provider?: string; email?: string; name?: string }>
        }
        const conns = connsRes.data?.connections ?? connsRes.connections ?? []
        const rows: Array<{ id: string; provider?: string; email?: string; name?: string; plan?: string; quotas: Record<string, unknown> }> = []
        for (const c of conns) {
          const u = (await getJson(`${base}/api/usage/${c.id}`)) as { plan?: string; quotas?: Record<string, unknown> }
          rows.push({ id: c.id, provider: c.provider, email: c.email, name: c.name, plan: u.plan, quotas: u.quotas ?? {} })
        }
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
        res.end(JSON.stringify({ rows }))
        return
      }
      const rows = readRows()
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
      res.end(JSON.stringify({ rows }))
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: `9router quota/import failed: ${(e as Error).message}` }))
    }
  }
  return {
    name: "9router-account-import",
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxy(), ttsPlugin(), renderPlugin(), nineRouterImportPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})