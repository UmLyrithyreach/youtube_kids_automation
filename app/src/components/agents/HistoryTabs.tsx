// Apple-grade History & Production Reel
// Combines card gallery, compact list, character model previews, inline rename, and clean Apple alert modals.
import { useState, useRef, useEffect, useMemo } from "react"
import {
  Clapperboard,
  Play,
  Pencil,
  Trash2,
  MoreVertical,
  Check,
  Copy,
  ArrowUpRight,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  LayoutGrid,
  List,
  Film,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import type { Session, Stage } from "@/lib/pipeline"

interface HistoryTabsProps {
  sessions: Session[]
  activeId: string | null
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "Recently"
  const diff = Math.max(0, Date.now() - timestamp)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function getStageBadge(stage: Stage) {
  switch (stage) {
    case "done":
      return {
        label: "Ready",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
        dotClassName: "bg-emerald-500",
        spin: false,
      }
    case "vision":
      return {
        label: "Analyzing Vision",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
        dotClassName: "bg-amber-500",
        spin: true,
      }
    case "script":
      return {
        label: "Writing Script",
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
        dotClassName: "bg-indigo-500",
        spin: true,
      }
    case "image":
      return {
        label: "360° Modeling",
        className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
        dotClassName: "bg-violet-500",
        spin: true,
      }
    case "error":
      return {
        label: "Failed",
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
        dotClassName: "bg-rose-500",
        spin: false,
      }
    default:
      return {
        label: "Queued",
        className: "bg-muted/40 text-muted-foreground border-border/50",
        dotClassName: "bg-muted-foreground/60",
        spin: false,
      }
  }
}

export function HistoryTabs({
  sessions,
  activeId,
  onOpen,
  onRename,
  onRemove,
}: HistoryTabsProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [search, setSearch] = useState("")
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q) ||
        (s.characterName && s.characterName.toLowerCase().includes(q))
    )
  }, [sessions, search])

  // Close menus on outside click
  useEffect(() => {
    if (!menuId) return
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-history-menu]")) {
        setMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuId])

  // Focus rename input on open
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const startRename = (s: Session) => {
    setDraftName(s.name)
    setRenamingId(s.id)
    setMenuId(null)
  }

  const commitRename = (id: string) => {
    const trimmed = draftName.trim()
    if (trimmed) {
      onRename(id, trimmed)
    }
    setRenamingId(null)
  }

  const copyPrompt = (s: Session) => {
    navigator.clipboard.writeText(s.prompt).catch(() => {})
    setCopiedId(s.id)
    setMenuId(null)
    setTimeout(() => setCopiedId(null), 1800)
  }

  if (sessions.length === 0) return null

  return (
    <section className="w-full space-y-3.5">
      {/* ---------------- Section Header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Film className="size-3.5" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Productions</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sessions.length}
          </span>
        </div>

        {/* View Switcher & Search */}
        <div className="flex items-center gap-2">
          {sessions.length > 2 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-28 rounded-full border border-border/60 bg-background/60 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 backdrop-blur-sm transition-all focus:w-40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 sm:w-36"
              />
            </div>
          )}

          {/* Apple Segmented View Toggle */}
          <div className="flex items-center rounded-full border border-border/70 bg-muted/40 p-0.5 shadow-xs backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-all",
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "flex size-6 items-center justify-center rounded-full transition-all",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- Content Display ---------------- */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((s) => {
            const isActive = s.id === activeId
            const isRunning = s.stage !== "done" && s.stage !== "error"
            const badge = getStageBadge(s.stage)
            const sheetUrl = s.deliverable?.characterSheetUrl || s.characterSheetUrl

            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card/75 p-3 shadow-xs backdrop-blur-md transition-all duration-200",
                  "hover:border-border hover:shadow-md hover:bg-card",
                  isActive && "ring-2 ring-primary/40 border-primary/40 bg-card"
                )}
              >
                {/* Visual Thumbnail Slate */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onOpen(s.id)
                  }}
                  className="relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl border border-black/[0.04] bg-muted/40 dark:border-white/[0.06]"
                >
                  {sheetUrl ? (
                    <img
                      src={sheetUrl}
                      alt={s.characterName ?? s.name}
                      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  ) : isRunning ? (
                    <div className="relative flex size-full flex-col items-center justify-center gap-1.5 overflow-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 text-center">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span className="text-[11px] font-medium text-foreground/80">{badge.label}…</span>
                    </div>
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-muted/60 to-muted/20 text-muted-foreground/60">
                      <Clapperboard className="size-6 stroke-[1.5]" />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                        Scene Reel
                      </span>
                    </div>
                  )}

                  {/* Top-left Stage Pill */}
                  <div className="absolute left-2 top-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md shadow-xs",
                        badge.className
                      )}
                    >
                      {badge.spin ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : (
                        <span className={cn("size-1.5 rounded-full", badge.dotClassName)} />
                      )}
                      {badge.label}
                    </span>
                  </div>

                  {/* Top-right Actions Trigger */}
                  <div className="absolute right-1.5 top-1.5" data-history-menu>
                    <button
                      type="button"
                      aria-label="Options"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuId(menuId === s.id ? null : s.id)
                      }}
                      className="flex size-7 items-center justify-center rounded-full border border-black/[0.06] bg-background/80 text-foreground/80 opacity-90 shadow-xs backdrop-blur-md transition-all hover:bg-background hover:text-foreground group-hover:opacity-100 dark:border-white/[0.08]"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>
                  </div>

                  {/* Hover Play/Open Overlay Button */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-105">
                      <Play className="ml-0.5 size-4 fill-current" />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="mt-2.5 flex flex-1 flex-col justify-between">
                  <div>
                    {renamingId === s.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={renameInputRef}
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(s.id)
                            if (e.key === "Escape") setRenamingId(null)
                          }}
                          onBlur={() => commitRename(s.id)}
                          className="w-full rounded-md border border-primary/50 bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none shadow-xs"
                          aria-label="Session title"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(s.id)}
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                        >
                          <Check className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1.5">
                        <h3
                          onClick={() => onOpen(s.id)}
                          className="cursor-pointer truncate text-xs font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                          title={s.name}
                        >
                          {s.name}
                        </h3>
                        {s.characterName && (
                          <span className="shrink-0 rounded-full bg-primary/8 px-1.5 py-0.2 text-[9px] font-medium text-primary">
                            ✦ {s.characterName}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {s.prompt}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{formatTimeAgo(s.createdAt)}</span>
                      {sheetUrl && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-foreground/70">
                            <Sparkles className="size-2.5 text-amber-500" /> 360° Model
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpen(s.id)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-accent hover:text-primary"
                    >
                      <span>Studio</span>
                      <ArrowUpRight className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Context Menu Dropdown */}
                <AnimatePresence>
                  {menuId === s.id && (
                    <motion.div
                      data-history-menu
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                      className="absolute right-3 top-12 z-40 w-44 rounded-xl border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(s.id)
                          setMenuId(null)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        <Play className="size-3.5 text-primary" /> Open in Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(s)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        <Pencil className="size-3.5" /> Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => copyPrompt(s)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        {copiedId === s.id ? (
                          <>
                            <Check className="size-3.5 text-emerald-500" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" /> Copy Prompt
                          </>
                        )}
                      </button>
                      <div className="my-1 border-t border-border/60" />
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRemoveId(s.id)
                          setMenuId(null)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* ---------------- Compact Apple List View ---------------- */
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-xs backdrop-blur-md divide-y divide-border/50">
          {filteredSessions.map((s) => {
            const isActive = s.id === activeId
            const isRunning = s.stage !== "done" && s.stage !== "error"
            const badge = getStageBadge(s.stage)
            const sheetUrl = s.deliverable?.characterSheetUrl || s.characterSheetUrl

            return (
              <div
                key={s.id}
                className={cn(
                  "group relative flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/50",
                  isActive && "bg-accent/40"
                )}
              >
                {/* Thumbnail + Details */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onOpen(s.id)
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted">
                    {sheetUrl ? (
                      <img src={sheetUrl} alt={s.name} className="size-full object-cover" />
                    ) : isRunning ? (
                      <div className="flex size-full items-center justify-center bg-indigo-500/10">
                        <Loader2 className="size-4 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Clapperboard className="size-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {renamingId === s.id ? (
                      <input
                        ref={renameInputRef}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(s.id)
                          if (e.key === "Escape") setRenamingId(null)
                        }}
                        onBlur={() => commitRename(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-48 rounded border border-primary/50 bg-background px-1.5 py-0.5 text-xs font-semibold outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">{s.name}</span>
                        {s.characterName && (
                          <span className="hidden shrink-0 rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-medium text-primary sm:inline">
                            {s.characterName}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="truncate text-[11px] text-muted-foreground">{s.prompt}</p>
                  </div>
                </div>

                {/* Right metadata & actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={cn(
                      "hidden sm:flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      badge.className
                    )}
                  >
                    {badge.spin ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <span className={cn("size-1.5 rounded-full", badge.dotClassName)} />
                    )}
                    {badge.label}
                  </span>

                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(s.createdAt)}</span>

                  {/* Actions */}
                  <div className="relative" data-history-menu>
                    <button
                      type="button"
                      aria-label="Options"
                      onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <MoreVertical className="size-3.5" />
                    </button>

                    <AnimatePresence>
                      {menuId === s.id && (
                        <motion.div
                          data-history-menu
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                          className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onOpen(s.id)
                              setMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <Play className="size-3.5 text-primary" /> Open in Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => startRename(s)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <Pencil className="size-3.5" /> Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => copyPrompt(s)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          >
                            {copiedId === s.id ? (
                              <>
                                <Check className="size-3.5 text-emerald-500" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" /> Copy Prompt
                              </>
                            )}
                          </button>
                          <div className="my-1 border-t border-border/60" />
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmRemoveId(s.id)
                              setMenuId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------------- Apple Alert Dialog for Deletion ---------------- */}
      <AnimatePresence>
        {confirmRemoveId && (
          <motion.div
            key="confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmRemoveId(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-5 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Delete Production?</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                “{sessions.find((s) => s.id === confirmRemoveId)?.name ?? "This production"}” and all
                its generated script scenes and 360° character model sheets will be permanently removed.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemoveId(null)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(confirmRemoveId)
                    setConfirmRemoveId(null)
                  }}
                  className="rounded-full bg-destructive px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-opacity hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// Apple Dynamic Capsule Indicator for Background Agents
export function RunningBanner({
  sessions,
  onOpen,
}: {
  sessions: Session[]
  onOpen?: (id: string) => void
}) {
  const runningSessions = sessions.filter((s) => s.stage !== "done" && s.stage !== "error")
  if (runningSessions.length === 0) return null

  const active = runningSessions[0]

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        onClick={() => onOpen?.(active.id)}
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -6 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
        className="group relative flex items-center gap-2 rounded-full border border-indigo-500/20 bg-background/85 px-3 py-1 text-xs font-medium text-foreground/90 shadow-xs backdrop-blur-xl transition-all hover:border-indigo-500/40 hover:bg-background"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-indigo-500" />
        </span>
        <span className="flex items-center gap-1 text-[11px] font-medium">
          <Loader2 className="size-3 animate-spin text-indigo-500" />
          <span>
            {runningSessions.length === 1
              ? `Production in progress: ${active.name}`
              : `${runningSessions.length} productions synthesizing`}
          </span>
        </span>
        <ArrowUpRight className="size-3 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </motion.button>
    </AnimatePresence>
  )
}
