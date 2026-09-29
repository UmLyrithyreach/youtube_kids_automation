// StudioApp — the whole app IS the node canvas (ComfyUI-style).
// Top bar: workflow name + queue/new. Left: node palette. Center: canvas.
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = workflowId

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
  }, [setNodes, setEdges])

  const newWorkflow = useCallback(async () => {
    const res = await fetch(`${SERVER}/api/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Untitled workflow", graph: { nodes: [], links: [] } }),
    })
    if (!res.ok) return setNet("offline")
    const wf = (await res.json()) as { id: string; name: string }
    setWorkflowId(wf.id)
    setName(wf.name)
    setNodes([])
    setEdges([])
    setNet("saved")
  }, [setNodes, setEdges])

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
      setRunLog((l) => [...l, `✗ queue rejected: ${detail.error ?? res.status}`])
      return
    }
    const job = (await res.json()) as { id: string }
    setRunLog((l) => [...l, `▸ queued ${job.id}`])
  }, [workflowId, save])

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
        } else if (e.type === "job_failed") {
          line = `✗ job failed: ${e.error ?? ""}`
          setBusy(false)
        }
        setRunLog((l) => [...l, line].slice(-100))
      } catch {
        // malformed event — ignore
      }
    }
    return () => ws.close()
  }, [setNodes])

  const netColor =
    net === "offline" ? "#ef4444" : net === "saved" ? "#22c55e" : net === "saving" ? "#eab308" : "#6b7280"

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "#111113", color: "#f5f5f5" }}>
      {/* ---- Top bar (ComfyUI command bar) ---- */}
      <header
        className="flex h-11 shrink-0 items-center gap-2 px-3"
        style={{ borderBottom: "1px solid #2a2a2e", background: "#151517" }}
      >
        <div
          className="flex size-6 items-center justify-center rounded-md text-[10px] font-black"
          style={{ background: "#E56A4A", color: "#111" }}
        >
          YK
        </div>
        <span className="mr-2 text-sm font-semibold tracking-tight">YK Studio</span>
        <input
          className="w-56 rounded-md border px-2 py-1 text-xs outline-none focus:border-[#E56A4A]"
          style={{ borderColor: "#2a2a2e", background: "#1c1c1f", color: "#f5f5f5" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void newWorkflow()}
          className="rounded-md border px-2 py-1 text-xs hover:bg-white/5"
          style={{ borderColor: "#2a2a2e", background: "#1c1c1f" }}
        >
          + New
        </button>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: netColor }}>
          <span className="inline-block size-1.5 rounded-full" style={{ background: netColor }} />
          {net}
        </span>
        <button
          type="button"
          onClick={() => void queue()}
          disabled={!workflowId || busy}
          className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-40"
          style={{ background: "#E56A4A", color: "#111" }}
        >
          {busy ? "Running…" : "▶ Queue Graph"}
        </button>
      </header>

      {/* ---- Body: palette + canvas ---- */}
      <div className="flex min-h-0 flex-1">
        {paletteOpen && (
          <aside
            className="flex w-52 shrink-0 flex-col gap-1 overflow-auto p-2"
            style={{ borderRight: "1px solid #2a2a2e", background: "#151517" }}
          >
            <div className="px-1 pb-1 pt-2 text-[10px] font-bold tracking-widest opacity-50">NODE LIBRARY</div>
            {NODE_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => addNode(k.kind)}
                className="rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                style={{ borderColor: "#2a2a2e", background: "#1c1c1f" }}
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span className="inline-block size-2 rounded-sm" style={{ background: k.color }} />
                  {k.label}
                </span>
                <span className="mt-0.5 block text-[10px] opacity-50">{k.desc}</span>
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
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#3a3a40" />
            <Controls
              showInteractive={false}
              style={{ background: "#1c1c1f", borderColor: "#2a2a2e", borderRadius: 8, overflow: "hidden" }}
            />
          </ReactFlow>
          <button
            type="button"
            onClick={() => setPaletteOpen((p) => !p)}
            className="absolute left-2 top-2 z-10 rounded-md border px-2 py-1 text-[10px] hover:bg-white/5"
            style={{ borderColor: "#2a2a2e", background: "#1c1c1f85", color: "#f5f5f5" }}
          >
            {paletteOpen ? "◀ hide" : "▶ nodes"}
          </button>
        </div>
      </div>

      {/* ---- Run log (bottom drawer) ---- */}
      <section
        className="shrink-0 transition-all"
        style={{ height: logOpen ? 132 : 26, borderTop: "1px solid #2a2a2e", background: "#151517" }}
      >
        <button
          type="button"
          onClick={() => setLogOpen((o) => !o)}
          className="flex h-[26px] w-full items-center gap-2 px-3 text-[10px] font-bold tracking-widest opacity-60 hover:opacity-100"
        >
          RUN LOG <span className="flex-1" /> {logOpen ? "▼" : "▲"}
        </button>
        {logOpen && (
          <div className="h-[104px] overflow-auto px-3 pb-2 font-mono text-[11px] leading-5 opacity-90">
            {runLog.length === 0 ? (
              <span className="opacity-40">queue empty — wire nodes, then Queue Graph</span>
            ) : (
              runLog.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        )}
      </section>
    </div>
  )
}