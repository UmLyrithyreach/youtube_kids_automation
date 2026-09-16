// Agent definitions + BYOK config storage (localStorage, keys stay in browser)

export type Capability = "text-to-text" | "text-to-image" | "text-to-speech" | "monitor" | "vision"

export interface AgentConfig {
  baseUrl: string
  apiKey: string
  model: string
  models: string[] // fetched from endpoint
  imagePath?: string // endpoint path for image generation (image agent only)
  voiceName?: string // edge-tts voice stem (en-US-AnaNeural, en-US-ChristopherNeural)
  skill?: string // user-modifiable custom skill / system prompt
  escalateModel?: string // consultant pattern: stronger model consulted ONCE on failure
}

export type AgentId = "script" | "image" | "voice" | "vision" | "monitor"

export interface AgentDef {
  id: AgentId
  name: string
  role: string
  description: string
  capability: Capability
  acceptsImages?: boolean
  defaultSkill: string
  defaultModel: string
  defaultBaseUrl: string
  defaultImagePath?: string
  accentColor: string
}

export const AGENTS: AgentDef[] = [
  {
    id: "script",
    name: "Screenplay & Beat Director",
    role: "Subagent A: Narrative & Storyboard Beats",
    description: "Evaluates episode topic, moral, educational objective and structures JSON scene breakdown with timing.",
    capability: "text-to-text",
    defaultBaseUrl: "http://127.0.0.1:20128",
    defaultModel: "GLM-5.2",
    accentColor: "from-purple-500 to-indigo-500",
    defaultSkill: `# Kids Screenplay & Beat Director Skill (Subagent A)

You are Subagent A (Screenplay & Beat Director) for an autonomous kids production engine.
Your goal is to build high-retention 3-act nursery rhyme episodes optimized for kids (Ages 2-8).

## Output Rules
- Evaluate episode topic, educational objective, and relatable moral.
- Generate structured scene breakdown: Scene ID, Timing (s), Character Action, Voice Narration.
- YouTube Long-Form: 90s-180s duration. YouTube Shorts: 20s-30s maximum with immediate 0-2s hook and seamless loop ending.
- Maintain musical rhythm with AABB or ABCB nursery rhyme syllable meter.`
  },
  {
    id: "image",
    name: "360° Character Modeler",
    role: "Subagent B: 360° Turnaround & Asset Bible",
    description: "Generates professional 7-pose 360° turnaround model sheets with details, expressions, and color swatches.",
    capability: "text-to-image",
    acceptsImages: true,
    defaultBaseUrl: "http://127.0.0.1:20128",
    defaultModel: "Gemini-PRO-Combo",
    defaultImagePath: "/v1/images/generations",
    accentColor: "from-sky-500 to-blue-600",
    defaultSkill: `Using the attached image as the character reference, create a professional 3D character model sheet / turnaround reference sheet in the style of an official animation or game character design bible. Keep the character's exact design, colors, proportions, and outfit fully consistent across every view — do not redesign or alter the character.

TOP SECTION - 360° TURNAROUND:
Show the character in 7 poses in a horizontal row on a seamless neutral studio background with soft even lighting: FRONT, FRONT-LEFT 45°, LEFT SIDE, BACK-LEFT 45°, BACK, BACK-RIGHT 45°, FRONT-RIGHT 45°. Label each pose underneath in small white caps text. Add a "360° TURNAROUND" icon label in the top-left corner.

BOTTOM SECTION - THREE PANELS on a dark charcoal background:
Left panel titled "DETAILS": 3-4 close-up inset shots of the character's most distinctive features or accessories, each labeled with its name.
Center panel titled "EXPRESSIONS": a 2x3 grid of close-up headshots showing six expressions — Happy, Excited, Curious, Surprised, Determined, and Sleepy — each labeled.
Right panel titled "COLOR PALETTE": a vertical list of color swatches (circles) with labels for every distinct color visible on the character. Below that, a "MODEL INFO" text block listing Style, Character name, Role, and Turnaround: 360°.

Overall: clean infographic-style layout, dark UI panels with white sans-serif labels, consistent lighting, proportions, and colors across all views, high production value matching an official character design reference sheet used in animated films or games.`
  },
  {
    id: "voice",
    name: "Voice & Audio Synthesizer",
    role: "Subagent D: Concurrent Audio & Ducking",
    description: "Fans out per-scene edge-tts stems concurrently across CPU threads with -18dB sidechain ducking.",
    capability: "text-to-speech",
    defaultBaseUrl: "http://127.0.0.1:20128",
    defaultModel: "en-US-AnaNeural",
    accentColor: "from-rose-500 to-pink-600",
    defaultSkill: `# Parallel Voice & Audio Synthesizer (Subagent D)

You are Subagent D in charge of high-speed parallel voice synthesis and stem engineering.
- Voices: en-US-AnaNeural (warm preschool tutor) or en-US-ChristopherNeural (curious explorer).
- Pacing: Clear, warm, enthusiastic, perfectly synchronized to scene timing beats.
- Sidechain ducking: Ducks background musical stems to -18dB during voiceover, recovering to -10dB during transitions.`
  },
  {
    id: "vision",
    name: "Visual Prompter & Framing",
    role: "Subagent C: 16:9 & 9:16 Cams",
    description: "Translates scene beats into locked widescreen (1792x1024) / vertical (1024x1792) prompts.",
    capability: "vision",
    defaultBaseUrl: "http://127.0.0.1:20128",
    defaultModel: "ag/gemini-3.8-flash",
    accentColor: "from-amber-500 to-orange-500",
    defaultSkill: `# Visual Prompter & Framing Specialist (Subagent C)

You translate narrative scene beats into locked cinematic framing instructions referencing the character turnaround sheet.

## Framing Rules
- Long-Form: 1792x1024 (16:9 widescreen), expansive storybook depth of field.
- Shorts: 1024x1792 (9:16 vertical), centered high-contrast mascot framing.
- Enforce locked palette hex codes in every keyframe prompt.
- Proportions: 3D volumetric Pixar style, clean studio/storybook lighting, no stray limbs, no text.`
  },
  {
    id: "monitor",
    name: "Autonomous Vision-QC & Guardian",
    role: "Subagent E: Palette & COPPA Compliance",
    description: "Validates keyframes against turnaround palette and COPPA safety, auto-triggering re-rolls.",
    capability: "monitor",
    defaultBaseUrl: "http://127.0.0.1:20128",
    defaultModel: "ag/gemini-3.8-flash-low",
    accentColor: "from-emerald-500 to-teal-600",
    defaultSkill: `# Autonomous Vision-QC & Compliance Monitor (Subagent E)

You guard the channel against YouTube repetitive spam penalties and validate COPPA child safety.

## Autonomous QC Checklist
1. Palette Verification: Validate fur/skin, costume, and eye hexes against locked Character Bible.
2. Silhouette & Anatomy: Flag extra limbs, distorted paws, or melted accessories.
3. COPPA Compliance: Ensure 100% gentle, uplifting, kid-safe visuals.
4. Auto Re-roll: Auto-trigger targeted keyframe regeneration with boosted prompt weights on failing frames.`
  },
]

