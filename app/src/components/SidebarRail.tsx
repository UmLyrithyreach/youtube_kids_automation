import { useState } from "react"
import { Music2, SquarePlay, Sparkles, MessageSquare, KeyRound, Gauge, ChevronsRight, ChevronsLeft } from "lucide-react"
import { cn } from "@/lib/utils"

// 9router-style left sidebar — persistent across all pages, expandable.
// Collapsed = icon rail (w-16); expanded = icon + label (w-56). Chat and
// Providers are the two new destinations; studio tabs keep their behavior.

const items = [
  { id: "song", label: "Song & Video", icon: Music2, accent: "text-indigo-500" },
  { id: "character", label: "Characters", icon: Sparkles, accent: "text-amber-500" },
  { id: "youtube", label: "Publish", icon: SquarePlay, accent: "text-red-500" },
  { id: "chat", label: "Copilot", icon: MessageSquare, accent: "text-emerald-500" },
  { id: "accounts", label: "Providers", icon: KeyRound, accent: "text-sky-500" },
  { id: "quota", label: "Quota Tracker", icon: Gauge, accent: "text-orange-500" },
] as const

export type RailTab = (typeof items)[number]["id"]

export function SidebarRail({
  active,
  onSelect,
  onStudioTab,
}: {
  active: string
  onSelect: (id: RailTab) => void
  onStudioTab: (id: "song" | "character" | "youtube") => void
}) {
  const [expanded, setExpanded] = useState(() => localStorage.getItem("yk-rail-expanded") === "1")
  const toggle = () =>
    setExpanded((e) => {
      localStorage.setItem("yk-rail-expanded", e ? "0" : "1")
      return !e
    })

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#d2d5de] bg-[#f5f6fa]/95 py-3 backdrop-blur transition-[width] duration-200 dark:border-[#23252e] dark:bg-[#0d0e12]/95",
        expanded ? "w-56 items-stretch px-3" : "w-16 items-center px-2"
      )}
    >
      {/* Logo row + expand toggle */}
      <div className={cn("mb-3 flex items-center", expanded ? "justify-between px-1" : "justify-center")}>
        <button
          type="button"
          onClick={() => onStudioTab("song")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow"
          aria-label="Studio home"
        >
          <Music2 className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
        </button>
      </div>

      {items.map(({ id, label, icon: Icon, accent }) => (
        <button
          key={id}
          type="button"
          onClick={() => (id === "song" || id === "character" || id === "youtube" ? onStudioTab(id) : onSelect(id))}
          className={cn(
            "group flex w-full items-center rounded-xl transition-colors",
            expanded ? "gap-2.5 px-3 py-2 text-xs font-medium" : "flex-col gap-0.5 py-2 text-[9px] font-medium",
            active === id
              ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
          )}
        >
          <Icon className={cn("size-4.5 shrink-0", active === id ? accent : "opacity-70 group-hover:opacity-100")} />
          <span className={cn(expanded ? "truncate" : "max-w-full truncate px-1")}>{label}</span>
        </button>
      ))}

      <div className={cn("mt-auto text-[8px] text-zinc-400 dark:text-zinc-600", expanded ? "px-3 text-left" : "text-center")}>
        {expanded ? "Kids Studio v0.4" : "v0.4"}
      </div>
    </aside>
  )
}