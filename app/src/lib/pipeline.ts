import { useCallback, useState } from "react"
import { loadConfigs, saveConfigs, AGENTS, type AgentConfig, type AgentId } from "./agents"
import { probeAgent, runScript, runVideo, runTts, runVision, extractFileText } from "./byok"

export type Stage = "idle" | "vision" | "script" | "video" | "tts" | "done" | "error"

export interface MonitorFinding {
  agent: string
  ok: boolean
  detail: string
}

export interface Deliverable {
  script: string
  videoUrl: string
  audioUrl: string
}

export function useStudio() {
  const [configs, setConfigs] = useState(() => loadConfigs())
  const [stage, setStage] = useState<Stage>("idle")
  const [stageError, setStageError] = useState<string | null>(null)
  const [script, setScript] = useState("")
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null)
  const [findings, setFindings] = useState<MonitorFinding[] | null>(null)
  const [probing, setProbing] = useState(false)

  const saveConfig = useCallback((id: AgentId, c: AgentConfig) => {
    setConfigs((prev) => {
      const next = { ...prev, [id]: c }
      saveConfigs(next)
      return next
    })
  }, [])

  const runMonitors = useCallback(async () => {
    setProbing(true)
    const results: MonitorFinding[] = []
    for (const a of AGENTS) {
      const c = configs[a.id]
      // Monitor probes all three agents; for itself just config-check via probeAgent too.
      if (a.capability === "monitor") {
        const self = await probeAgent(a.capability, c)
        results.push({ agent: a.name, ok: !!c, detail: self ?? "ready" })
        continue
      }
      const mismatch = await probeAgent(a.capability, c)
      results.push({ agent: a.name, ok: mismatch === null, detail: mismatch ?? "capability matches, endpoint reachable" })
    }
    setFindings(results)
    setProbing(false)
  }, [configs])

  // Full movie pipeline: attachments -> vision context -> script -> video -> TTS -> deliverable
  const makeMovie = useCallback(
    async (idea: string, attachments: File[] = []) => {
      setDeliverable(null)
      setStageError(null)
      try {
        const { script: cs, video: cv, tts: ct, vision: cvis } = configs
        if (!cs || !cv || !ct) throw new Error("Configure Script, Video and TTS agents first (gear icon on each card)")

        // Vision pre-step: the Vision agent explains attached images/files for the other agents.
        let context = ""
        if (attachments.length > 0 && cvis) {
          setStage("vision")
          context = await runVision(cvis, attachments, idea)
        } else if (attachments.length > 0 && !cvis) {
          // No vision agent configured — extract text locally so texty files still count.
          const parts: string[] = []
          for (const f of attachments) {
            const t = await extractFileText(f)
            if (t) parts.push(`--- ${f.name} ---\n${t}`)
          }
          context = parts.join("\n\n")
        }

        setStage("script")
        const prompt = context
          ? `${idea}\n\nContext from user's attached files/images (described by the Vision agent):\n${context.slice(0, 4000)}`
          : idea
        const s = await runScript(cs, `Write a short, kid-friendly YouTube movie script (max 300 words) about: ${prompt}`)
        setScript(s)

        setStage("video")
        const v = await runVideo(cv, s.slice(0, 2000))

        setStage("tts")
        const a = await runTts(ct, s)

        setDeliverable({ script: s, videoUrl: v, audioUrl: a })
        setStage("done")
      } catch (e) {
        setStageError((e as Error).message)
        setStage("error")
      }
    },
    [configs]
  )

  const reset = () => {
    setStage("idle")
    setStageError(null)
    setDeliverable(null)
    setScript("")
  }

  return { configs, saveConfig, stage, stageError, script, deliverable, findings, probing, runMonitors, makeMovie, reset }
}