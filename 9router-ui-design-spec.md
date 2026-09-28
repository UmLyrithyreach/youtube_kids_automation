# 9router dashboard — UI design spec (mirror-ready)

Source: `decolua/9router` @ master, shallow clone `/tmp/9router-ui`.
Stack: Next.js App Router + Tailwind v4 (CSS-first, NO `tailwind.config.js` — tokens live in `@theme inline` in `src/app/globals.css`). Icons: Material Symbols Outlined (ligatures). Font: `Inter` via `next/font/google`.

---

## 1. Layout model

**Fixed left sidebar (288px) + sticky top header + scrollable content column.** No tabs at shell level; tabs are per-page `SegmentedControl`.

`src/shared/components/layouts/DashboardLayout.js`
```jsx
<div className="flex h-screen w-full overflow-hidden bg-bg">
  <div className="hidden lg:flex"><Sidebar /></div>
  <div className={`fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
  <main className="flex flex-col flex-1 h-full min-w-0 relative transition-colors duration-300 isolate">
    <div className="landing-grid absolute inset-0 pointer-events-none -z-10" aria-hidden="true" />
    <Header key={pathname} onMenuClick={() => setSidebarOpen(true)} />
    <div className={`flex-1 overflow-y-auto custom-scrollbar ${... ? "" : "p-6 lg:p-10"} ...`}>
      <div className={`${... ? ... : "max-w-7xl mx-auto"}`}>{children}</div>
