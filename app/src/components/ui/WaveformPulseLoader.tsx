import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface Props {
  text?: string
  subtext?: string
  className?: string
  barCount?: number
}

export function WaveformPulseLoader({
  text = "Synthesizing audio stems with sidechain ducking...",
  subtext = "Subagent D: edge-tts parallel execution",
  className,
  barCount = 7,
}: Props) {
  const bars = Array.from({ length: barCount })

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-border/80 bg-muted/30 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center gap-1 h-7">
        {bars.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              height: ["6px", "26px", "10px", "22px", "6px"],
            }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.12,
            }}
            className="w-1.5 rounded-full bg-gradient-to-t from-indigo-500 to-sky-400"
          />
        ))}
      </div>
      {text && <p className="text-xs font-semibold text-foreground text-center">{text}</p>}
      {subtext && <p className="text-[10px] text-muted-foreground text-center font-mono">{subtext}</p>}
    </div>
  )
}
