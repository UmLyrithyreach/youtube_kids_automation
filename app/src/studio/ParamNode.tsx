// Generic param node: header (dot + title) + textarea input + handles.
// All four kinds share this. Textarea edits write straight through
// useReactFlow so autosave sees them.

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { StatusDot } from "./StatusDot"
import type { StudioNodeData } from "./nodeTypes"

export function ParamNode({ id, data, selected }: NodeProps) {
  const d = data as StudioNodeData
  const { setNodes } = useReactFlow()
  const isSource = d.kind !== "download"
  const editable = d.kind === "prompt" || d.kind === "asset"

  const setPrompt = (value: string) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...d, prompt: value, status: undefined } } : n)),
    )
  }

  return (
    <div
      className="nodrag nopan"
      style={{
        width: 200,
        background: selected ? "#262626" : "#1a1a1a",
        border: `1px solid ${selected ? "#E56A4A" : "#404040"}`,
        borderRadius: 10,
        padding: 10,
        fontSize: 12,
        color: "#fafafa",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#E56A4A" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <StatusDot status={d.status} />
        <strong style={{ fontSize: 12 }}>{d.label}</strong>
      </div>
      {editable ? (
        <textarea
          value={(d.prompt as string) ?? ""}
          placeholder={d.kind === "prompt" ? "Prompt text…" : "File path or URL…"}
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            background: "#0a0a0a",
            color: "#fafafa",
            border: "1px solid #404040",
            borderRadius: 6,
            padding: 6,
            fontSize: 12,
          }}
          onChange={(e) => setPrompt(e.target.value)}
        />
      ) : (
        d.status === "done" && (
          <div style={{ color: "#a3a3a3", marginTop: 4, wordBreak: "break-all" }}>output ready</div>
        )
      )}
      {isSource && <Handle type="source" position={Position.Right} style={{ background: "#E56A4A" }} />}
    </div>
  )
}