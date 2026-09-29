// Hono API + WebSocket. REST: workflows CRUD, jobs enqueue/list, media list.
// WS /ws: live ProgressEvent fan-out (ComfyUI single-ws concept).

import { Hono } from "hono"
import { serve, type ServerType } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import {
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
  listJobs,
  getJob,
  insertJob,
  onJobEvent,
} from "./db.ts"
import { validatePromptRecord, jobQueue } from "./engine.ts"
import type { WorkflowGraph } from "./types.ts"

const app = new Hono()

// ---- Workflows ----------------------------------------------------------

app.get("/api/workflows", (c) => c.json(listWorkflows()))
app.get("/api/workflows/:id", (c) => {
  const wf = getWorkflow(c.req.param("id"))
  return wf ? c.json(wf) : c.json({ error: "not found" }, 404)
})
app.put("/api/workflows/:id", async (c) => {
  const body = await c.req.json<{ name: string; graph: WorkflowGraph }>()
  const saved = saveWorkflow(body.name, body.graph, c.req.param("id"))
  return c.json(saved)
})
app.post("/api/workflows", async (c) => {
  const body = await c.req.json<{ name: string; graph: WorkflowGraph }>()
  return c.json(saveWorkflow(body.name, body.graph), 201)
})
app.delete("/api/workflows/:id", (c) => {
  deleteWorkflow(c.req.param("id"))
  return c.json({ ok: true })
})

// ---- Jobs ---------------------------------------------------------------

/** Editor graph → API prompt record (ComfyUI two-shape concept). */
export function compile(graph: WorkflowGraph): {
  prompt: Record<string, import("./types.ts").JobNode>
  error?: string
} {
  const prompt: Record<string, import("./types.ts").JobNode> = {}
  for (const node of graph.nodes) {
    prompt[node.id] = { kind: node.kind, params: node.data ?? {}, deps: [] }
  }
  for (const link of graph.links) {
    if (prompt[link.target] && prompt[link.source]) {
      prompt[link.target].deps.push(link.source)
    }
  }
  return { prompt }
}

app.post("/api/jobs", async (c) => {
  const body = await c.req.json<{ workflowId: string }>()
  const wf = getWorkflow(body.workflowId)
  if (!wf) return c.json({ error: "workflow not found" }, 404)
  const { prompt, error } = compile(wf.graph)
  if (error) return c.json({ error }, 400)
  const invalid = validatePromptRecord(prompt)
  if (invalid) return c.json({ error: invalid }, 400)
  const job = insertJob(wf.id, wf.name, prompt)
  jobQueue.enqueue(job.id)
  return c.json(job, 202)
})

app.get("/api/jobs", (c) => c.json(listJobs(Number(c.req.query("limit") ?? 50))))
app.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"))
  return job ? c.json(job) : c.json({ error: "not found" }, 404)
})

// ---- WebSocket ----------------------------------------------------------

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_evt, ws) => {
      // Replay terminal jobs? Not needed: client fetches /api/jobs on connect.
      const off = onJobEvent((e) => ws.send(JSON.stringify(e)))
      // Keep registry clean when the socket closes.
      ;(ws as unknown as { _off?: () => void })._off = off
    },
    onClose: (_evt, ws) => {
      const off = (ws as unknown as { _off?: () => void })._off
      if (off) off()
    },
  })),
)

// ---- Bootstrap ----------------------------------------------------------

export function startServer(port = 8787) {
  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[server] http://localhost:${info.port}`)
  })
  injectWebSocket(server)
  return server
}