import path from "node:path"
import http from "node:http"
import https from "node:https"
import os from "node:os"
import fs from "node:fs/promises"
import { createReadStream } from "node:fs"
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxy(), ttsPlugin(), renderPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})