import React from "react"
import { motion, type HTMLMotionProps } from "motion/react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props extends HTMLMotionProps<"button"> {
  children: React.ReactNode
  icon?: React.ReactNode
  variant?: "primary" | "accent" | "outline"
  loading?: boolean
}

export function ShinyButton({
  children,
  icon,
  variant = "primary",
  loading = false,
  className,
  disabled,
  ...props
}: Props) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-xs font-semibold shadow-md transition-all select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variant === "primary" &&
          "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-indigo-500/25",
        variant === "accent" &&
          "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-amber-500/25",
        variant === "outline" &&
          "border border-border bg-card/80 text-foreground hover:bg-accent",
        className
      )}
      {...props}
    >
      {/* Moving shine reflection animation */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-full top-0 block -rotate-45 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-1000 group-hover:left-full"
      />

      {loading ? (
        <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon ? (
        icon
      ) : (
        <Sparkles className="size-3.5 text-white/80" />
      )}

      <span>{children}</span>
    </motion.button>
  )
}
