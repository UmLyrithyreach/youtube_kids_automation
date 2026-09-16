// Character Vault — Stores reusable recurring channel mascots
// Based on Jack Vs. AI workflow: Characters are created ONCE and reused
// across all future musical videos and episodes with a frozen master prompt.

import { type CharacterPalette } from "./characterGenerator"
import { runScript, runImage, runImageWithReference } from "./byok"
import type { AgentConfig } from "./agents"

export interface Character {
  id: string
  name: string
  role: "hero" | "sidekick" | "mentor" | "friend"
  species: string
  tagline: string
  description: string
  frozenPrompt: string
  turnaroundPrompt?: string // Professional 7-pose 360° asset bible prompt
  portraitUrl?: string // 3D Hero Concept Portrait (Image #2)
  turnaroundSheetUrl?: string // 360° Turnaround Reference Sheet (Image #3)
  palette: CharacterPalette
  createdAt: number
  isDefault?: boolean
}

const REXY_PALETTE: CharacterPalette = {
  name: "Rexy",
  species: "Baby T-Rex Mascot",
  primary: "#10b981", // Emerald Green
  secondary: "#86efac", // Light Green belly
  accent: "#06b6d4", // Electric Blue thruster lights
  skinOrFur: "#10b981", // Emerald Green
  eyeColor: "#1e293b",
  outfit: "#ef4444", // Bright Red high-top sneakers
}

const GLOW_PALETTE: CharacterPalette = {
  name: "Glow",
  species: "Firefly Robot Companion",
  primary: "#0284c7",
  secondary: "#e0f2fe",
  accent: "#f59e0b",
  skinOrFur: "#93c5fd",
  eyeColor: "#06b6d4",
  outfit: "#38bdf8",
}

const BEAR_PALETTE: CharacterPalette = {
  name: "Barnaby Bear",
  species: "Musical Explorer Bear",
  primary: "#10b981",
  secondary: "#fbbf24",
  accent: "#f59e0b",
  skinOrFur: "#d97706",
  eyeColor: "#451a03",
  outfit: "#059669",
}

export function build360TurnaroundPrompt(char: {
  name: string
  species: string
  role?: string
  description: string
  palette: CharacterPalette
}): string {
  const { name, species, role = "Hero Mascot", description, palette } = char

  return `Using the attached image as the character reference, create a professional 3D character model sheet / turnaround reference sheet in the style of an official animation or game character design bible. Keep the character's exact design, colors, proportions, and outfit fully consistent across every view — do not redesign or alter the character.

CHARACTER: ${name} — ${species} (Role: ${role})
DESIGN: ${description}
COLORS: Primary ${palette.primary}, Secondary ${palette.secondary}, Accent ${palette.accent}, Skin/Fur ${palette.skinOrFur}, Eyes ${palette.eyeColor}

TOP SECTION - 360° TURNAROUND:
Show the character in 7 poses in a horizontal row on a seamless neutral studio background with soft even lighting: FRONT, FRONT-LEFT 45°, LEFT SIDE, BACK-LEFT 45°, BACK, BACK-RIGHT 45°, FRONT-RIGHT 45°. Label each pose underneath in small white caps text. Add a "360° TURNAROUND" icon label in the top-left corner.

BOTTOM SECTION - THREE PANELS on a dark charcoal background:
Left panel titled "DETAILS": 3-4 close-up inset shots of the character's most distinctive features or accessories (clothing, tools, textures, markings, etc.), each labeled with its name.
Center panel titled "EXPRESSIONS": a 2x3 grid of close-up headshots of the character showing six different expressions — Happy, Excited, Curious, Surprised, Determined, and Sleepy — each labeled.
Right panel titled "COLOR PALETTE": a vertical list of color swatches (circles) with labels for every distinct color visible on the character — Primary ${palette.primary}, Secondary ${palette.secondary}, Accent ${palette.accent}, Skin/Fur ${palette.skinOrFur}, Eyes ${palette.eyeColor}. Below that, a "MODEL INFO" text block listing Style: 3D Pixar/Disney, Character: ${name} (${species}), Role: ${role}, Turnaround: 360°.

Overall: clean infographic-style layout, dark UI panels with white sans-serif labels, consistent lighting, proportions, and colors across all views, high production value matching an official character design reference sheet used in animated films or games.`
}

