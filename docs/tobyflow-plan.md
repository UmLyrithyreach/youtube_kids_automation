# TobyFlow → youtubekids: usage + build plan (no code yet)

## Why it can't be "added" directly
TobyFlow is a Chrome extension (MV3). It lives in YOUR browser, automates Google Flow /
ChatGPT / Grok web UIs. A website (your React app) cannot embed or call a Chrome
extension — no API, no SDK. Two real options only:

**Option A — Use TobyFlow as an external tool (today, zero code)**
1. Install extension: https://chromewebstore.google.com/detail/tobyflow-auto-flow-auto-c/iicjfgdnngmpfocfanpiammedafmomin
2. Needs accounts with quota on Google Flow / ChatGPT / Grok (its login is separate).
3. Workflow for feeding your app:
   - Batch Generate: paste prompt list → auto-generates + auto-downloads images/videos locally.
   - Move downloaded files into your app: CharacterVault / MediaUploadDropzone already accept uploads (paste/attach reference images for keyframes).
   - Use TobyFlow output as reference images (`onPasteSceneKeyframe`), never as final kids-content assets — platform outputs are not COPPA-checked; your pipeline's QC stays the gate.
4. Limit: manual import loop, browser must stay open, platform quotas + UI automation rate limits.

**Option B — Rebuild the useful 20% inside your app (the plan)**
Your app calls APIs via 9router directly — no browser automation needed. Build these, in order:

| # | Feature | Effort | What it needs |
|---|---------|--------|---------------|
| 1 | Prompt Enhancer (✨ button) | hours | script agent rewrite call on prompt inputs |
| 2 | Batch Episode Queue | 1-2 days | wrapper around pipeline.ts: topic list → sequential runs, per-item state, pause/resume |
| 3 | Episode Presets (Smart Tasks) | 1 day | saved topic+format+duration+character combo, extends CharacterVault localStorage pattern |
| 4 | Telegram done-ping | hours | Bot API call at done/error stage |

Skipped on purpose: DAG workflow builder (TobyFlow needs it to chain different
platforms; your pipeline is a fixed production line). Revisit only if you want
custom stage orders.

## Recommendation
Do A now for asset generation experiments (test what Flow/Grok imagery looks like),
build 1+2 in the app for the real pipeline. A is a stopgap; B is the product.