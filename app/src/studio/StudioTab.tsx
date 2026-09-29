// Node-graph studio tab — ComfyUI-pattern canvas over @xyflow/react.
// MVP loop: new workflow → wire Prompt→Generate→Download → Run → live job
// progress over WS → status dots on nodes + run log.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
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

function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="px-2 py-1 rounded-md border text-xs"
      style={{ borderColor: "#404040", background: "#262626", color: "#fafafa" }}
    />
  )
}

export default function StudioTab() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [name, setName] = useState("Untitled workflow")
  const [net, setNet] = useState<"idle" | "saving" | "saved" | "offline">("idle")
  const [runLog, setRunLog] = useState<string[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = workflowId

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds: Edge[]) => addEdge({ ...c, id: `e_${c.source}_${c.target}` } as Edge, eds)),
    [setEdges],
  )

  const addNode = useCallback(
    (kind: NodeKind) => setNodes((ns: FlowNode[]) => [...ns, makeNode(kind, 60 + Math.random() * 220, 40 + Math.random() * 180)]),
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

  const newWorkflow = useCallback(async () => {
    // Flagship starter: Prompt → Generate → Download, chained.
    const p = makeNode("prompt", 40, 120, "Kids episode script")
    const g = makeNode("generate", 320, 120)
    const d = makeNode("download", 600, 120)
    const res = await fetch(`${SERVER}/api/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Kids episode",
        graph: {
          nodes: [p, g, d],
          links: [
            { id: "l1", source: p.id, target: g.id },
            { id: "l2", source: g.id, target: d.id },
          ],
        },
      }),
    })
    if (!res.ok) {
      setNet("offline")
      return
    }
    const wf = (await res.json()) as { id: string; name: string }
    setWorkflowId(wf.id)
    setName(wf.name)
    setNodes([p, g, d])
    setEdges([
      { id: "l1", source: p.id, target: g.id } as Edge,
      { id: "l2", source: g.id, target: d.id } as Edge,
    ])
    setNet("saved")
  }, [setNodes, setEdges])

  const loadWorkflow = useCallback(async () => {
    const res = await fetch(`${SERVER}/api/workflows`)
    if (!res.ok) return setNet("offline")
    const all = (await res.json()) as { id: string; name: string }[]
    if (all.length === 0) return void newWorkflow()
    const wf = all[0]
    const full = await fetch(`${SERVER}/api/workflows/${wf.id}`)
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
  }, [newWorkflow, setNodes, setEdges])

  useEffect(() => {
    void loadWorkflow()
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Run + live progress -------------------------------------------------

  const run = useCallback(async () => {
    if (!workflowId) return
    await save() // flush pending edits before enqueueing
    const res = await fetch(`${SERVER}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId }),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}) as { error?: string })
      setRunLog((l) => [...l, `run failed: ${detail.error ?? res.status}`])
      return
    }
    const job = (await res.json()) as { id: string }
    setRunLog((l) => [...l, `queued ${job.id}`])
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
        if (e.type === "node_started") line = `▸ ${e.nodeId}`
        else if (e.type === "node_done") {
          line = `✓ ${e.nodeId}`
          if (e.nodeId) mark(e.nodeId, "done")
        } else if (e.type === "node_failed") {
          line = `✗ ${e.nodeId}: ${e.error ?? ""}`
          if (e.nodeId) mark(e.nodeId, "failed")
        } else if (e.type === "job_started") line = `job started ${e.jobId}`
        else if (e.type === "job_done") line = `job done ${e.jobId}`
        else if (e.type === "job_failed") line = `job failed: ${e.error ?? ""}`
        setRunLog((l) => [...l, line].slice(-50))
      } catch {
        // malformed event — ignore
      }
    }
    return () => ws.close()
  }, [setNodes])

  const hasDots = nodes.length > 0

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "#404040", background: "#1a1a1a", color: "#fafafa" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {NODE_KINDS.map((k) => (
          <ToolbarButton key={k.kind} onClick={() => addNode(k.kind)}>
            + {k.label}
          </ToolbarButton>
        ))}
        <span className="flex-1" />
        <span className="text-xs opacity-60">{net}</span>
        <ToolbarButton onClick={() => void run()} disabled={!workflowId}>
          ▶ Run
        </ToolbarButton>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border" style={{ borderColor: "#404040" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#333" />
        </ReactFlow>
      </div>
      {hasDots && (
        <div
          className="max-h-40 shrink-0 overflow-auto rounded-lg border p-2 font-mono text-xs opacity-80"
          style={{ borderColor: "#404040", background: "#111" }}
        >
          {runLog.length === 0 ? <span className="opacity-40">run log empty</span> : runLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}