const COLORS: Record<string, string> = {
  pending: "#6b7280",
  running: "#3b82f6",
  done: "#22c55e",
  failed: "#ef4444",
}

export function StatusDot({ status }: { status?: string }) {
  if (!status) return null
  return (
    <span
      title={status}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: COLORS[status] ?? "#6b7280",
        flexShrink: 0,
      }}
    />
  )
}