export const CANONICAL_CHARACTERS: Character[] = [
  {
    id: "rexy",
    name: "Rexy",
    role: "hero",
    species: "Baby T-Rex Mascot",
    tagline: "Brave emerald-green explorer with a chrome jetpack and aviator goggles!",
    description: "A small, round, big-eyed baby T-Rex character, emerald green skin with light green belly, dark green spots/stripes down the back and tail. Wearing blue-lensed aviator goggles pushed up on the forehead with a black strap, a chrome-silver jetpack with glowing electric-blue thruster lights strapped to its back with a black charcoal harness, and red high-top sneakers with white laces and soles. Big friendly cartoon eyes, short arms, a thick tail for balance, standing in a heroic mascot pose.",
    frozenPrompt: "Rexy, a cute stylized 3D character: Role: HERO MASCOT. Style: 3D Pixar Animation with volumetric lighting. Request: A brave emerald-green toddler T-Rex named Rexy wearing a miniature chrome jetpack, glowing blue aviator goggles, and tiny bright red sneakers. Energetic and lovable.. 3D Pixar Disney stylized animation, warm volumetric lighting, storybook proportions, clean studio background, no text, no watermark",
    turnaroundPrompt: `A professional 3D character model sheet / turnaround reference sheet for a cute Pixar-Disney style baby T-Rex mascot named "Rexy," rendered in the style of a game/animation asset bible.

TOP SECTION - 360° TURNAROUND:
Show the same character in 7 poses in a horizontal row on a seamless studio background with soft warm lighting: FRONT, FRONT-LEFT 45°, LEFT SIDE, BACK-LEFT 45°, BACK, BACK-RIGHT 45°, FRONT-RIGHT 45°. Each pose labeled underneath in small caps white text. "360° TURNAROUND" icon label in top-left corner.

CHARACTER DESIGN:
A small, round, big-eyed baby T-Rex character, emerald green skin with light green belly, dark green spots/stripes down the back and tail. Wearing blue-lensed aviator goggles pushed up on the forehead with a black strap, a chrome-silver jetpack with glowing electric-blue thruster lights strapped to its back with a black charcoal harness, and red high-top sneakers with white laces and soles. Big friendly cartoon eyes, short arms, a thick tail for balance, standing in a heroic mascot pose.

BOTTOM SECTION - THREE PANELS on a dark charcoal background:
Left panel "DETAILS": four close-up inset photos of the goggles, jetpack, sneaker, and harness/strap buckle, each labeled.
Center panel "EXPRESSIONS": six close-up headshots in a 2x3 grid showing Happy, Excited, Curious, Surprised, Determined, and Sleepy expressions, each labeled.
Right panel "COLOR PALETTE": a vertical list of color swatches with circles and labels — Emerald Green (main), Light Green (belly), Dark Green (spots/stripes), Chrome Silver (jetpack/goggles), Electric Blue (lights/goggles), Bright Red (sneakers), White (shoe details), Charcoal (harness/straps). Below that a "MODEL INFO" text block listing Style: 3D Pixar/Disney, Character: Rexy (T-Rex), Role: Hero Mascot, Turnaround: 360°.

Overall: clean infographic/asset-sheet layout, dark UI panels with white sans-serif labels, consistent lighting and proportions across all views, high production value like an official character design bible for an animated film or game.`,
    portraitUrl: "/sheets/rexy-hero.png",
    turnaroundSheetUrl: "/sheets/rexy-sheet.png",
    palette: REXY_PALETTE,
    createdAt: 1725580800000,
    isDefault: true,
  },
  {
    id: "barnaby-bear",
    name: "Barnaby Bear",
    role: "hero",
    species: "Musical Explorer Bear",
    tagline: "Gentle rhythm master who loves counting songs and nature!",
    description: "Honey-gold chibi bear cub with warm caramel muzzle, green exploration overalls, and dark cocoa nose.",
    frozenPrompt: "Barnaby Bear, a warm honey-gold chibi bear cub in forest-green exploration overalls with yellow buttons, soft cream muzzle and inner ears, dark chocolate eyes, holding a tiny wooden acoustic ukulele, gentle friendly smile. 3D Pixar Disney stylized animation, warm volumetric lighting, storybook proportions, no text",
    turnaroundPrompt: `A professional 3D character model sheet / turnaround reference sheet for a cute Pixar-Disney style bear mascot named "Barnaby Bear," rendered in the style of a game/animation asset bible.

TOP SECTION - 360° TURNAROUND:
Show the same character in 7 poses in a horizontal row on a seamless studio background with soft warm lighting: FRONT, FRONT-LEFT 45°, LEFT SIDE, BACK-LEFT 45°, BACK, BACK-RIGHT 45°, FRONT-RIGHT 45°. Each pose labeled underneath in small caps white text. "360° TURNAROUND" icon label in top-left corner.

CHARACTER DESIGN:
Barnaby Bear, warm honey-gold chibi bear cub in forest-green exploration overalls with yellow buttons, soft cream muzzle and inner ears, dark chocolate eyes, holding tiny wooden acoustic ukulele.

BOTTOM SECTION - THREE PANELS on a dark charcoal background:
Left panel "DETAILS": four close-up inset photos of ukulele, overalls button, paw, and muzzle.
Center panel "EXPRESSIONS": six close-up headshots showing Happy, Excited, Curious, Surprised, Determined, and Sleepy expressions.
Right panel "COLOR PALETTE": swatches with Honey Gold, Forest Green, Cream, Dark Cocoa, Yellow Brass. Below that "MODEL INFO".`,
    palette: BEAR_PALETTE,
    createdAt: 1725580800000,
  },
  {
    id: "glow",
    name: "Glow",
    role: "sidekick",
    species: "Firefly Robot Companion",
    tagline: "Floating light-orb who solves math puzzles and lights up the dark!",
    description: "Floating sky-blue round drone buddy with friendly cyan visor-eyes, glowing amber antenna bulb, and tiny whirring translucent wings.",
    frozenPrompt: "Glow the Firefly Robot Companion, a smooth rounded sky-blue robotic orb with a soft cyan glowing LED screen face showing happy curved eyes, tiny translucent buzzing wings on top, and a warm amber glowing bulb tip on its small coiled antenna, floating with small blue sparkle particles. 2D flat vector cartoon, clean smooth gradients, kids educational tech style, cute companion, no text",
    turnaroundPrompt: `A professional 3D character model sheet / turnaround reference sheet for a cute Pixar-Disney style robot mascot named "Glow," rendered in the style of a game/animation asset bible.

TOP SECTION - 360° TURNAROUND:
Show the same character in 7 poses in a horizontal row: FRONT, FRONT-LEFT 45°, LEFT SIDE, BACK-LEFT 45°, BACK, BACK-RIGHT 45°, FRONT-RIGHT 45°.

CHARACTER DESIGN:
Glow, smooth rounded sky-blue metallic robotic orb with cyan glowing LED visor face, translucent insect wings, and warm amber glowing antenna bulb.

BOTTOM SECTION - THREE PANELS:
Left panel "DETAILS": antenna bulb, wing joint, visor screen, thruster base.
Center panel "EXPRESSIONS": six facial expressions on cyan LED screen.
Right panel "COLOR PALETTE": Sky Blue, Cyan, Warm Amber, Slate Shadow.`,
    palette: GLOW_PALETTE,
    portraitUrl: "/sheets/glow.png",
    turnaroundSheetUrl: "/sheets/glow-sheet.png",
    createdAt: 1725580800000,
  },
]

