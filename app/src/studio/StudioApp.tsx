// StudioApp — the whole app IS the node canvas (ComfyUI-style).
// Skin = TobyFlow workflow editor (visual language only, no upstream code):
// near-black canvas #0e0e0e, chrome #151515, lime #c6f24e accent, green run
// circle, amber upgrade pill, white Create, blue edge line, left icon rail.
// Top bar: title + lime autosave toggle. Right: stats + Upgrade + Create.
// Left rail: add / select / history / docs / duplicate / RUN / undo / redo.
// Bottom: zoom pill + Recent + blue progress edge line. Old hub bypassed.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
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

/* Inline stroke icons (16px, currentColor) — TobyFlow rail language. */
const I = {
  cursor: <path d="M4 2l8 11 1.5-4.5L18 7 4 2z" fill="currentColor" stroke="none" />,
  clock: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5.5V9l2.5 2" /></>,
  doc: <><path d="M4 2.5h7l4 4V15.5H4z" /><path d="M11 2.5v4h4" /><path d="M6 9h6M6 11.5h6" /></>,
  copy: <><rect x="2.5" y="2.5" width="9" height="9" rx="1.5" /><rect x="6.5" y="6.5" width="9" height="9" rx="1.5" /></>,
  undo: <path d="M4 8h7a4 4 0 010 8H7M4 8l3-3M4 8l3 3" />,
  redo: <path d="M15 8H8a4 4 0 000 8h4M15 8l-3-3M15 8l-3 3" />,
  zoom: <><circle cx="8" cy="8" r="5" /><path d="M12 12l4 4" /></>,
  fit: <path d="M2 6V2h4M12 2h4v4M16 12v4h-4M6 16H2v-4" />,
  grid: <><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="10" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="2.5" y="10" width="5.5" height="5.5" rx="1" /><rect x="10" y="10" width="5.5" height="5.5" rx="1" /></>,
  gear: <><circle cx="9" cy="9" r="2.5" /><path d="M9 2v2.2M9 13.8V16M2 9h2.2M13.8 9H16M4 4l1.6 1.6M12.4 12.4L14 14M14 4l-1.6 1.6M5.6 12.4L4 14" /></>,
  play: <path d="M6.5 4.5L14 9l-7.5 4.5V4.5z" fill="currentColor" stroke="none" />,
  plus: <path d="M9 4v10M4 9h10" />,
  close: <path d="M4 4l10 10M14 4L4 14" />,
  bolt: <path d="M10 2L4 10h4l-1 6 6-8h-4l1-6z" fill="currentColor" stroke="none" />,
  node: <><circle cx="4" cy="9" r="2" /><circle cx="14" cy="4" r="2" /><circle cx="14" cy="14" r="2" /><path d="M6 8.2l6-3.4M6 9.8l6 3.4" /></>,
  crown: <path d="M3 13l-1-8 4.5 3L9 3l2.5 5L16 5l-1 8H3z" />,
  hist: <><circle cx="9" cy="9" r="6.5" /><path d="M9 5.5V9l2.5 2" /></>,
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export default function StudioApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [name, setName] = useState("Untitled workflow")
  const [net, setNet] = useState<"idle" | "saving" | "saved" | "offline">("idle")
  const [runLog, setRunLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [auto, setAuto] = useState(true)
  const [tool, setTool] = useState<"cursor" | "history" | "docs" | "dup" | "zoom" | "grid" | "gear">("cursor")
  const [jobsCount, setJobsCount] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef<string | null>(null)
  idRef.current = workflowId
  const nodesRef = useRef<FlowNode[]>([])
  nodesRef.current = nodes
  const doneCount = useRef(0)
  const busyRef = useRef(false)
  busyRef.current = busy
  const rf = useReactFlow()

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
      setNodes((ns: FlowNode[]) => [...ns, makeNode(kind, 160 + Math.random() * 280, 110 + Math.random() * 220)]),
    [setNodes],
  )

  // ---- Autosave (debounced, respects the lime toggle) ----------------------

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
    if (!workflowId || !auto) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void save(), 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name, workflowId, auto])

  // ---- Workflow lifecycle ---------------------------------------------------

  const loadWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER}/api/workflows`)
      if (!res.ok) return setNet("offline")
      const all = (await res.json()) as { id: string; name: string }[]
      if (all.length === 0) {
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
    // Title matches the reference format; date local to the user.
    const res = await fetch(`${SERVER}/api/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `New Workflow - ${new Date().toLocaleDateString("en-GB").replace(/\//g, "/")}`,
        graph: { nodes: [], links: [] },
      }),
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

  // ---- Queue + live progress ------------------------------------------------

  const run = useCallback(async () => {
    if (!workflowId) return
    if (auto) await save() // flush pending edits before enqueueing
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
    setJobsCount((c) => c + 1)
    toast("info", "Job queued")
  }, [workflowId, save, toast, auto])

  useEffect(() => {
    const ws = new WebSocket(`${SERVER.replace(/^http/, "ws")}/ws`)
    ws.onopen = () =>
      void fetch(`${SERVER}/api/jobs?limit=1`)
        .then((r) => r.json())
        .then((js) => {
          // Progress line resumes for a job that's already running.
          const j = (js as { id: string; status: string; nodeState: Record<string, string> }[])[0]
          if (j?.status === "running") {
            setBusy(true)
            setProgress(0)
            doneCount.current = Object.values(j.nodeState ?? {}).filter((s) => s === "done" || s === "failed").length
          }
        })
        .catch(() => {})
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
          setProgress(0)
          doneCount.current = 0
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
          setProgress(100)
          setTimeout(() => setProgress(null), 1200)
          toast("success", "Graph finished")
        } else if (e.type === "job_failed") {
          line = `✗ job failed: ${e.error ?? ""}`
          setBusy(false)
          setProgress(null)
          toast("error", `Job failed: ${e.error ?? ""}`)
        }
        if (
          (e.type === "node_done" || e.type === "node_failed") &&
          busyRef.current &&
          e.nodeId &&
          nodesRef.current.some((n) => n.id === e.nodeId)
        ) {
          doneCount.current += 1
          setProgress(Math.round((doneCount.current / Math.max(nodesRef.current.length, 1)) * 100))
        }
        setRunLog((l) => [...l, line].slice(-100))
      } catch {
        // malformed event — ignore
      }
    }
    return () => ws.close()
  }, [setNodes, toast])

  const netDot =
    net === "offline" ? "var(--error)" : net === "saved" ? "var(--run)" : net === "saving" ? "var(--upgrade)" : "var(--text-muted)"
  const netLabel = net === "offline" ? "offline" : net === "saved" ? "saved" : net === "saving" ? "saving…" : "idle"

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "var(--bg-canvas)", color: "var(--text-primary)" }}>
      {/* ---- Top bar: title + toggle | runs/nodes/Upgrade/Max Speed/Create/X ---- */}
      <header className="flex h-12 shrink-0 items-center gap-2 px-4" style={{ background: "var(--bg-chrome)", borderBottom: "1px solid var(--border)" }}>
        <input className="tfy-title-input" value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} />
        <button
          type="button"
          className={`tfy-switch ${auto ? "" : "off"}`}
          aria-label="Autosave"
          title={auto ? "Autosave on" : "Autosave off"}
          onClick={() => setAuto((a) => !a)}
        />
        <span className="flex-1" />
        <span className="tfy-pill" title="Jobs queued this session">
          <Icon>{I.bolt}</Icon>
          Runs <b>{jobsCount}/10</b>
        </span>
        <span className="tfy-pill" title="Nodes on canvas">
          <Icon>{I.node}</Icon>
          Nodes <b>{nodes.length}/5</b>
        </span>
        <button type="button" className="tfy-upgrade" title="Placeholder — licensing later">
          <Icon>{I.crown}</Icon>
          Upgrade
        </button>
        <span className="tfy-pill" title="Execution mode (visual only)">
          Max Speed
        </span>
        <button type="button" className="tfy-create" onClick={() => void run()} disabled={!workflowId || busy}>
          {busy ? "Running…" : "Create"}
        </button>
        <button type="button" className="tfy-icon" title="Console" onClick={() => setLogOpen((o) => !o)}>
          <Icon>{I.close}</Icon>
        </button>
      </header>

      {/* ---- Brand row (below header, like reference) ---- */}
      <div className="flex h-9 shrink-0 items-center gap-2 px-4" style={{ background: "var(--bg-chrome)" }}>
        <span className="inline-block size-4 rounded-full" style={{ background: "var(--run)" }} />
        <span className="text-[13px] font-medium">YK Studio</span>
        <span className="tfy-badge">free</span>
        <span title={`Autosave: ${netLabel}`} className="ml-1 inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="inline-block size-1.5 rounded-full" style={{ background: netDot }} />
          {netLabel}
        </span>
        <span className="flex-1" />
        {progress !== null && (
          <div className="mx-2 h-1 w-40 shrink-0 overflow-hidden rounded-full" style={{ background: "var(--bg-raise)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "var(--accent)" }}
            />
          </div>
        )}
        <button type="button" className="tfy-recent" style={{ height: 26 }} onClick={() => setLogOpen((o) => !o)}>
          <Icon>{I.hist}</Icon>
          Console
        </button>
      </div>

      {/* ---- Body: left icon rail + canvas ---- */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left vertical toolbar */}
        <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl p-1.5" style={{ background: "var(--bg-chrome)", border: "1px solid var(--border)" }}>
          <span className="group relative">
            <button type="button" className="tfy-add" onClick={() => void newWorkflow()} title="New workflow">
              <Icon>{I.plus}</Icon>
            </button>
          </span>
          {(
            [
              ["cursor", I.cursor, "Cursor"],
              ["history", I.clock, "History"],
              ["docs", I.doc, "Docs"],
              ["dup", I.copy, "Duplicate graph"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              key={t}
              type="button"
              className={`tfy-icon ${tool === t ? "active" : ""}`}
              title={`${label} (visual)`}
              onClick={() => setTool(t)}
            >
              <Icon>{icon}</Icon>
            </button>
          ))}
          <button type="button" className="tfy-run" title="Run graph" onClick={() => void run()} disabled={!workflowId || busy}>
            <Icon>{I.play}</Icon>
          </button>
          {(
            [
              ["undo", I.undo, "Undo"],
              ["redo", I.redo, "Redo"],
              ["zoom", I.zoom, "Zoom"],
              ["grid", I.grid, "Grid"],
              ["gear", I.gear, "Settings"],
            ] as const
          ).map(([t, icon, label]) => (
            <button
              key={t}
              type="button"
              className={`tfy-icon ${tool === t ? "active" : ""}`}
              title={`${label} (visual)`}
              onClick={() => t === "undo" || t === "redo" ? undefined : setTool(t)}
            >
              <Icon>{icon}</Icon>
            </button>
          ))}
        </div>

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
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#262626" />
          </ReactFlow>

          {/* Bottom-left zoom pill */}
          <div className="tfy-zoom absolute bottom-4 left-3 z-10">
            <Icon>{I.zoom}</Icon>
            <span className="px-1 text-[12px]">{Math.round((rf.getZoom() ?? 1) * 100)}%</span>
            <button type="button" title="Zoom out">−</button>
            <button type="button" title="Zoom in">+</button>
            <button type="button" title="Fit view" onClick={() => rf.fitView()}>
              <Icon>{I.fit}</Icon>
            </button>
          </div>

          {/* Bottom-center Recent pill = open console drawer */}
          <button type="button" className="tfy-recent absolute bottom-4 left-1/2 z-10 -translate-x-1/2" onClick={() => setLogOpen((o) => !o)}>
            <Icon>{I.hist}</Icon>
            Recent
          </button>

          {/* Palette +: add the four node kinds */}
          <button
            type="button"
            className="tfy-add absolute right-4 top-4 z-10"
            title="Add node (alternates Prompt/Generate)"
            onClick={() => addNode(nodes.length % 2 === 0 ? "prompt" : "generate")}
          >
            <Icon>{I.plus}</Icon>
          </button>
        </div>
      </div>

      {/* ---- Bottom edge: blue progress line ---- */}
      <div className="h-0.5 w-full shrink-0" style={{ background: "var(--edge-line)", opacity: busy ? 1 : 0.25 }} />

      {/* ---- Collapse console drawer ---- */}
      {logOpen && (
        <section className="absolute bottom-14 left-1/2 z-20 w-[520px] -translate-x-1/1 p-0" style={{ left: "50%" }}>
          <div className="tfy-zoom h-[140px] w-full flex-col items-stretch p-2 font-mono text-[11px]" style={{ display: "flex" }}>
            {runLog.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>queue empty — wire nodes, then Create</span>
            ) : (
              runLog.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </section>
      )}

      {/* ---- Toasts (bottom-left slide-up) ---- */}
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