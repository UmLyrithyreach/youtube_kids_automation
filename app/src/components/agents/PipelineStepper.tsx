import { useLayoutEffect, useRef } from "react"
import { Check, Clapperboard, FileText, Sparkles, Wand2 } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { gsap } from "gsap"
import type { Stage } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: "vision", label: "Vision", detail: "Visual Bible", icon: Sparkles },
  { id: "script", label: "Script", detail: "Write script.md", icon: FileText },
  { id: "image", label: "360° Model", detail: "Turnaround Sheet", icon: Wand2 },
  { id: "done", label: "Ready", detail: "Character Pack", icon: Clapperboard },
] as const

type StepId = (typeof STEPS)[number]["id"]
type StepState = "upcoming" | "active" | "complete" | "error"

const stageIndex: Record<Stage, number> = {
  idle: 1,
  vision: 0,
  fanout: 1,
  script: 1,
  image: 2,
  audio: 2,
  qc: 2,
  assembly: 3,
  done: 3,
  error: 0,
}

function pipelineStepState(stage: Stage, step: StepId): StepState {
  const index = STEPS.findIndex(({ id }) => id === step)
  if (stage === "error") return index === 0 ? "error" : "upcoming"
  const current = stageIndex[stage]
  return index < current ? "complete" : index === current ? "active" : "upcoming"
}

export function PipelineStepper({ stage }: { stage: Stage }) {
  const shouldReduceMotion = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!root.current || shouldReduceMotion) return
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-pipeline-step]",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.07, ease: "power2.out", overwrite: "auto" }
      )
    }, root)
    return () => context.revert()
  }, [stage, shouldReduceMotion])

  return (
    <div ref={root} className="flex w-full items-center justify-between gap-1 sm:gap-2 py-2" aria-label={`Pipeline status: ${stage}`}>
      {STEPS.map((step, index) => {
        const state = pipelineStepState(stage, step.id)
        const Icon = step.icon
        const complete = state === "complete"
        const active = state === "active"
        return (
          <div key={step.id} data-pipeline-step className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {index > 0 && (
              <div className="absolute right-1/2 top-4 h-px w-full overflow-hidden bg-foreground/10" aria-hidden="true">
                <motion.div
                  className="h-full origin-left bg-violet-500"
                  initial={false}
                  animate={{ scaleX: complete || active ? 1 : 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: "easeOut" }}
                />
              </div>
            )}
            <motion.div
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border text-xs shadow-xs transition-colors",
                complete && "border-emerald-400/60 bg-emerald-500 text-white",
                active && "border-violet-400 bg-violet-500 text-white",
                state === "error" && "border-destructive/60 bg-destructive text-white",
                state === "upcoming" && "border-foreground/10 bg-background/70 text-muted-foreground"
              )}
              animate={
                active && !shouldReduceMotion
                  ? {
                      scale: [1, 1.08, 1],
                      boxShadow: [
                        "0 0 0 0 rgba(139,92,246,0)",
                        "0 0 0 8px rgba(139,92,246,.16)",
                        "0 0 0 0 rgba(139,92,246,0)",
                      ],
                    }
                  : { scale: 1 }
              }
              transition={active ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            >
              {complete ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-3.5" />}
            </motion.div>
            <motion.div layout className="mt-2 min-w-0">
              <p
                className={cn(
                  "truncate text-[11px] font-semibold",
                  active && "text-violet-700 dark:text-violet-300",
                  complete && "text-emerald-700 dark:text-emerald-300",
                  state === "error" && "text-destructive"
                )}
              >
                {step.label}
              </p>
              <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{step.detail}</p>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