const VAULT_KEY = "yt-kids-character-vault-v7"
const SELECTED_KEY = "yt-kids-selected-character-v7"

export function loadCharacterVault(): Character[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Character[]
      if (Array.isArray(parsed)) {
        return parsed.map((c) => ({
          ...c,
          // strip legacy hand-drawn SVG placeholders — only real AI images count
          portraitUrl: c.portraitUrl?.startsWith("data:image/svg") ? undefined : c.portraitUrl,
          turnaroundSheetUrl: c.turnaroundSheetUrl?.startsWith("data:image/svg") ? undefined : c.turnaroundSheetUrl,
          turnaroundPrompt: c.turnaroundPrompt || build360TurnaroundPrompt(c),
        }))
      }
    }
  } catch (err) {
    console.error("Error loading character vault:", err)
  }
  return [...CANONICAL_CHARACTERS]
}

export function saveCharacterVault(characters: Character[]) {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(characters))
  } catch (err) {
    console.error("Failed to save character vault:", err)
  }
}

export function deleteCharacterFromVault(id: string): Character[] {
  const current = loadCharacterVault()
  const filtered = current.filter((c) => c.id !== id)
  saveCharacterVault(filtered)
  
  // If deleted character was selected, select the first remaining or remove selection
  const selectedId = localStorage.getItem(SELECTED_KEY)
  if (selectedId === id) {
    if (filtered.length > 0) {
      setSelectedCharacterId(filtered[0].id)
    } else {
      localStorage.removeItem(SELECTED_KEY)
    }
  }
  return filtered
}