const STORE_KEY = "yt-kids-agents-v5" // v5: migrate off Claude (quota exhausted) to GLM-5.2 escalation

export function getDefaultConfig(agentId: AgentId): AgentConfig {
  const def = AGENTS.find((a) => a.id === agentId)
  if (!def) {
    return {
      baseUrl: "http://127.0.0.1:20128",
      apiKey: "sk-9router-local",
      model: "Claude",
      models: [],
      skill: "",
    }
  }
  // Consultant pattern (MOEG-5/consultant): cheap orchestrator does the work;
  // consultant consulted ONCE per failure, not per call.
  // GLM-5.2 = orchestrator + consultant (user's Claude quota exhausted).
  return {
    baseUrl: def.defaultBaseUrl,
    apiKey: "sk-9router-local",
    model: def.defaultModel,
    models: [def.defaultModel],
    imagePath: def.defaultImagePath,
    voiceName: def.id === "voice" ? "en-US-AnaNeural" : undefined,
    skill: def.defaultSkill,
    escalateModel: def.id === "script" ? "GLM-5.2" : undefined,
  }
}

export function loadConfigs(): Record<AgentId, AgentConfig | null> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const res: Record<AgentId, AgentConfig | null> = { script: null, image: null, voice: null, vision: null, monitor: null }
      for (const def of AGENTS) {
        if (parsed[def.id]) {
          res[def.id] = {
            ...getDefaultConfig(def.id),
            ...parsed[def.id],
            skill: parsed[def.id].skill || def.defaultSkill,
          }
        } else {
          res[def.id] = getDefaultConfig(def.id)
        }
      }
      return res
    }
  } catch {
    // fallback to defaults
  }
  return {
    script: getDefaultConfig("script"),
    image: getDefaultConfig("image"),
    voice: getDefaultConfig("voice"),
    vision: getDefaultConfig("vision"),
    monitor: getDefaultConfig("monitor"),
  }
}

export function saveConfigs(configs: Record<AgentId, AgentConfig | null>) {
  localStorage.setItem(STORE_KEY, JSON.stringify(configs))
}

// Capability keyword filter applied to a model id list.
export function filterModelsByCapability(models: string[], capability: Capability): string[] {
  const all = models.map((m) => (typeof m === "string" ? m : String(m ?? ""))).filter(Boolean)
  const kw: Record<Capability, string[]> = {
    "text-to-text": ["gpt", "claude", "glm", "gemini", "text", "chat", "llama", "mistral", "deepseek", "qwen", "grok", "opus", "sonnet", "haiku"],
    "text-to-image": ["image", "dall-e", "flux", "diffusion", "midjourney", "sd", "gemini", "flash", "pro", "combo", "imagen"],
    "text-to-speech": ["voice", "speech", "tts", "audio", "ana", "christopher", "neural", "eleven", "whisper"],
    vision: ["vision", "vlm", "gpt", "gemini", "claude", "glm", "llava", "qwen-vl", "4o", "4.1", "opus", "sonnet", "pixtral", "molmo", "internvl"],
    monitor: all, // monitor accepts anything (it probes)
  }
  const hits = all.filter((m) => kw[capability].some((k) => m.toLowerCase().includes(k)))
  return hits.length > 0 ? hits : all
}