```

`src/shared/components/Sidebar.js:112`
```jsx
<aside className="flex w-72 flex-col border-r border-border-subtle bg-vibrancy backdrop-blur-xl transition-colors duration-300 min-h-full">
```
- Sidebar chrome: fake macOS traffic lights `w-3 h-3 rounded-full` `bg-[#FF5F56]` / `bg-[#FFBD2E]` / `bg-[#27C93F]` (`Sidebar.js:114-116`).
- Logo tile: `size-9 rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--shadow-warm)]`, icon `hub` white 20px (`Sidebar.js:123`).
- Nav container: `<nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">`.

### Exact sidebar labels (verbatim)

`src/shared/components/Sidebar.js:20-40`
```js
const navItems = [
  { href: "/dashboard/endpoint", label: "Endpoint & Key", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  // { href: "/dashboard/basic-chat", label: "Basic Chat", icon: "chat" }, // Hidden
  { href: "/dashboard/combos", label: "Combo & Vision Adapter", icon: "layers" },
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota Tracker", icon: "data_usage" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
];
const debugItems = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];
const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
];
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };
```
Section divider label (`Sidebar.js:187`):
```jsx
<p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">System</p>
```
Media accordion items come from `MEDIA_PROVIDER_KINDS` labels: `Embedding`, `Text to Image`, `Text to Speech`, `Speech To Text`, `Video`, `System One` (NEW). Trailing: `Settings` (icon `settings`), `9Remote` (badge `NEW`), `9English`.

Nav item (active vs idle):
```jsx
className={cn(
  "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
  isActive(item.href)
    ? "bg-primary/10 text-primary"
    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
)}
```
Icon: `material-symbols-outlined text-[18px]` + `fill-1` when active. Label: `text-[13px] font-medium`.

### Page header

`src/shared/components/Header.js:230`
```jsx
<header className="shrink-0 flex items-center justify-between gap-3 px-4 lg:px-8 pt-3 pb-2 border-b border-border-subtle bg-surface/60 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none z-20">
```
- Breadcrumbs: `chevron_right` separators, muted links, current crumb `<h1 className="text-base lg:text-2xl font-semibold text-text-main tracking-tight truncate">`.
- Identity pill: `rounded-full border border-border bg-surface/70 text-xs`, method chip `rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary`.
- Donate button: `h-8 rounded-lg border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400`.
- Right cluster order: search → Donate → ThemeToggle → Language → Menu.

### Content page tab patterns

`src/app/(dashboard)/dashboard/usage/page.js:47`
```jsx
<SegmentedControl options={[{ value: "overview", label: "Overview" }, { value: "details", label: "Details" }]} ... />
<SegmentedControl options={PERIODS} size="sm" ... />
```
Period labels: `Today`, `24h`, `7D`, `30D`, `60D`, `All` (`usage/page.js:8-15`). Active tab in URL `?tab=overview|details`.

Provider-section headings on the Providers page (`src/app/(dashboard)/dashboard/providers/page.js`) — h2 style `text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight`, in order:
1. `Custom Providers (OpenAI/Anthropic Compatible)` — buttons `Add Anthropic Compatible` / `Add OpenAI Compatible`
2. `OAuth Providers` (line 472)
3. `Free Tier Providers` (line 519)
4. `API Key Providers` (line 580)
All sections have a `Test All` button (`play_arrow`, swaps to `Testing...`).

Provider grid: `grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4`.

Provider-account page detail sections: `Connections` (line 1514) and `Available Models` (line 1748).

---

## 2. Color palette — `src/app/globals.css`

Light (`:root`) / dark (`.dark`) — brand identical in both, surfaces differ.

```css
:root {
  /* Brand scale (light) - centered on #E56A4A */
  --color-brand-50: #fdf1ed;  --color-brand-100: #fadccf;
  --color-brand-200: #f4b59c; --color-brand-300: #ee8d6a;
  --color-brand-400: #ea7855; --color-brand-500: #E56A4A;
  --color-brand-600: #cc5236; --color-brand-700: #a64027;
  --color-brand-800: #7a2f1d; --color-brand-900: #4d1e12;

  --color-primary: var(--color-brand-500);
  --color-primary-hover: var(--color-brand-600);

  /* Surfaces & backgrounds (light) */
  --color-bg: #FDFAF6;        --color-bg-alt: #F7F3EE;
  --color-surface: #ffffff;   --color-surface-2: #f4f4f5;
  --color-surface-3: #e7e7e9; --color-sidebar: rgba(244, 241, 236, 0.85);

  --color-border: #e5e7eb;    --color-border-subtle: #f1f1f3;

  --color-text: #0a0a0a;      --color-text-main: #0a0a0a;
  --color-text-muted: #6B7280; --color-text-subtle: #9CA3AF;

  --color-danger: #cf222e;    --color-success: #10B981;
  --color-warning: #F59E0B;   --color-info: #3B82F6;

  --radius-brand: 10px;       --radius-brand-lg: 14px;
  color-scheme: light;
}
.dark {
  --color-bg: #1a1a1a;        --color-bg-alt: #1F1F1E;
  --color-surface: #262626;   --color-surface-2: #303030;
  --color-surface-3: #3a3a3a; --color-sidebar: rgba(30, 30, 30, 0.85);
  --color-border: #333333;    --color-border-subtle: #2a2a2a;
  --color-text: #ededed;      --color-text-main: #ededed;
  --color-text-muted: #9ca3af; --color-text-subtle: #6b7280;
  --color-danger: #ef4444;    --color-success: #22c55e;
  --color-warning: #fbbf24;   --color-info: #60a5fa;
  color-scheme: dark;
}
```

Shadows (`globals.css:57-66` light, `:110-119` dark):
```css
--shadow-soft: 0 1px 2px 0 rgba(0,0,0,0.04);
--shadow-warm: 0 2px 12px -2px rgba(229, 106, 74, 0.18);
--shadow-elevated: 0 12px 28px -4px rgba(60, 50, 45, 0.06);
--shadow-elev:
  inset 0 1px 0 0 rgba(255,255,255,0.8),
  0 1px 2px rgba(15,23,42,0.04),
  0 12px 36px -8px rgba(15,23,42,0.10);
--shadow-focus: 0 0 0 3px rgba(229,106,74,0.18);
```
Dark `--shadow-elev`: `inset 0 1px 0 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4), 0 16px 48px -8px rgba(0,0,0,0.55)`.

Mac chrome hexes: `#FF5F56` red, `#FFBD2E` yellow, `#27C93F` green (`globals.css:322-326` + `Sidebar.js`).

Provider accent colors (`ProviderLimitCard.js:41-52`, fallback `#6B7280`):
```js
github:"#000000", antigravity:"#4285F4", codex:"#10A37F", kiro:"#FF9900",
qoder:"#EC4899", "qoder-cn":"#EC4899", claude:"#D97757"
```
Legacy/landing palette still in `src/shared/constants/colors.js` (primary `#D97757` hover `#C56243`; status `#22C55E/#F59E0B/#EF4444/#3B82F6` with `*-light`/`*-dark` variants). Provider dots: `free: bg-green-500`, `oauth: bg-blue-500`, `apikey: <default>`, `compatible: bg-orange-500`.

Vibrancy (`globals.css:308`):
```css
.bg-vibrancy { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: rgba(255,255,255,0.72); }
.dark .bg-vibrancy { background: rgba(38, 38, 38, 0.72); }
```
Grid overlay (`globals.css:465`): two `linear-gradient` 1px lines, `background-size: 40px 40px`, `opacity: 0.08` light / `0.04` dark.

---

## 3. Radii, typography, motion

| Token | Value | Where |
|---|---|---|
| Card / Modal radius | `rounded-[14px]` | `Card.js:29`, `Modal.js:59` |
| Buttons, inner tiles, nav item | `rounded-[10px]` / `rounded-lg` | `Button.js:16`, `Card.js:40` |
| Segmented control container | `rounded-[10px]`, buttons `rounded-[8px]` | `SegmentedControl.js:21,31` |
| Badge / pill | `rounded-full` | `Badge.js:31` |
| Small chip | `rounded-[3px]` (NEW badge) / `rounded-md` (mini buttons) | `Sidebar.js` |

Font (`globals.css:199`):
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif;
```
Body: `font-family: var(--font-sans); -webkit-font-smoothing: antialiased;` + `font-sans antialiased` on `<body>`.

Type ladder in use: page h1 `text-base lg:text-2xl font-semibold tracking-tight`; card h3 `font-semibold`; body `text-sm`; meta `text-xs`; micro `text-[10px]`/`text-[11px]`; stat numerals `text-lg font-bold xl:text-xl`; label `text-xs font-semibold uppercase tracking-wide`. Nav 13px. Table mono logs `font-mono text-xs`. Numeric alignment `tabular-nums`.

Motion: `fade-in .2s ease-out`, `slide-in-top .18s cubic-bezier(0.22,1,0.36,1)`, `slide-in-right .25s`, transitions `duration-150/200/300`, hover scale `active:scale-[0.97]`, progress `.3s`.

Scrollbars (`globals.css:257-286`): global `scrollbar-width: thin`, `*::-webkit-scrollbar{width:8px;height:8px}`, thumb `rgba(120,120,120,0.35)` `border-radius:9999px`; `.custom-scrollbar` 6px thumb `rgba(156,163,175,0.3)` `border-radius:20px`, hover `var(--color-primary)`.

---

## 4. Card / row component shapes

`src/shared/components/Card.js`
```jsx
className={cn(
  "bg-surface border border-border-subtle",
  elev ? "rounded-[14px] shadow-[var(--shadow-elev)]" : "rounded-[14px] shadow-[var(--shadow-soft)]",
  hover && "hover:shadow-[var(--shadow-warm)] hover:border-brand-500/30 transition-all cursor-pointer",
  paddings[padding], className )}
// paddings: none:"", xs:"p-3", sm:"p-4", md:"p-6", lg:"p-8"
// header: <div className="flex items-center justify-between mb-4"> with icon tile <div className="p-2 rounded-[10px] bg-bg text-text-muted">
```
Sub-components:
```jsx
Card.Section  className="p-4 rounded-[10px] bg-bg border border-border-subtle"
Card.Row      className="p-3 -mx-3 px-3 transition-colors border-b border-border-subtle last:border-b-0 hover:bg-surface-2/50"
Card.ListItem className="group flex items-center justify-between p-3 -mx-3 px-3 border-b border-border-subtle last:border-b-0 hover:bg-surface-2/50 transition-colors"
// ListItem actions: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
```

Badges — `src/shared/components/Badge.js`
```js
const variants = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-brand-500/10 text-brand-600 dark:text-brand-300",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  error:   "bg-red-500/10 text-red-600 dark:text-red-400",
  info:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};
