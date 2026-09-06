import path from "node:path"
import http from "node:http"
import https from "node:https"
import react from "@vitejs/plugin-react"
import { defineConfig, type Connect, type Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"

// CORS bypass for BYOK endpoints: the browser calls /cors-proxy/* with an
// x-target-url header; this plugin forwards the request server-side (where
// CORS doesn't apply) and relays the response back.
function corsProxy(): Plugin {
  return {
    name: "cors-proxy",
    configureServer(server) {
      server.middlewares.use("/cors-proxy", ((req, res) => {
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
      }) as Connect.NextHandleFunction)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxy()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})