export function restoreCanonicalCharacters(): Character[] {
  saveCharacterVault(CANONICAL_CHARACTERS)
  if (CANONICAL_CHARACTERS.length > 0) {
    setSelectedCharacterId(CANONICAL_CHARACTERS[0].id)
  }
  return [...CANONICAL_CHARACTERS]
}

export function getSelectedCharacter(): Character | null {
  const characters = loadCharacterVault()
  try {
    const savedId = localStorage.getItem(SELECTED_KEY)
    if (savedId) {
      const match = characters.find((c) => c.id === savedId)
      if (match) return match
    }
  } catch {
    // fallback
  }
  return characters[0] || null
}

export function setSelectedCharacterId(id: string) {
  try {
    localStorage.setItem(SELECTED_KEY, id)
  } catch (err) {
    console.error("Failed to set selected character:", err)
  }
}

// Shared heuristic parsing — used when no LLM is configured, and by manual mode
function fallbackCharData(userPrompt: string): {
  name: string
  role: Character["role"]
  species: string
  tagline: string
  description: string
  palette: CharacterPalette
  frozenPrompt: string
} {
  {
    const p = userPrompt.trim()
    // Pull the actual creature/character words out of the structured prompt
    // ("Role: HERO MASCOT.\nStyle: 3D...\nRequest: <the real idea>") — skip Role/Style lines
    const requestMatch = p.match(/Request:\s*([\s\S]+)/i)
    const requestText = (requestMatch ? requestMatch[1] : p).trim()
    const nameMatch = requestText.match(/(?:named|name is|call (?:it|him|her)|called)\s+([A-Za-z0-9'-]+)/i)
    // Skip filler verbs/articles when deriving a name from the request text
    const FILLER = /^(a|an|the|create|make|give|me|design|draw|generate|build|want|i'd|like|please|with|and|of|for|mascot|character)$/i
    const contentWords = requestText.split(/[\s,.]+/).filter((w) => w && !FILLER.test(w))
    const name = nameMatch ? nameMatch[1] : (contentWords.slice(0, 2).join(" ") || "New Mascot")

    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      role: "hero",
      species: "Animated Kids Character",
      tagline: `Fun, brave, and cheerful mascot loved by kids!`,
      description: `${name} is a colorful, friendly animated character designed for kids learning songs: ${requestText.slice(0, 200)}`,
      palette: {
        name,
        species: "Animated Character",
        primary: "#8b5cf6",
        secondary: "#38bdf8",
        accent: "#f59e0b",
        skinOrFur: "#fed7aa",
        eyeColor: "#1e293b",
        outfit: "#8b5cf6",
      },
      frozenPrompt: `${name}, a cute stylized 3D character: ${requestText}. 3D Pixar Disney stylized animation, warm volumetric lighting, storybook proportions, clean studio background, no text, no watermark`,
    }
  }
}

// Manual mode: the user generated images with their own AI (ChatGPT, Gemini,
// Midjourney…) and uploads them here — no LLM or image API calls at all.
export async function createManualCharacter(opts: {
  fullPrompt: string
  role?: Character["role"]
  portraitDataUrl?: string
  sheetDataUrl?: string
}): Promise<Character> {
  const charData = fallbackCharData(opts.fullPrompt)
  const role = opts.role ?? charData.role
  const palette: CharacterPalette = {
    ...charData.palette,
    name: charData.name,
    species: charData.species,
  }
  const turnaroundPrompt = build360TurnaroundPrompt({
    name: charData.name,
    species: charData.species,
    role: charData.role,
    description: charData.description,
    palette,
  })

  const newChar: Character = {
    id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: charData.name,
    role,
    species: charData.species,
    tagline: charData.tagline,
    description: charData.description,
    frozenPrompt: charData.frozenPrompt,
    turnaroundPrompt,
    portraitUrl: opts.portraitDataUrl,
    turnaroundSheetUrl: opts.sheetDataUrl,
    palette,
    createdAt: Date.now(),
  }

  const updated = [newChar, ...loadCharacterVault()]
  saveCharacterVault(updated)
  setSelectedCharacterId(newChar.id)
  return newChar
}

// Read an uploaded image and downscale to ≤1024px so the vault's localStorage
// payload stays small. ponytail: canvas/WebP re-encode, ~200KB/char ceiling —
// move images to IndexedDB or a backend if the vault grows past ~10 characters.
export function fileToDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/webp", 0.9))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("could not read that image file"))
    }
    img.src = url
  })
}

