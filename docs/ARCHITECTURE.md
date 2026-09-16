# YouTubeKids Studio — Architecture

AI kids-YouTube video studio. React 19 + Vite + Tailwind 4. 5 BYOK agents (script/image/voice/vision/monitor) — keys stay in browser, API calls go through dev-server CORS proxy.

## Module graph

```mermaid
flowchart TD
    App[App.tsx] --> Studio[useStudio pipeline.ts]
    App --> Cards[AgentCard.tsx]
    App --> Run[RunView.tsx]
    App --> Hist[HistoryTabs.tsx]
    App --> CharStudio[CharacterStudio.tsx]
    App --> Input[ai-chat-input.tsx]
    App --> Fmt[FormatToggleSwitcher.tsx]
    App --> Yt[YouTubePanel.tsx]
    Yt --> YtLib[youtube.ts: OAuth PKCE + resumable upload]
    Run --> Stepper[PipelineStepper.tsx]
    Hist --> Stream[AgentChatStream.tsx]
    Cards --> NodeCanvas[NodeCanvas.tsx]
    Studio --> Agents[agents.ts]
    Studio --> Byok[byok.ts]
    Studio --> Gen[characterGenerator.ts]
    Studio --> Vault[characterVault.ts]
    CharStudio --> Vault
    CharStudio --> Gen
    Byok --> Agents
```

## Pipeline run flow

```mermaid
flowchart TD
    P[Prompt + attachments] --> V{vision config?}
    V -- yes --> Vis[runVision on attachments]
    V -- no --> Tx[extractFileText fallback]
    Vis --> Scr
    Tx --> Scr[runScript: structured screenplay]
    Scr --> Img[runImage / runKeyframeImage: character sheet + scenes]
    Img --> Aud[synthesizeSpeech: per-scene TTS]
    Aud --> QC[vision QC pass on frames]
    QC --> Asm[generateFfmpegScript + motionPrompts]
    Asm --> Done[Deliverable saved to session]
    Done --> Err[stage error? mark session]
```

## Data model

```mermaid
erDiagram
    Session ||--o{ AgentMessage : agentMessages
    Session ||--|| Deliverable : result
    AgentConfig }o--|| AgentId : "5 agents"
    Character ||--|| CharacterPalette : palette
    SceneBeat }o--|| ScreenplayData : scenes

    Session {
        string id
        string name
        string stage
        string format
    }
    Deliverable {
        string script
        string ffmpegScript
        number qcScore
        bool coppaPassed
    }
```

## BYOK request flow

```mermaid
sequenceDiagram
    participant UI as pipeline.ts
    participant B as byok.ts
    participant PX as /cors-proxy (dev server)
    participant EP as user endpoint
    UI->>B: runScript(config, prompt)
    B->>PX: POST /cors-proxy, x-target-url header
    PX->>EP: proxied OpenAI-style call
    EP-->>PX: JSON / SSE stream
    PX-->>B: response
    B-->>UI: parsed text / image b64 / audio
```