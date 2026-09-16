import { useState, useRef, useEffect } from "react"
import {
  FileText,
  Sparkles,
  Wand2,
  ShieldCheck,
  User,
  Send,
  Copy,
  Check,
  Terminal,
  Code2,
  MessageSquare,
  FileCode,
  Loader2,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import type { Session, AgentMessage } from "@/lib/pipeline"
import { ensureSessionMessages, formatScriptMarkdown } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

interface Props {
  session: Session
  onSendMessage: (text: string) => void
  activeTab?: "stream" | "script"
  onTabChange?: (tab: "stream" | "script") => void
}

const AGENT_META: Record<
  string,
  { label: string; icon: any; color: string; badgeClass: string; avatarClass: string }
> = {
  vision: {
    label: "Vision Analyst",
    icon: Sparkles,
    color: "purple",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    avatarClass: "bg-purple-600 text-white shadow-purple-500/20",
  },
  script: {
    label: "Script Writer",
    icon: FileText,
    color: "blue",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    avatarClass: "bg-blue-600 text-white shadow-blue-500/20",
  },
  image: {
    label: "360° Character Modeler",
    icon: Wand2,
    color: "emerald",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    avatarClass: "bg-emerald-600 text-white shadow-emerald-500/20",
  },
  monitor: {
    label: "Monitor",
    icon: ShieldCheck,
    color: "indigo",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    avatarClass: "bg-indigo-600 text-white shadow-indigo-500/20",
  },
  user: {
    label: "You",
    icon: User,
    color: "slate",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    avatarClass: "bg-slate-700 text-white shadow-slate-500/20",
  },
}

export function AgentChatStream({
  session,
  onSendMessage,
  activeTab: controlledTab,
  onTabChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<"stream" | "script">("stream")
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = (t: "stream" | "script") => {
    setInternalTab(t)
    onTabChange?.(t)
  }
  const [inputText, setInputText] = useState("")
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages: AgentMessage[] = ensureSessionMessages(session)
  const scriptContent = session.scriptMarkdown || (session.script ? formatScriptMarkdown(session.name, session.script) : "")
  const isRunning = session.stage !== "done" && session.stage !== "error"

  useEffect(() => {
    if (activeTab === "stream") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length, activeTab])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText)
    setInputText("")
  }

  const copyScript = () => {
    if (!scriptContent) return
    navigator.clipboard.writeText(scriptContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <aside className="flex h-full w-full flex-col bg-card/80 backdrop-blur-md">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Terminal className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Agent Coordination</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", isRunning ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50")} />
              <span>{isRunning ? "4 Agents Running" : "All Agents Idle"}</span>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("stream")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all",
              activeTab === "stream" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="size-3.5" /> Stream
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("script")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-all",
              activeTab === "script" ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCode className="size-3.5" /> script.md
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "stream" ? (
          <div className="space-y-3.5">
            {/* User prompt card */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="size-3.5 text-primary" />
                <span>Original Prompt</span>
              </div>
              <p className="mt-1.5 text-muted-foreground leading-relaxed whitespace-pre-wrap">{session.prompt}</p>
            </div>

            {/* Stream Messages */}
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const meta = AGENT_META[msg.agentId] || AGENT_META.monitor
                const Icon = meta.icon
                const isUser = msg.agentId === "user"

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-2xs transition-colors",
                      isUser
                        ? "border-primary/20 bg-primary/10 ml-4"
                        : "border-border/70 bg-card/90"
                    )}
                  >
                    <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md shadow-xs", meta.avatarClass)}>
                      <Icon className="size-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{msg.agentName}</span>
                          <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", meta.badgeClass)}>
                            {msg.type.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>

                      {/* Tool call badge like in the screenshot */}
                      {msg.toolName && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/40">
                          <Code2 className="size-3 text-primary" />
                          <span>Tool: {msg.toolName}</span>
                        </div>
                      )}

                      <p className="mt-1 leading-relaxed text-foreground/90 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {isRunning && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>Agents actively collaborating on pipeline...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* Live script.md viewer */
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">script.md</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">UTF-8</span>
                {session.script && (
                  <span className="text-[11px] text-muted-foreground">
                    {session.script.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={copyScript}
                disabled={!scriptContent}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy Markdown"}
              </button>
            </div>

            {scriptContent ? (
              <pre className="flex-1 overflow-auto rounded-xl border border-border/80 bg-muted/30 p-3.5 font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {scriptContent}
              </pre>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                <FileText className="size-8 text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground">script.md is being written...</p>
                <p className="mt-1 max-w-xs text-[11px]">The Script Writer agent will save the formatted screenplay here as soon as it drafts the scenes.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Input Dock like RoboNeo */}
      <form onSubmit={handleSend} className="border-t border-border/80 p-3 bg-card/40">
        <div className="relative flex items-center">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Instruct agents or refine song lyrics & lip-sync..."
            className="w-full rounded-xl border border-border bg-background/80 pl-3.5 pr-10 py-2.5 text-xs text-foreground outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Send instruction"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </form>
    </aside>
  )
}
