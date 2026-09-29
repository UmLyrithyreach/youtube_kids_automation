export type NodeKind = "prompt" | "generate" | "asset" | "download"

export interface StudioNodeData extends Record<string, unknown> {
  kind: NodeKind
  label: string
  prompt?: string
  /** Live run status, set by job events; cleared on edit. */
  status?: "pending" | "running" | "done" | "failed"
}

export const NODE_KINDS: { kind: NodeKind; label: string; color: string; desc: string }[] = [
  { kind: "prompt", label: "Prompt", color: "#E56A4A", desc: "Text the graph starts from" },
  { kind: "generate", label: "Generate", color: "#22c55e", desc: "Run the producer step" },
  { kind: "asset", label: "Asset", color: "#3b82f6", desc: "External file or URL input" },
  { kind: "download", label: "Download", color: "#eab308", desc: "Sink — saves the result" },
]