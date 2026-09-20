import { Bot, Wand2 } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { ProductionMode } from "@/lib/mode"

interface Props {
  value: ProductionMode
  onChange: (val: ProductionMode) => void
  className?: string
}

export function ModeToggleSwitcher({ value, onChange, className }: Props) {
  const isAuto = value === "auto"

  return (
    <div
      className={cn(
        "relative flex items-center rounded-2xl p-1 border border-border/80 bg-muted/40 backdrop-blur-md shadow-xs select-none",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange("auto")}
        aria-pressed={isAuto}
        className={cn(
          "relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors z-10",
          isAuto ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Wand2 className="size-3.5 text-indigo-500" />
        <span>Full Automation</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-medium">
          auto-render
        </span>
        {isAuto && (
          <motion.div
            layoutId="mode-pill"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 -z-10 rounded-xl bg-card border border-border shadow-xs"
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => onChange("manual")}
        aria-pressed={!isAuto}
        className={cn(
          "relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors z-10",
          !isAuto ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Bot className="size-3.5 text-amber-500" />
        <span>Manual Video Scripting</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-medium">
          you render
        </span>
        {!isAuto && (
          <motion.div
            layoutId="mode-pill"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 -z-10 rounded-xl bg-card border border-border shadow-xs"
          />
        )}
      </button>
    </div>
  )
}