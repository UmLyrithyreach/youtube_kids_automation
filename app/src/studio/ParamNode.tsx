// Generic param node: header (dot + title) + textarea input + handles.
// All four kinds share this. Textarea edits write straight through
// useReactFlow so autosave sees them.
// Skin: TobyFlow zinc card + indigo selected ring + rounded handles.

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
        background: "var(--bg-secondary)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        color: "var(--text-primary)",
        boxShadow: selected ? "0 0 0 1px var(--accent)" : "none",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "var(--accent)", border: "none" }} />
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
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 5,
            padding: 6,
            fontSize: 12,
            fontFamily: "inherit",
          }}
          className="focus:outline-none"
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          onChange={(e) => setPrompt(e.target.value)}
        />
      ) : (
        d.status === "done" && (
          <div style={{ color: "var(--text-secondary)", marginTop: 4, wordBreak: "break-all" }}>output ready</div>
        )
      )}
      {isSource && <Handle type="source" position={Position.Right} style={{ background: "var(--accent)", border: "none" }} />}
    </div>
  )
}