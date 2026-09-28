// 9router shared-component parity primitives (Badge / Toggle / ProviderIcon /
// provider palette + status thresholds) — copied from 9router
// src/shared/components/* and src/app/globals.css so youtubekids renders the
// same visual language as the 9router dashboard at localhost:20128.

import { useState } from "react"
import { cn } from "@/lib/utils"

// ---- 9router Badge (variant colors verbatim from shared/components/Badge.js) ----
const badgeVariants = {
  default: "bg-9r-surface-2 text-9r-muted",
  primary: "bg-9r-brand/10 text-9r-brand-300 dark:text-9r-brand",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
}
const badgeSizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
}
const badgeDot = {
  default: "bg-gray-500",
  primary: "bg-9r-brand",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
}
export type BadgeVariant = keyof typeof badgeVariants

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}: {
  children?: React.ReactNode
  variant?: BadgeVariant
  size?: keyof typeof badgeSizes
  dot?: boolean
  icon?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", badgeDot[variant])} />}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {children}
    </span>
  )
}

// ---- 9router Toggle (sizes/track/thumb verbatim from shared/components/Toggle.js) ----
const toggleSizes = {
  sm: { track: "w-8 h-4", thumb: "size-3", translate: "translate-x-4" },
  md: { track: "w-11 h-6", thumb: "size-5", translate: "translate-x-5" },
  lg: { track: "w-14 h-7", thumb: "size-6", translate: "translate-x-7" },
}
export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  title,
  className,
}: {
  checked?: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
  size?: keyof typeof toggleSizes
  title?: string
  className?: string
}) {
  const s = toggleSizes[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-9r-brand/30",
        checked ? "bg-9r-brand" : "bg-9r-surface-3",
        s.track,
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none mt-0.5 inline-block rounded-full bg-white shadow-sm transition duration-200 ease-in-out",
          checked ? s.translate : "translate-x-0.5",
          s.thumb,
        )}
      />
    </button>
  )
}

// ---- 9router ProviderIcon (public/providers/<id>.png with text fallback) ----
const missing = new Set<string>()
export function ProviderIcon({
  providerId,
  alt,
  size = 32,
  className,
  fallbackText,
  fallbackColor,
}: {
  providerId?: string
  alt?: string
  size?: number
  className?: string
  fallbackText?: string
  fallbackColor?: string
}) {
  const [errored, setErrored] = useState(false)
  if (!providerId || errored || missing.has(providerId)) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded-lg font-bold", className)}
        style={{
          width: size,
          height: size,
          color: fallbackColor,
          fontSize: Math.max(10, Math.floor(size * 0.38)),
        }}
      >
        {fallbackText || providerId?.slice(0, 2).toUpperCase() || "?"}
      </span>
    )
  }
  return (
    <img
      src={`/providers/${providerId}.png`}
      alt={alt || providerId}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      loading="lazy"
      decoding="async"
      onError={() => {
        missing.add(providerId)
        setErrored(true)
      }}
    />
  )
}

// ---- Material Symbols icon (9router icon system) ----
export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)} aria-hidden="true">
      {name}
    </span>
  )
}

// ---- provider icon slug: family label -> public/providers/<slug>.png ----
export function providerSlug(family: string): string | undefined {
  const p = family.toLowerCase()
  const map: [string, string][] = [
    ["antigravity", "antigravity"],
    ["google", "gemini"],
    ["gemini", "gemini"],
    ["anthropic", "claude"],
    ["claude", "claude"],
    ["openrouter", "openrouter"],
    ["openai", "openai"],
    ["codex", "codex"],
    ["kiro", "kiro"],
    ["qoder", "qoder"],
    ["copilot", "copilot"],
    ["iflow", "iflow"],
    ["qwen", "qwen"],
    ["glm", "glm"],
    ["windsurf", "windsurf"],
    ["trae", "trae"],
    ["cursor", "cursor"],
  ]
  for (const [needle, slug] of map) if (p.includes(needle)) return slug
  return undefined
}

// ---- Status filter (9router providers/utils STATUS_FILTER_OPTIONS) ----
export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "none", label: "No connection" },
] as const
export type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number]["value"]

export function statusFilterOptions(): Record<StatusFilterValue, string> {
  return Object.fromEntries(STATUS_FILTER_OPTIONS.map((o) => [o.value, o.label])) as Record<StatusFilterValue, string>
}

export function matchesStatusFilter(enabled: boolean, hasError: boolean, filter: StatusFilterValue): boolean {
  if (filter === "all") return true
  const status = hasError ? "inactive" : enabled ? "active" : "inactive"
  return status === filter || (filter === "none" && false)
}

// ---- 9router provider brand colors (ProviderLimitCard.getProviderColor) ----
export const PROVIDER_COLORS: Record<string, string> = {
  github: "#000000",
  antigravity: "#4285F4",
  codex: "#10A37F",
  openai: "#10A37F",
  google: "#4285F4",
  gemini: "#4285F4",
  kiro: "#FF9900",
  qoder: "#EC4899",
  claude: "#D97757",
  anthropic: "#D97757",
  openrouter: "#8B5CF6",
  "9router": "#E56A4A",
  ollama: "#E56A4A",
}
export function providerColor(provider?: string): string {
  const p = provider?.toLowerCase() || ""
  if (PROVIDER_COLORS[p]) return PROVIDER_COLORS[p]
  for (const key of Object.keys(PROVIDER_COLORS)) {
    if (p.includes(key)) return PROVIDER_COLORS[key]
  }
  return "#6B7280"
}

// ---- 9router quota status thresholds (QuotaProgressBar.getColorClasses) ----
export function quotaStatus(pct: number) {
  if (pct > 70)
    return { emoji: "🟢", text: "text-green-500", bar: "bg-green-500", track: "bg-green-500/10" }
  if (pct >= 30)
    return { emoji: "🟡", text: "text-yellow-500", bar: "bg-yellow-500", track: "bg-yellow-500/10" }
  return { emoji: "🔴", text: "text-red-500", bar: "bg-red-500", track: "bg-red-500/10" }
}

// ---- 9router plan badge variants (ProviderLimitCard.planVariants) ----
export function planVariant(plan?: string): BadgeVariant {
  const p = plan?.toLowerCase()
  if (p === "pro" || p === "plus") return "primary"
  if (p === "ultra") return "success"
  if (p === "enterprise") return "info"
  return "default"
}