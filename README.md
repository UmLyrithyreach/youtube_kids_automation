# YouTubeKids Studio

AI kids-YouTube video studio. One prompt in → a publish-ready kids episode out: screenplay, 360° character model sheets, per-scene keyframes, TTS voiceover, QC pass, and an ffmpeg assembly script. BYOK — your API keys live in your browser's localStorage, never on a server. Ships with three ways to publish: manual (copy prompts into your own AI tools), direct upload (YouTube OAuth PKCE + resumable upload), or via the SpidyCat Studio panel.

## Features

- **5-agent BYOK pipeline** — script, image, voice, vision, monitor agents, each with editable skill prompts and model config (OpenAI-style endpoints, SSE streaming)
- **Video generation** — Veo and other video endpoints via configurable proxy routes, with clear 429 quota messaging
- **Character Studio** — build a character vault: 7-pose 360° turnarounds, details, expressions, color palettes; import characters from external AI tools (drag-drop / clipboard paste)
- **Manual mode** — pure prompt generator: copy metadata, portrait + 360 prompts as text, publish without OAuth
- **AI write** — vision agent watches video frames, drafts YouTube title + description
- **YouTube publishing** — OAuth PKCE (Web-app client), resumable upload, publish-as selector (Regular video vs Short)
- **COPPA guard** — vision QC validates keyframes against the character palette and kid-safety checklist, auto re-rolls failures
- **16:9 / 9:16 formats** — long-form (1792x1024) and Shorts (1024x1792) framing locked per format
- **Dark/light theme, node canvas UI** — animated pipeline graph (GSAP + Motion), session history

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 19, TypeScript, Vite 8, Tailwind 4, Motion, GSAP, Lucide, Sonner |
| Agents | Custom orchestrator (`agents.ts`) + BYOK client (`byok.ts`) — OpenAI-style APIs |
| Proxy | Vite dev-server middleware `/cors-proxy` (also wired for `vite preview`) |
| Voice | edge-tts stems, concurrent per-scene synthesis, -18dB sidechain ducking |
| Assembly | Generated ffmpeg script (zoompan keyframe animation) |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module graph, pipeline run flow, data model, and BYOK request flow (mermaid diagrams).

```
app/
├── src/
│   ├── App.tsx                    # shell: tabs (song / character / youtube), theme
│   ├── lib/
│   │   ├── agents.ts              # 5 agent definitions + localStorage config store
│   │   ├── byok.ts                # BYOK client: text/image/audio/vision calls, 429 fallback
│   │   ├── pipeline.ts            # useStudio orchestrator: stages, sessions, history
│   │   ├── characterGenerator.ts  # turnaround/palette generation
│   │   ├── characterVault.ts      # character vault persistence
│   │   ├── youtube.ts             # OAuth PKCE + resumable upload
│   │   └── youtubeTypes.ts
│   └── components/
│       ├── agents/                # AgentCard, RunView, PipelineStepper, NodeCanvas, HistoryTabs
│       ├── character/CharacterStudio.tsx
│       ├── YouTubePanel.tsx       # channel connect + upload panel
│       └── ui/                    # ai-chat-input, dropzone, storyboard reel, etc.
├── public/                        # character sheets (spidycat, glow, rexy)
└── vite.config.ts                 # /cors-proxy middleware
docs/ARCHITECTURE.md
```

## Getting Started

```bash
cd app
npm install
npm run dev
```

Open the dev URL. Configure each agent card: base URL (default `http://127.0.0.1:20128`), API key, model. Keys persist in localStorage (`yt-kids-agents-v5`).

### Production build

```bash
npm run build
npm run preview   # serves dist/ with the same /cors-proxy middleware
```

### Lint

```bash
npm run lint
```

## Usage

1. **Song tab** — pick format (16:9 / 9:16), type the episode idea, optionally attach reference images. The pipeline runs: vision analysis → screenplay → keyframe images → TTS → vision QC → ffmpeg script. Watch it live in the run view / node canvas.
2. **Characters tab** — generate or import a character; it becomes the locked reference (palette, proportions) for every keyframe prompt.
3. **YouTube tab** — connect your channel via OAuth PKCE, or use manual mode: copy metadata + prompts, publish from your own AI tools. Publish-as selector: Regular video or Short.

## Security Notes

- API keys never leave the browser except to your own configured endpoint (through the local CORS proxy).
- OAuth uses PKCE; the app never sees a client secret (Web-app client type, secret sent only at token exchange per Google's flow).
- All content passes a COPPA compliance QC stage before deliverables are marked done.

## License

Private project — all rights reserved.