// StudioApp — the whole app IS the node canvas (ComfyUI-style).
// TobyFlow v2 visual language: zinc surfaces, indigo accent, gradient CTA,
// pill controls, version badge, toasts. Canvas stays ComfyUI.
// Top bar: brand + workflow name + Generate. Left: node palette. Center: canvas.
// Bottom: run log. Old hub tabs are bypassed entirely.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./tobyflow.css"
import { ParamNode } from "./ParamNode"
import { NODE_KINDS, type NodeKind, type StudioNodeData } from "./nodeTypes"

const SERVER = import.meta.env.VITE_API_URL ?? "http://localhost:8787"

const nodeTypes = { param: ParamNode }

type FlowNode = { id: string; type: "param"; position: { x: number; y: number }; data: StudioNodeData }

function makeNode(kind: NodeKind, x: number, y: number, prompt = ""): FlowNode {
  return {
    id: `n_${Math.random().toString(36).slice(2, 10)}`,
    type: "param",
    position: { x, y },
    data: { kind, label: NODE_KINDS.find((k) => k.kind === kind)?.label ?? kind, prompt },
  }
}

type Toast = { id: number; type: "success" | "error" | "info"; message: string }

export default function StudioApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [name, setName] = useState("Untitled workflow")
  const [net, setNet] = useState<"idle" | "saving" | "saved" | "offline">("idle")
  const [runLog, setRunLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [logOpen, setLogOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = workflowId

  const toast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds: Edge[]) => addEdge({ ...c, id: `e_${c.source}_${c.target}` } as Edge, eds)),
    [setEdges],
  )

  const addNode = useCallback(
    (kind: NodeKind) =>
      setNodes((ns: FlowNode[]) => [...ns, makeNode(kind, 140 + Math.random() * 260, 90 + Math.random() * 200)]),
    [setNodes],
  )

  // ---- Autosave (debounced) ----------------------------------------------

  const save = useCallback(async () => {
    const id = idRef.current
    if (!id) return
    setNet("saving")
    try {
      const res = await fetch(`${SERVER}/api/workflows/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          graph: { nodes, links: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) },
        }),
      })
      setNet(res.ok ? "saved" : "offline")
    } catch {
      setNet("offline")
    }
  }, [name, nodes, edges])

  useEffect(() => {
    if (!workflowId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void save(), 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name, workflowId])

  // ---- Workflow lifecycle --------------------------------------------------

  const loadWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/api/workflows`)
      if (!res.ok) return setNet("offline")
      const all = (await res.json()) as { id: string; name: string }[]
      if (all.length === 0) {
        // Blank canvas — user wires their own graph.
        setNodes([]), setEdges([]), setNet("saved")
        return
      }
      const full = await fetch(`${SERVER}/api/workflows/${all[0].id}`)
      if (!full.ok) return setNet("offline")
      const rec = (await full.json()) as {
        id: string
        name: string
        graph: { nodes: FlowNode[]; links: { id: string; source: string; target: string }[] }
      }
      setWorkflowId(rec.id)
      setName(rec.name)
      setNodes(rec.graph.nodes)
      setEdges(rec.graph.links.map((l) => ({ id: l.id, source: l.source, target: l.target }) as Edge))
      setNet("saved")
    } catch {
      setNet("offline")
    }
  }, [setNodes, setEdges])

  const newWorkflow = useCallback(async () => {
    const res = await fetch(`${SERVER}/api/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Untitled workflow", graph: { nodes: [], links: [] } }),
    })
    if (!res.ok) return toast("error", "Could not create workflow")
    const wf = (await res.json()) as { id: string; name: string }
    setWorkflowId(wf.id)
    setName(wf.name)
    setNodes([])
    setEdges([])
    setNet("saved")
    toast("success", "New workflow created")
  }, [setNodes, setEdges, toast])

  useEffect(() => {
    void loadWorkflow()
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Queue + live progress ----------------------------------------------

  const queue = useCallback(async () => {
    if (!workflowId) return
    await save() // flush pending edits before enqueueing
    const res = await fetch(`${SERVER}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId }),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}) as { error?: string })
      const msg = `Queue rejected: ${detail.error ?? res.status}`
      toast("error", msg)
      setRunLog((l) => [...l, `✗ ${msg}`])
      return
    }
    const job = (await res.json()) as { id: string }
    setRunLog((l) => [...l, `▸ queued ${job.id}`])
    toast("info", "Job queued")
  }, [workflowId, save, toast])

  useEffect(() => {
    const ws = new WebSocket(`${SERVER.replace(/^http/, "ws")}/ws`)
    ws.onmessage = (evt) => {
      try {
        const e = JSON.parse(evt.data) as {
          type: string
          jobId?: string
          nodeId?: string
          error?: string
        }
        const mark = (nodeId: string, status: StudioNodeData["status"]) =>
          setNodes((ns: FlowNode[]) =>
            ns.map((n: FlowNode) => (n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)),
          )
        let line: string = e.type
        if (e.type === "job_started") {
          line = `▶ job ${e.jobId}`
          setBusy(true)
          toast("info", "Running graph…")
        } else if (e.type === "node_started") {
          line = `  ▸ ${e.nodeId}`
          if (e.nodeId) mark(e.nodeId, "running")
        } else if (e.type === "node_done") {
          line = `  ✓ ${e.nodeId}`
          if (e.nodeId) mark(e.nodeId, "done")
        } else if (e.type === "node_failed") {
          line = `  ✗ ${e.nodeId}: ${e.error ?? ""}`
          if (e.nodeId) mark(e.nodeId, "failed")
        } else if (e.type === "job_done") {
          line = `● done ${e.jobId}`
          setBusy(false)
          toast("success", "Graph finished")
        } else if (e.type === "job_failed") {
          line = `✗ job failed: ${e.error ?? ""}`
          setBusy(false)
          toast("error", `Job failed: ${e.error ?? ""}`)
        }
        setRunLog((l) => [...l, line].slice(-100))
      } catch {
        // malformed event — ignore
      }
    }
    return () => ws.close()
  }, [setNodes, toast])

  const netColor =
    net === "offline"
      ? "var(--error)"
      : net === "saved"
        ? "var(--success)"
        : net === "saving"
          ? "var(--warning)"
          : "var(--text-muted)"

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ---- Top bar (TobyFlow header + CTA) ---- */}
      <header className="flex h-11 shrink-0 items-center gap-2 px-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <h1 className="tfy-title">YK Studio</h1>
        <span className="tfy-badge">v0.1.0</span>
        <span className="flex-1" />
        <input className="tfy-input w-56" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="tfy-btn" onClick={() => void newWorkflow()}>
          + New
        </button>
        <span className="flex items-center gap-1.5 px-1 text-[11px]" style={{ color: netColor }}>
          <span className="inline-block size-1.5 rounded-full" style={{ background: netColor }} />
          {net}
        </span>
        <button
          type="button"
          className="tfy-btn-accent"
          onClick={() => void queue()}
          disabled={!workflowId || busy}
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      </header>

      {/* ---- Body: palette + canvas ---- */}
      <div className="flex min-h-0 flex-1">
        {paletteOpen && (
          <aside
            className="flex w-52 shrink-0 flex-col gap-1.5 overflow-auto p-2.5"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <div className="tfy-label px-1 pb-1 pt-2">Node Library</div>
            {NODE_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => addNode(k.kind)}
                className="tfy-card rounded-lg px-2.5 py-2 text-left transition-opacity hover:opacity-90"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span className="inline-block size-2 rounded-sm" style={{ background: k.color }} />
                  {k.label}
                </span>
                <span className="mt-0.5 block text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {k.desc}
                </span>
              </button>
            ))}
          </aside>
        )}

        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#323238" />
            <Controls
              showInteractive={false}
              style={{ background: "var(--bg-secondary)", borderRadius: 8, overflow: "hidden" }}
            />
          </ReactFlow>
          <button
            type="button"
            className="tfy-btn absolute left-2 top-2 z-10"
            onClick={() => setPaletteOpen((p) => !p)}
          >
            {paletteOpen ? "◀ hide" : "▶ nodes"}
          </button>
        </div>
      </div>

      {/* ---- Run log (bottom drawer, console style) ---- */}
      <section className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => setLogOpen((o) => !o)}
          className="flex h-[28px] w-full items-center gap-2 px-3.5"
        >
          <span className="tfy-label">Console</span>
          <span className="flex-1" />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {logOpen ? "▼" : "▲"}
          </span>
        </button>
        {logOpen && (
          <div
            className="h-[100px] overflow-auto px-3.5 pb-2 font-mono text-[11px] leading-5"
            style={{ color: "var(--text-secondary)" }}
          >
            {runLog.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>queue empty — wire nodes, then Generate</span>
            ) : (
              runLog.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        )}
      </section>

      {/* ---- Toasts (TobyFlow bottom-left slide-up) ---- */}
      <div className="tfy-toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`tfy-toast tfy-toast-${t.type}`}
            role="alert"
            onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}