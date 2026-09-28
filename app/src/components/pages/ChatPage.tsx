import { useEffect, useRef, useState } from "react"
import { runScript } from "@/lib/byok"
import { loadAccounts, ACCOUNTS_CHANGED, getLastUsedLabel } from "@/lib/accounts"
import { loadConfigs } from "@/lib/agents"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Chat copilot page — 9router-style text-first UX: user talks, AI answers in
// plain text; generation happens ONLY on explicit command. The send button
// switches to a green "Generate" action when the message matches a trigger.
// Routed through the script agent's config (chat completions); image
// generation from here goes through the account pool (runImage).

interface Msg {
  role: "user" | "assistant"
  content: string
  kind?: "chat" | "image"
  imageUrl?: string
  account?: string
}

const GEN_TRIGGER = /\b(gen(?:erate)?|draw|render|make|create)\b.*\b(image|picture|art|sheet|scene|keyframe|poster)\b|\bimage of\b/i
// "generate an image of …" / "draw the character sheet" / "render scene 2" etc.

export function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! Tell me what you want to make — I'll help you shape the idea first. When you're ready, say \"generate an image of …\" and I'll route it to the first account with free image quota.",
    },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [poolCount, setPoolCount] = useState(0)
  const [isGen, setIsGen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => setPoolCount(loadAccounts().filter((a) => a.enabled).length)
    refresh()
    window.addEventListener(ACCOUNTS_CHANGED, refresh)
    return () => window.removeEventListener(ACCOUNTS_CHANGED, refresh)
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [msgs, busy])

  const onChange = (v: string) => {
    setInput(v)
    setIsGen(GEN_TRIGGER.test(v))
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    setIsGen(false)

    // Explicit generate command → image generation via the account pool.
    if (GEN_TRIGGER.test(text)) {
      setMsgs((m) => [...m, { role: "user", content: text }])
      setBusy(true)
      try {
        const configs = loadConfigs()
        const base = Object.values(configs).find((c) => c?.imagePath || c?.model) ?? null
        const { runImage } = await import("@/lib/byok")
        const url = await runImage(
          base ?? { baseUrl: "", apiKey: "", model: "", models: [] },
          text.replace(/^.*?\b(image of|image|draw|render)\b/i, "").trim() || text
        )
        setMsgs((m) => [...m, { role: "assistant", content: `Generated via ${getLastUsedLabel() || "account pool"}.`, kind: "image", imageUrl: url, account: getLastUsedLabel() }])
      } catch (e) {
        setMsgs((m) => [...m, { role: "assistant", content: `Image generation failed: ${(e as Error).message}` }])
      } finally {
        setBusy(false)
      }
      return
    }

    // Everything else: plain text conversation (script agent's model).
    setMsgs((m) => [...m, { role: "user", content: text }])
    setBusy(true)
    try {
      const configs = loadConfigs()
      const cs = configs["script"] ?? Object.values(configs).find((c) => c?.model) ?? null
      if (!cs) {
        setMsgs((m) => [...m, { role: "assistant", content: "No script agent configured yet — set one in Agents (Song & Video Studio), or add an account in Providers and I'll use it." }])
        return
      }
      const reply = await runScript(cs, text)
      setMsgs((m) => [...m, { role: "assistant", content: reply }])
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Failed: ${(e as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Copilot</h2>
        <span className="text-xs text-zinc-500">
          {poolCount > 0 ? `${poolCount} account${poolCount > 1 ? "s" : ""} in pool · rotation on` : "no pool accounts — uses agent config"}
        </span>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "border border-[#2f313a] bg-[#14151a] text-zinc-200"
              )}
            >
              {m.content}
              {m.kind === "image" && m.imageUrl && (
                <img src={m.imageUrl} alt="generated" className="mt-2 max-w-full rounded-xl border border-[#2f313a]" />
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[#2f313a] bg-[#14151a] px-4 py-2.5 text-sm text-zinc-500">
              {isGen ? "Generating…" : "Thinking…"}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-[#2f313a] bg-[#14151a] p-2">
        <textarea
          className="max-h-40 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
          placeholder='Chat, or type "generate an image of …" to create'
          value={input}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <Button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className={cn(isGen && "bg-emerald-600 hover:bg-emerald-500")}
        >
          {isGen ? "Generate" : "Send"}
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-zinc-600">
        Text-first: the AI talks until you command generation. Green button = account-pool image generation.
      </p>
    </div>
  )
}