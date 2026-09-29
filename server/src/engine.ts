// Execution engine — ComfyUI-pattern readiness-count scheduler, original code.
// Editor graph → API prompt record → run: nodes become ready when all upstream
// deps are done (TopologicalSort blockCount concept). Queue is durable
// (SQLite) — fixes TobyFlow's in-memory queue that died with its service
// worker. MVP runs one node at a time; ponytail: per-job parallelism goes in
// when the runner lands, scheduler contract won't change.

import path from "node:path"
import fs from "node:fs"
import { MEDIA_DIR, emitJobEvent, getJob, updateJob } from "./db.ts"
import type { Job, JobNode, JobStatus, NodeRunState } from "./types.ts"

type Registry = (
  params: Record<string, unknown>,
  deps: string[],
  job: Job,
) => Promise<string | string[]>

/** MVP node implementations. Placeholder generate: real providers arrive
 *  with the runner/HTTP adapters; the scheduler contract stays identical. */
const registry: Record<string, Record<string, Registry>> = {
  prompt: {
    default: async (params, deps, job) => {
      // Merged prompt text: own prompt + upstream prompt outputs.
      const upstream = deps.map((id) => job.outputs[id]?.[0]).filter(Boolean) as string[]
      return [params.prompt ? String(params.prompt) : "", ...upstream].join("\n").trim()
    },
  },
  generate: {
    default: async (_params, deps, job) => {
      // ponytail: fabricates a text artifact from the upstream prompt;
      // replaced by real provider adapters (+runner) without scheduler changes.
      const src = job.outputs[deps[0] ?? ""]?.[0] ?? "(no prompt)"
      const file = path.join(MEDIA_DIR, `${job.id}-generated.txt`)
      await fs.promises.writeFile(file, src, "utf8")
      return file
    },
  },
  asset: {
    default: async (params) => String(params.path ?? ""),
  },
  download: {
    default: async (params, deps, job) => {
      const src = job.outputs[deps[0] ?? ""]?.[0]
      if (!src) throw new Error("download: no upstream output")
      const sub = String(params.dir ?? "default")
      const destDir = path.resolve(MEDIA_DIR, "..", "downloads", sub)
      await fs.promises.mkdir(destDir, { recursive: true })
      const dest = path.join(destDir, path.basename(src))
      await fs.promises.copyFile(src, dest)
      return dest
    },
  },
}

/** Pick the node's implementation; unknown kinds fail validation. */
function resolveImpl(node: JobNode): Registry {
  const kind = registry[node.kind]
  if (!kind) throw new Error(`unknown node kind: ${node.kind}`)
  const impl = kind[String(node.params.impl ?? "default")]
  if (!impl)
    throw new Error(`unknown impl for node kind ${node.kind}: ${String(node.params.impl)}`)
  return impl
}

export function validatePromptRecord(record: Record<string, JobNode>): string | null {
  for (const [id, node] of Object.entries(record)) {
    const kind = registry[node.kind]
    if (!kind) return `node ${id}: unknown kind ${node.kind}`
    const impl = kind[String(node.params.impl ?? "default")]
    if (!impl)
      return `node ${id}: unknown impl ${String(node.params.impl ?? "default")} for ${node.kind}`
  }
  return null
}

// ---- Job queue (SQLite-backed, FIFO, sequential) -------------------------

class JobQueue {
  private running = false
  private order: string[] = []

  enqueue(jobId: string) {
    this.order.push(jobId)
    void this.drain()
  }

  private async drain() {
    if (this.running) return
    this.running = true
    try {
      while (this.order.length > 0) await runJob(this.order.shift()!)
    } finally {
      this.running = false
    }
  }
}

export const jobQueue = new JobQueue()

// ---- Readiness-count execution (one job) --------------------------------

async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId)
  if (!job) return
  if (job.status === "cancelled") return

  // ComfyUI TopologicalSort concept: blockCount = unfinished upstream deps;
  // decremented as nodes complete; node enters `ready` at zero.
  const blockCount: Record<string, number> = {}
  const blocking: Record<string, string[]> = {}
  for (const [id, node] of Object.entries(job.promptRecord)) {
    blockCount[id] = node.deps.filter((d) => job.nodeState[d] !== "done").length
    for (const d of new Set(node.deps)) (blocking[d] ??= []).push(id)
  }

  if (Object.keys(job.promptRecord).length === 0) {
    updateJob(job.id, { status: "completed" })
    emitJobEvent({ type: "job_done", jobId: job.id })
    return
  }

  const nodeState: Record<string, NodeRunState> = { ...job.nodeState }
  const outputs: Record<string, string[]> = { ...job.outputs }

  updateJob(job.id, { status: "running" })
  emitJobEvent({ type: "job_started", jobId: job.id })

  const ready = Object.keys(blockCount).filter((id) => blockCount[id] === 0)
  let failure: { node: string; error: string } | null = null

  while (ready.length > 0 && !failure) {
    const id = ready.shift()!
    nodeState[id] = "running"
    updateJob(job.id, { nodeState: { ...nodeState } })
    emitJobEvent({ type: "node_started", jobId: job.id, nodeId: id })

    const node = job.promptRecord[id]
    try {
      const result = await resolveImpl(node)(node.params, node.deps, {
        ...job,
        nodeState,
        outputs,
      })
      outputs[id] = Array.isArray(result) ? result : [result]
      nodeState[id] = "done"
      emitJobEvent({ type: "node_done", jobId: job.id, nodeId: id, outputs: outputs[id] })
      for (const down of blocking[id] ?? []) {
        blockCount[down]--
        if (blockCount[down] === 0) ready.push(down)
      }
    } catch (err) {
      failure = { node: id, error: err instanceof Error ? err.message : String(err) }
      nodeState[id] = "failed"
      emitJobEvent({ type: "node_failed", jobId: job.id, nodeId: id, error: failure.error })
    }
  }

  // Stranded nodes (cycle or unreachable) must not report success.
  if (!failure) {
    const stranded = Object.keys(nodeState).find(
      (id) => nodeState[id] !== "done" && nodeState[id] !== "failed",
    )
    if (stranded) failure = { node: stranded, error: "cycle or unreachable dependency" }
  }

  const status: JobStatus = failure ? "failed" : "completed"
  const patch: Parameters<typeof updateJob>[1] = { nodeState, outputs, status }
  if (failure) patch.error = `node ${failure.node}: ${failure.error}`
  updateJob(job.id, patch)
  emitJobEvent(
    failure
      ? { type: "job_failed", jobId: job.id, error: patch.error ?? "failed" }
      : { type: "job_done", jobId: job.id },
  )
}