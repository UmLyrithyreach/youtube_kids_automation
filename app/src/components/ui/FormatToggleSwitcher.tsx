import { Monitor, Smartphone } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface Props {
  value: "16:9" | "9:16"
  onChange: (val: "16:9" | "9:16") => void
  className?: string
}

export function FormatToggleSwitcher({ value, onChange, className }: Props) {
  const is16x9 = value === "16:9"

  return (
    <div
      className={cn(
        "relative flex items-center rounded-2xl p-1 border border-border/80 bg-muted/40 backdrop-blur-md shadow-xs select-none",
        className
      )}
    >
      {/* 16:9 Long-Form Button */}
      <button
        type="button"
        onClick={() => onChange("16:9")}
        className={cn(
          "relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors z-10",
          is16x9 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Monitor className="size-3.5 text-indigo-500" />
        <span>16:9 Long-Form</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-medium">
          90s-180s
        </span>
        {is16x9 && (
          <motion.div
            layoutId="format-pill"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 -z-10 rounded-xl bg-card border border-border shadow-xs"
          />
        )}
      </button>

      {/* 9:16 Shorts Button */}
      <button
        type="button"
        onClick={() => onChange("9:16")}
        className={cn(
          "relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors z-10",
          !is16x9 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Smartphone className="size-3.5 text-rose-500" />
        <span>9:16 Shorts</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-medium">
          20s-30s
        </span>
        {!is16x9 && (
          <motion.div
            layoutId="format-pill"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 -z-10 rounded-xl bg-card border border-border shadow-xs"
          />
        )}
      </button>
    </div>
  )
}