const sizes = { sm: "px-2 py-0.5 text-[10px]", md: "px-2.5 py-1 text-xs", lg: "px-3 py-1.5 text-sm" };
// base: "inline-flex items-center gap-1.5 rounded-full font-semibold"
// dot: <span className="size-1.5 rounded-full" /> colored bg-green-500|yellow-500|red-500|blue-500|brand-500|gray-500
```

Buttons — `src/shared/components/Button.js`
```js
primary:   "bg-brand-500 hover:bg-brand-600 text-white shadow-sm disabled:bg-surface-3 disabled:text-text-muted"
secondary: "bg-surface-2 hover:bg-surface-3 text-text-main border border-border disabled:opacity-50"
outline:   "border border-border text-text-main hover:bg-surface-2 hover:border-brand-500/40"
ghost:     "text-text-muted hover:bg-surface-2 hover:text-text-main"
danger:    "bg-red-500 hover:bg-red-600 text-white shadow-sm ..."
success:   "bg-green-600 hover:bg-green-700 text-white shadow-sm ..."
sizes = { sm: "h-7 px-3 text-xs rounded-[8px]", md: "h-9 px-4 text-sm rounded-[10px]", lg: "h-11 px-6 text-sm rounded-[10px]" }
// base: "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out cursor-pointer active:scale-[0.97]"
```

SegmentedControl — `src/shared/components/SegmentedControl.js`
```jsx
<div className="inline-flex items-center p-1 rounded-[10px] overflow-x-auto bg-surface-2">
  <button className={cn("shrink-0 px-4 rounded-[8px] font-medium transition-all", sizes[size],
    value === option.value ? "bg-surface text-text-main shadow-sm" : "text-text-muted hover:text-text-main")}>
