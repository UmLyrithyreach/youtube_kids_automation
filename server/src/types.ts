// Shared node-graph types. Original design: ComfyUI-pattern (editor doc +
// readiness-count scheduling) re-implemented for a TypeScript platform.
// Concepts inspired by TobyFlow's workflow/queue UX; no proprietary code.

export type NodeKind = "generate" | "asset" | "prompt" | "download"

export interface WorkflowNodeData {
  label: string
  prompt?: string
  model?: string
  [key: string]: unknown
}

export interface WorkflowNode {
  id: string
  kind: NodeKind
  position: { x: number; y: number }
  data: WorkflowNodeData
  /** Set on execution artifacts only: upstream node id + output slot. */
  input?: { node: string; slot: number } | null
}

export interface WorkflowLink {
  id: string
  source: string
  sourceSlot?: number
  target: string
  targetSlot?: number
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  links: WorkflowLink[]
}

/** Persisted workflow document (editor format, ComfyUI pattern). */
export interface WorkflowRecord {
  id: string
  name: string
  graph: WorkflowGraph
  created_at: number
  updated_at: number
}

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

/** One runnable unit: the API-style flat prompt (ComfyUI pattern). */
export interface Job {
  id: string
  workflowId: string
  workflowName: string
  promptRecord: Record<string, JobNode>
  status: JobStatus
  nodeState: Record<string, NodeRunState>
  outputs: Record<string, string[]>
  error?: string
  created_at: number
  updated_at: number
}

export interface JobNode {
  kind: NodeKind
  params: Record<string, unknown>
  deps: string[] // upstream node ids this node consumes
}

export type NodeRunState = "pending" | "ready" | "running" | "done" | "failed"

export type ProgressEvent =
  | { type: "job_queued"; job: Job }
  | { type: "job_started"; jobId: string }
  | { type: "node_started"; jobId: string; nodeId: string }
  | { type: "node_done"; jobId: string; nodeId: string; outputs: string[] }
  | { type: "node_failed"; jobId: string; nodeId: string; error: string }
  | { type: "job_done"; jobId: string }
  | { type: "job_failed"; jobId: string; error: string }