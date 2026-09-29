export type NodeKind = "prompt" | "generate" | "asset" | "download"

export interface StudioNodeData extends Record<string, unknown> {
  kind: NodeKind
  label: string
  prompt?: string
  /** Live run status, set by job events; cleared on edit. */
  status?: "pending" | "running" | "done" | "failed"
}

export const NODE_KINDS: { kind: NodeKind; label: string }[] = [
  { kind: "prompt", label: "Prompt" },
  { kind: "generate", label: "Generate" },
  { kind: "asset", label: "Asset" },
  { kind: "download", label: "Download" },
]