// sizes = { sm:"h-7 text-xs", md:"h-9 text-sm", lg:"h-11 text-base" }
```

Toggle — `src/shared/components/Toggle.js`: track `rounded-full`, checked `bg-brand-500` else `bg-surface-3`, thumb `bg-white shadow-sm`; sizes `{sm: w-8 h-4, md: w-11 h-6, lg: w-14 h-7}`.

Modal — `src/shared/components/Modal.js:50-60`: overlay `absolute inset-0 bg-black/50 backdrop-blur-[2px] fade-in`; panel `relative w-full bg-surface border border-border-subtle rounded-[14px] shadow-[var(--shadow-elev)] fade-in`; sizes `sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl full:max-w-4xl`; header `flex items-center justify-between p-2 border-b border-border-subtle` with `w-4 h-4 rounded-full bg-[#FF5F56]` close + two inert `bg-[#3a3a3a]/20 dark:bg-white/15` dots. Escape closes; body scroll locked.

Skeleton — `src/shared/components/Loading.js`: `Skeleton` = `animate-pulse rounded-[10px] bg-surface-2`; `CardSkeleton` = `p-6 rounded-[14px] border border-border-subtle bg-surface shadow-[var(--shadow-soft)]`; `Spinner` = Material symbol `progress_activity` `animate-spin text-brand-500`.

Toolbar mini-controls (ubiquitous on Providers/Quota pages), e.g. `ProviderLimits/index.js:832,936`:
```
h-8 rounded-lg border border-black/10 bg-black/[0.02] px-2 text-xs text-text-primary
outline-none transition-colors hover:bg-black/5
dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/10
```
Dropdown panel (`index.js:864`): `absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-black/10 bg-surface/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur`; option rows `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm` with selected `bg-primary/10 text-primary` + trailing `check`; separator `my-1 h-px bg-black/10 dark:bg-white/10`.

---

## 5. Providers list rendering

Provider tile card — `ProvidersPage → ProviderCard` (grid `lg:grid-cols-3 xl:grid-cols-4`):
```jsx
<Link href={`/dashboard/providers/${providerId}`} className="group min-w-0">
  <Card padding="xs" className={`h-full hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${allDisabled ? "opacity-50" : ""}`}>
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="size-8 shrink-0 rounded-lg flex items-center justify-center"
           style={{ backgroundColor: `${provider.color?.length > 7 ? provider.color : provider.color + "15"}` }}>
        <ProviderIcon src={`/providers/${provider.id}.png`} size={30} className="object-contain rounded-lg max-w-[32px] max-h-[32px]" />
      </div>
      <h3 className="truncate font-semibold">{provider.name}</h3>
```
Status row uses badges, not dots:
```jsx
<Badge variant="success" size="sm" dot>Ready</Badge>            // noAuth provider
<Badge variant="success" size="sm" dot>{connected} Connected</Badge>
<Badge variant="error"   size="sm" dot>{error} Error ({errorCode})</Badge>
<span className="text-text-muted">No connections</span>
<Badge variant="default" size="sm"><span className="material-symbols-outlined text-[12px]">pause_circle</span>Disabled</Badge>
```
Trailing `Toggle size="sm"` reveal-on-hover: `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`.

Provider filter options (`src/app/(dashboard)/dashboard/providers/utils.js:1`): `All`, `Active`, `Inactive`, `No connection`.

Status variant map — `src/shared/utils/connectionStatus.js`:
```js
if (isActive === false) return "default";
if (effectiveStatus === "active" || effectiveStatus === "success") return "success";
if (["error","expired","unavailable"].includes(effectiveStatus)) return "error";
return "default";
```
Error tag chips: `RUNTIME`, `AUTH`, `429`, `5XX`, `NET`, or numeric code.

Account/connection row — `src/app/(dashboard)/dashboard/providers/components/ConnectionsCard.js`:
```jsx
<div className={`group flex flex-col gap-3 p-2 rounded-lg sm:flex-row sm:items-center sm:justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${connection.isActive === false ? "opacity-60" : ""}`}>
  // reorder column: keyboard_arrow_up / keyboard_arrow_down, p-0.5 rounded, disabled → text-text-muted/30
  <span className="material-symbols-outlined text-base text-text-muted">{isOAuth ? "lock" : "key"}</span>
  <p className="text-sm font-medium truncate">{displayName}</p>
  <div className="flex flex-wrap items-center gap-2 mt-1">
    <Badge variant={getStatusVariant()} size="sm" dot>{connection.isActive === false ? "disabled" : (effectiveStatus || "Unknown")}</Badge>
    {hasAnyProxy && <Badge variant={proxyBadgeVariant} size="sm">Proxy</Badge>}
    {isCooldown && ...<span className="text-xs text-orange-500 font-mono">⏱ {remaining}</span>}
    {connection.lastError && <span className="text-xs text-red-500 truncate max-w-[300px]">{connection.lastError}</span>}
    <span className="text-xs text-text-muted">#{connection.priority}</span>
```
Row action buttons: `flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-text-muted hover:text-primary`; delete variant `hover:bg-red-500/10 text-red-500`. Also icon-over-label buttons `text-[10px] leading-tight` for `Proxy`/`Edit`/`Delete`. Per-row `Toggle size="sm"`.

Quota-tracker account row — `ProviderLimits/index.js:1071` (2-col grid):
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <Card padding="none" className={`min-w-0 ${isInactive ? "opacity-60" : ""}`}>
    <div className="px-3 py-2 border-b border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center overflow-hidden">
          <ProviderIcon src={`/providers/${conn.provider}.png`} size={32} className="object-contain" />
        <h3 className="text-sm font-semibold text-text-primary truncate">{providerLabel(conn.provider)}</h3>
        <p className="text-xs text-text-muted truncate">{getConnectionLabel(conn)}</p>
        <p className="text-[11px] text-text-muted/80 truncate">{getConnectionSecondaryLabel(conn)}</p>
```
Inline chip row (kiro example): `rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-300`; variants `bg-blue-500/10 ... blue-600`, status chip `bg-green-500/10 text-green-600` / `bg-red-500/10 text-red-600` / `bg-surface-2 text-text-muted`.

Empty states (both patterns verbatim):
```jsx
<Card padding="lg"><div className="text-center py-12">
  <span className="material-symbols-outlined text-[64px] text-text-muted opacity-20">cloud_off</span>
  <h3 className="mt-4 text-lg font-semibold text-text-primary">No Providers Connected</h3>
  <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">…</p>
</div></Card>

<div className="text-center py-8 border border-dashed border-border rounded-xl">
  <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">search_off</span>
  <p className="text-text-muted text-sm">No providers match your search or filters</p>
</div>
```

---

## 6. Quota / usage rendering

### Thresholds (single source, duplicated in 2 files)
`QuotaProgressBar.js:7-33` and `QuotaTable.js:45-63`:
```js
if (remainingPercentage > 70)  → text-green-500/600, bg-green-500, bgLight bg-green-500/10, emoji 🟢
if (remainingPercentage >= 30) → text-yellow-500/600, bg-yellow-500, bgLight bg-yellow-500/10, emoji 🟡
else (0-29%)                   → text-red-500/600, bg-red-500, bgLight bg-red-500/10, emoji 🔴
```
Credit-balance override: `text-blue-600 dark:text-blue-400 / bg-blue-500 / bg-blue-500/10 / 💰`.
Depletion threshold `DEPLETED_QUOTA_THRESHOLD = 5` (`ProviderLimits/utils.js:8`); polling `REFRESH_INTERVAL_MS = 60000`, `CLAUDE_REFRESH_INTERVAL_MS = 600000`.

### Progress-bar component
`ProviderLimits/QuotaProgressBar.js` — bar `h-2 rounded-full`, track = `bgLight`, fill width = **remaining %**:
```jsx
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-text-primary">{label}</span>
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{colors.emoji}</span>
      <span className={cn("font-medium", colors.text)}>{remaining}%</span>
    </div>
  </div>
  {!unlimited && (
    <div className={cn("h-2 rounded-full overflow-hidden", colors.bgLight)}>
      <div className={cn("h-full transition-all duration-300", colors.bg)} style={{ width: `${Math.min(remaining, 100)}%` }} />
    </div>
  )}
  <div className="flex items-center justify-between text-xs text-text-muted">
    <span>{used.toLocaleString()} / {total.toLocaleString()} requests</span>
    <div className="flex items-center gap-1"><span>•</span><span className="font-medium">{resetWord} in {countdown}</span></div>
  </div>
  {resetDisplay && <div className="text-xs text-text-muted/70">{resetWord} at {resetDisplay}</div>}
```
`resetWord` = `"Reset"` when `recurring`, else `"Expires"`. Countdown format (`utils.js:227`): `<60m → "45m"`, `<24h → "3h 12m"`, else days. Absolute display: `Today, 03:15 PM` / `Tomorrow, …` / `Aug 4, 03:15 PM`.

### Table-row variant (what the quota page actually renders)
`ProviderLimits/QuotaTable.js:130-215` — page size 10, one row per quota, no header row:
```jsx
<div className={`flex items-center gap-2 border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${cellPad}`}>
  {/* name, w-36 */}
  <span className="text-[10px] shrink-0">{colors.emoji}</span>
  <span className={`${nameText} font-medium text-text-primary truncate`}>{quota.name}</span>
  {/* bar + counts */}
  <div className={`${compact ? "h-1" : "h-1.5"} rounded-full overflow-hidden border ${colors.bgLight} ${quota.remaining === 0 ? "border-black/10 dark:border-white/10" : "border-transparent"}`}>
    <div className={`h-full transition-all duration-300 ${colors.bg}`} style={{ width: `${Math.min(quota.remaining, 100)}%` }} />
  </div>
  <span className="text-text-muted truncate">{used} / {total || "∞"}</span>
  <span className={`font-medium ${colors.text} shrink-0`}>{quota.remaining}%</span>
  {/* reset */}
  <div className={`${resetPrimary} text-text-primary font-medium truncate`}>in 3h 12m</div>
  <div className={`${resetSecondary} text-text-muted truncate`}>Today, 03:15 PM</div>
```
Density tokens: `const cellPad = compact ? "py-1 px-1.5" : "py-2 px-3"`, `nameText = compact ? "text-[11px]" : "text-sm"`. Special labels: unlimited rows show `{used} used · Unlimited` in `text-green-600 dark:text-green-400`; credit rows show `Credit: 34.20 USD`; empty reset shows `N/A` italic.
Sort-chip: `rounded-md border border-black/10 bg-black/[0.02] px-2 py-1 text-[10px] text-text-muted` → "Sorted by account remaining".
Hide-row button: `inline-flex h-6 w-6 ... rounded-md text-text-muted hover:bg-black/5` icon `visibility_off`.
Pagination bar: `rounded-md border border-black/10 bg-black/[0.02] px-2 py-1.5`, text `text-[10px]`, `Showing {start}-{end} of {n}` / `Page {p} / {t}`.

### Quota-tracker toolbar (verbatim labels)
- provider dropdown: `All providers`
- account filter select (`ACCOUNT_FILTER_OPTIONS`): `All accounts`, `Active`, `Turned off`
- sort select (`QUOTA_SORT_OPTIONS`, codex only): `Default quota order`, `% quota: low to high`, `% quota: high to low`
- button: `Expiring first` (icon `hourglass_top`; active state `border-amber-500/40 bg-amber-500/10 text-amber-500`)
- button: `Turn off Empty` (icon `block`, `border-red-500/30 text-red-500`)
- button: `Turn on Available` (icon `check_circle`, `border-emerald-500/30 text-emerald-500`)
- toggle: `Auto-refresh` + `({countdown}s)` in `text-[10px] tabular-nums`; icon swaps `toggle_on`/`toggle_off`
- refresh: icon-only `refresh`, `animate-spin` while loading
- page size select: `10 / page`, `20 / page`, `50 / page`, `100 / page`, `Custom`; pager buttons `First Page`, `chevron_left`, `chevron_right`, `Last Page`
- empty states: `No Providers Connected` (icon `cloud_off`, body "Connect to providers with OAuth to track your API quota limits and usage.")
- loading skeleton: `<div className="h-4 bg-black/5 dark:bg-white/5 rounded animate-pulse" />` + `<div className="h-2 …">`

### Usage page stat cards
`usage/components/OverviewCards.js` — `grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-4`; each:
```jsx
<Card className="flex min-w-0 flex-col items-center text-center gap-1 px-3 py-3 sm:px-4">
  <span className="text-text-muted text-xs uppercase font-semibold sm:text-sm">Total Requests</span>
  <span className="w-full truncate text-lg font-bold xl:text-xl">{fmt(stats.totalRequests)}</span>
```
Five cards: `Total Requests`, `Total Input Tokens` (`text-primary`), `Cached Tokens` (`text-info`), `Output Tokens` (`text-success`), `Est. Cost` (`text-warning`, `~$0.00`, footnote `text-[10px] text-text-muted` → "Estimated, not actual billing").

Log table (`src/shared/components/RequestLogger.js:69`):
```jsx
<table className="w-full text-left border-collapse whitespace-nowrap">
  <thead className="sticky top-0 bg-bg-subtle border-b border-border z-10">
    <th className="px-3 py-2 border-r border-border">DateTime</th>… Model / Provider / Account / In / Out / Status
  <tbody className="divide-y divide-border/50">
```
Card wrapper `overflow-hidden bg-black/5 dark:bg-black/20`, `font-mono text-xs`, `max-h-[600px]`.

---

## 7. Design tokens to port into React+Tailwind

Distinctive, non-obvious choices worth copying exactly:
1. **Warm-neutral base, single coral accent.** `#E56A4A` brand scale identical light/dark; light bg is cream `#FDFAF6`, dark bg is `#1a1a1a`, never pure-black-on-pure-white.
2. **Two radii only**: `14px` for cards/modals, `10px` for controls/tiles, `8px` for segmented buttons, `full` for badges/pills.
3. **Borders, not shadows, do the separating**: `border-border-subtle` (`#f1f1f3` / `#2a2a2a`) on every card/list row; shadows are barely visible (`--shadow-soft` is 4% black).
4. **Opacity-tinted status colors**: `bg-{color}-500/10` + `text-{color}-600 dark:text-{color}-400`. No solid status fills except progress-bar fills and Toasts.
5. **Emoji as quota status indicator** (🟢🟡🔴💰) alongside the colored bar — cheap, zero-asset.
6. **Sidebar is macOS-chrome themed**: fake traffic lights + `blur(20px)` vibrancy glass at 85–72% alpha.
7. **Material Symbols ligatures** (`hub`, `dns`, `bar_chart`, `data_usage`, `savings`, `terminal`, `lan`, `extension`, `api`, `layers`) — one 18px icon per nav row, `fill-1` variant when active.
8. **Micro toolbar controls are all `h-8`** with `border-black/10 bg-black/[0.02]` (dark: `border-white/10 bg-white/[0.03]`), `text-xs`.
9. **Icon-button pattern** = `h-8 w-8 rounded-lg` + muted glyph + `hover:text-primary`; destructive = `hover:bg-red-500/10 text-red-500`.
10. **Grid overlay** `.landing-grid` behind content (40px cells, 8%/4% alpha) for warmth against flat surfaces.