// AI Character Generation using BYOK LLM & Image Modeler
export async function generateCharacterWithAI(
  userPrompt: string,
  scriptConfig: AgentConfig | null,
  imageConfig: AgentConfig | null,
  onProgress?: (status: string) => void
): Promise<Character> {
  onProgress?.("Analyzing character concept & designing character bible with AI...")

  const systemInstruction = `You are an elite Character Designer and Visual Development Director for high-retention YouTube Kids animated series (e.g. Cocomelon, Pinkfong, Ms. Rachel).
Given the creator's prompt, generate a complete, technical Character Bible.

Return ONLY a valid raw JSON object (no markdown fences, no extra text) with this exact schema:
{
  "name": "Catchy mascot name",
  "role": "hero" | "sidekick" | "mentor" | "friend",
  "species": "Species or archetype (e.g. Chibi Kitten Superhero, Gentle Bear)",
  "tagline": "Memorable personality tagline for kids (1 sentence)",
  "description": "Comprehensive visual description detailing fur/skin texture, head shape, oversized sparkling eyes, signature costume/accessories, and proportions.",
  "palette": {
    "primary": "#hex color",
    "secondary": "#hex color",
    "accent": "#hex color",
    "skinOrFur": "#hex color",
    "eyeColor": "#hex color",
    "outfit": "#hex color"
  },
  "frozenPrompt": "Paste-ready positive prompt block for video/image models: [Name], a cute chibi [species]: [detailed anatomy, fur/skin color, expressive eyes, signature accessories, silhouette]. Canonical colors: [named colors]. 3D Pixar Disney stylized animation, clean studio lighting, storybook proportions, no text, no watermark"
}`

  let charData: {
    name: string
    role: "hero" | "sidekick" | "mentor" | "friend"
    species: string
    tagline: string
    description: string
    palette: CharacterPalette
    frozenPrompt: string
  } | null = null

  if (scriptConfig && scriptConfig.baseUrl && scriptConfig.apiKey && scriptConfig.model) {
    try {
      const response = await runScript(
        scriptConfig,
        `${systemInstruction}\n\nCREATOR CHARACTER PROMPT: "${userPrompt}"`
      )
      // Extract JSON — tolerate markdown fences / trailing prose around it
      const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/)
      const candidate = fenced ? fenced[1] : response
      const jsonMatch = candidate.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // Validate shape — reject garbage that lacks a real name/description
        if (parsed && typeof parsed.name === "string" && parsed.name.trim() &&
            typeof parsed.description === "string" && parsed.description.trim().length > 20 &&
            !/^role:/i.test(parsed.name.trim())) {
          charData = parsed
        }
      }
    } catch (e) {
      console.warn("AI LLM synthesis error, falling back to heuristic parsing:", e)
    }
  }

  // Fallback parsing if LLM is unconfigured or failed
  if (!charData) {
    const p = userPrompt.trim()
    // Pull the actual creature/character words out of the structured prompt
    // ("Role: HERO MASCOT.\nStyle: 3D...\nRequest: <the real idea>") — skip Role/Style lines
    const requestMatch = p.match(/Request:\s*([\s\S]+)/i)
    const requestText = (requestMatch ? requestMatch[1] : p).trim()
    const nameMatch = requestText.match(/(?:named|name is|call (?:it|him|her)|called)\s+([A-Za-z0-9'-]+)/i)
    // Skip filler verbs/articles when deriving a name from the request text
    const FILLER = /^(a|an|the|create|make|give|me|design|draw|generate|build|want|i'd|like|please|with|and|of|for|mascot|character)$/i
    const contentWords = requestText.split(/[\s,.]+/).filter((w) => w && !FILLER.test(w))
    const name = nameMatch ? nameMatch[1] : (contentWords.slice(0, 2).join(" ") || "New Mascot")

    charData = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      role: "hero",
      species: "Animated Kids Character",
      tagline: `Fun, brave, and cheerful mascot loved by kids!`,
      description: `${name} is a colorful, friendly animated character designed for kids learning songs: ${requestText.slice(0, 200)}`,
      palette: {
        name,
        species: "Animated Character",
        primary: "#8b5cf6",
        secondary: "#38bdf8",
        accent: "#f59e0b",
        skinOrFur: "#fed7aa",
        eyeColor: "#1e293b",
        outfit: "#8b5cf6",
      },
      frozenPrompt: `${name}, a cute stylized 3D character: ${requestText}. 3D Pixar Disney stylized animation, warm volumetric lighting, storybook proportions, clean studio background, no text, no watermark`,
    }
  }

  // Ensure palette has name & species
  const palette: CharacterPalette = {
    ...charData.palette,
    name: charData.name,
    species: charData.species,
  }

  const turnaroundPrompt = build360TurnaroundPrompt({
    name: charData.name,
    species: charData.species,
    role: charData.role,
    description: charData.description,
    palette,
  })

  let portraitUrl: string | undefined = undefined
  let sheetUrl: string | undefined = undefined
  let imageError: string | null = null

  // If BYOK Image Generator is configured, fire portrait + sheet together:
  // 9router's /v1/images/generations ignores reference images, so the sheet
  // gains nothing from waiting on the portrait — running both in parallel
  // halves the (15-60s+) wall time.
  if (imageConfig && imageConfig.baseUrl && imageConfig.apiKey && imageConfig.model) {
    onProgress?.(`Generating 3D portrait + 360° turnaround sheet in parallel (${imageConfig.model})...`)
    const [portraitRes, sheetRes] = await Promise.allSettled([
      runImage(imageConfig, charData.frozenPrompt),
      runImageWithReference(imageConfig, turnaroundPrompt, undefined),
    ])
    if (portraitRes.status === "fulfilled") {
      portraitUrl = portraitRes.value
    } else {
      imageError = (portraitRes.reason as Error)?.message ?? String(portraitRes.reason)
      console.warn("Portrait generation note:", portraitRes.reason)
    }
    if (sheetRes.status === "fulfilled") {
      sheetUrl = sheetRes.value
    } else {
      imageError = (sheetRes.reason as Error)?.message ?? String(sheetRes.reason)
      console.warn("360° Modeler failed:", sheetRes.reason)
    }
  }

  if (imageError && !portraitUrl && !sheetUrl) {
    throw new Error(
      `Image generation failed: ${imageError}. ` +
      `The script/text steps succeeded (character bible created). ` +
      `Image models are often quota-limited (429) — wait for the quota to reset or switch the 360° Modeler model in Agents.`
    )
  }

  const newChar: Character = {
    id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: charData.name,
    role: charData.role || "hero",
    species: charData.species,
    tagline: charData.tagline,
    description: charData.description,
    frozenPrompt: charData.frozenPrompt,
    turnaroundPrompt,
    portraitUrl,
    turnaroundSheetUrl: sheetUrl,
    palette,
    createdAt: Date.now(),
  }

  // Save into vault
  const current = loadCharacterVault()
  const updated = [newChar, ...current]
  saveCharacterVault(updated)
  setSelectedCharacterId(newChar.id)

  return newChar
}
