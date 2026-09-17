import path from "node:path"
import http from "node:http"
import https from "node:https"
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
  plugins: [react(), tailwindcss(), corsProxy(), ttsPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})