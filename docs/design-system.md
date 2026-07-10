# Design system & theming

How Side Quest gets its look: typed design tokens, a warm-paper light / warm-espresso dark theme flipped by `data-theme`, `next/font` type, and the inline-style-with-tokens convention (no CSS-in-JS library, no UI kit).

**See also:** [./architecture.md](./architecture.md) · [./structure.md](./structure.md) · [./routes.md](./routes.md) · [./tech-stack.md](./tech-stack.md) · [../CLAUDE.md](../CLAUDE.md) · [../../CLAUDE.md](../../CLAUDE.md)

---

## Identity

The visual language is **"Broadcast HUD"** — a sports-broadcast overlay feel (mono eyebrows, letter-spaced tags, hairline rules, ember accent) rendered on two paper-warm surfaces:

- **Warm Paper** — the light theme (default). Cream/parchment canvas, near-black ink, a single ember-orange accent.
- **Warm Espresso** — the dark theme. Dark-roast browns instead of the usual blue-grey "dark mode," so the accent and warmth carry over.

It is **hand-rolled** — CSS custom properties + typed token objects + inline `style` on components. There is no Tailwind component layer beyond `@tailwind base/components/utilities` in `globals.css`, no Radix, no MUI, no styled-components/emotion.

---

## Where it lives

| File | Role |
|------|------|
| `src/components/sidequest/tokens.ts` | Canonical typed tokens: `SQ.*` colors, `FONT.*` families, plus the status/rank color helpers. |
| `src/components/admin/tokens.ts` | One line — `export * from "@/components/sidequest/tokens"`. Admin uses the **same** tokens. |
| `src/app/globals.css` | The actual color values: `:root` (light) + `:root[data-theme="dark"]` (dark) blocks, base styles, scrollbars, `.sq-field`, `.admin-scope`. |
| `src/lib/theme.tsx` | `useTheme()` hook + `<ThemeToggle/>` (the sun/moon button). |
| `src/app/layout.tsx` | `next/font` wiring + the pre-paint no-flash theme script. |
| `src/components/sidequest/league-shell.tsx` · `admin/admin-shell.tsx` | The two chromes that consume the tokens. |

---

## The token layer

`tokens.ts` exports two frozen objects. **Every value is a `var(--sq-*)` reference, never a literal hex** — so the same token resolves to a different color per theme, and components never branch on light/dark themselves.

```ts
export const SQ = {
  bg: "var(--sq-bg)",        // admin canvas
  league: "var(--sq-league)",// player-facing canvas / light text-on-accent
  panel: "var(--sq-panel)",  // cards / panels
  ink: "var(--sq-ink)",      // primary text
  red: "var(--sq-red)",      // primary accent (ember)
  ember: "var(--sq-ember)",  // accent text / links / eyebrows
  // …greens/ambers/blues, greys (faint/mute/dim/label/steel/slate),
  //   hairlines, input borders, avatar surfaces, and theme-driven
  //   literals (navBg, avatarGrad, hatch, track, toggleOff)
} as const;

export const FONT = {
  display: "var(--font-sq-display), 'Archivo Black', sans-serif",
  sans:    "var(--font-sq-sans), 'Archivo', sans-serif",
  mono:    "var(--font-sq-mono), 'Spline Sans Mono', monospace",
} as const;
```

`SQ` carries **31 color/surface tokens**; the trailing group (`navBg`, `navBgAdmin`, `avatarGrad`, `hatch`, `track`, `toggleOff`) are theme-driven *literals* — gradients and translucent surfaces that differ between themes but aren't a single flat color.

### Token groups (semantic, not raw)

Tokens are named by **role**, not by hue, so intent survives a theme flip:

- **Surfaces:** `bg` (admin canvas), `league` (public canvas), `sidebar`, `panel` (cards), `inset` (wells/fields).
- **Text:** `ink` (primary) → `faint` (secondary body) → `mute` (mid) → `dim` (table heads) → `label`. Inactive nav uses `slate`; muted metric text uses `steel`.
- **Accents:** `red` (ember, primary accent / fills), `ember` (accent *text*: links, eyebrows), plus semantic `green` / `amber` / `blue`.
- **Lines & fields:** `hairline` / `hairlineSoft` / `hairlineFaint` / `hairlineCell` (four rule weights), `inputBorder`, `field`, `avatar` / `avatarBorder`.

---

## The two themes

Both palettes are defined once, in `globals.css`, as CSS custom properties. The light block is `:root`; the dark block is `:root[data-theme="dark"]`. Flipping the whole app is one attribute write.

```css
:root {                       /* Warm Paper (light) */
  color-scheme: light;
  --sq-bg: #f2ebdf;  --sq-league: #fbf7f1;  --sq-panel: #ffffff;
  --sq-ink: #2b2622; --sq-red: #e8602c;     --sq-ember: #c2521e;
  /* …greens/ambers/blues, greys, hairlines, gradients… */
}
:root[data-theme="dark"] {    /* Warm Espresso (dark) */
  color-scheme: dark;
  --sq-bg: #1a1714;  --sq-league: #1e1b18;  --sq-panel: #27231f;
  --sq-ink: #ece4d8; --sq-red: #ee6a38;     --sq-ember: #f2885e;
}
```

A few anchor values, to show the warm-paper ↔ warm-espresso mapping:

| Token | Light (Warm Paper) | Dark (Warm Espresso) |
|-------|--------------------|----------------------|
| `--sq-league` (public canvas) | `#fbf7f1` | `#1e1b18` |
| `--sq-bg` (admin canvas) | `#f2ebdf` | `#1a1714` |
| `--sq-panel` (cards) | `#ffffff` | `#27231f` |
| `--sq-ink` (text) | `#2b2622` | `#ece4d8` |
| `--sq-red` (accent) | `#e8602c` | `#ee6a38` |
| `--sq-ember` (accent text) | `#c2521e` | `#f2885e` |
| `--sq-green` | `#1f9d63` | `#4ecb8e` |

`color-scheme` is set per theme so native form controls and scrollbars match. `html, body` default to `--sq-league` / `--sq-ink` with the Archivo sans stack; `::selection` is a translucent ember (`rgba(232,96,44,0.24)`).

---

## Fonts (`next/font`)

Three Google fonts are self-hosted at build time via `next/font/google` and exposed as CSS variables consumed by `FONT.*`:

| Family | `next/font` | Variable | Used for |
|--------|-------------|----------|----------|
| **Archivo** (400/500/600/700) | `Archivo` | `--font-sq-sans` | Body / UI text (`FONT.sans`) |
| **Archivo Black** (400) | `Archivo_Black` | `--font-sq-display` | Display / wordmark (`FONT.display`) |
| **Spline Sans Mono** (400–700) | `Spline_Sans_Mono` | `--font-sq-mono` | Eyebrows, tags, tables, numerics (`FONT.mono`) |

The root `layout.tsx` applies all three `.variable` classes to `<html>`; each shell layout (`(site)`, `admin`) also re-declares them and passes a `fontClass` into its shell so the class is present on the rendered subtree. `display: "swap"` on all three.

---

## No-flash boot + ThemeToggle

The theme is resolved **before paint** by an inline script in the root `<body>` (so there's no flash of the wrong theme, and `<html suppressHydrationWarning>` covers the injected attribute):

```js
// stored 'sq-theme' wins; else prefers-color-scheme; else 'light'
var t = localStorage.getItem('sq-theme');
if (t !== 'light' && t !== 'dark')
  t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
document.documentElement.dataset.theme = t;
```

`lib/theme.tsx` then owns runtime switching:

- `useTheme()` reads `dataset.theme` on mount (guarded by a `mounted` flag to stay SSR-safe), returns `{ theme, toggle, setTheme, mounted }`.
- `setTheme` writes `document.documentElement.dataset.theme` **and** persists to `localStorage['sq-theme']`.
- `<ThemeToggle/>` is a 34×34 icon button (lucide `Sun`/`Moon`) styled entirely from tokens. It renders in **both** shell headers — `league-shell.tsx` and `admin-shell.tsx`.

---

## Styling convention: inline `style` + tokens

There is no CSS-in-JS runtime and no component library. Components style themselves with **inline `style` objects that read `SQ.*` / `FONT.*`**:

```tsx
import { SQ, FONT } from "@/components/sidequest/tokens"; // or "../tokens" / "./tokens"

<span style={{
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".14em",
  color: SQ.dim,
  border: `1px solid ${SQ.field}`,
  padding: "3px 7px",
  borderRadius: 3,
}}>
  {seasonCode}
</span>
```

Conventions that recur across the 28 screens:

- **Eyebrows / tags / codes** use `FONT.mono` + positive `letterSpacing` (`.1em`–`.14em`) + small caps-ish sizing — the broadcast-HUD tell.
- **The brand mark** is a 13×13 `SQ.red` square rotated 45° (a diamond), next to `FONT.display` "SIDE QUEST" — see `league-shell`, `admin-shell`, and the `(auth)` layout.
- **`clsx` + `tailwind-merge`** (`cn` in `lib/utils.ts`) exist for the rare className joins (e.g. the shell's `cn("admin-scope", fontClass)`); layout math stays in inline styles.

### Why inline-with-tokens

Trade-off, stated honestly: this keeps color/theme logic in one place (`tokens.ts` + the two `:root` blocks) and lets any component re-theme for free, at the cost of verbose style objects and no CSS pseudo-classes (`:hover`, `:focus`) from inline styles — those few cases fall back to real CSS classes in `globals.css` (`.sq-field`) or JS hover state.

---

## Shared status / color helpers

`tokens.ts` also exports pure helpers so the **public and admin surfaces render the same badge for the same state** — a fan and an admin never see a status colored two different ways.

| Helper | Signature | What it does |
|--------|-----------|--------------|
| `matchStatusLabel` | `(raw: string) → string` | Backend enum → human label. `AWAITING_RESULT → "Awaiting result"`, `CANCELLED → "Voided"` (a voided match is never mislabelled "Cancelled"). |
| `matchStatusColors` | `(MatchStatus) → [text, border]` | Ember (Live/Voided), blue (Scheduled), amber (Awaiting result), green (Completed). |
| `announcementTagColors` | `(AnnouncementTag) → [text, border]` | Ember (RESULT), blue (LEAGUE), slate (default). |
| `rankAccent` | `(isFirst: boolean) → { color, rowBg }` | First place gets ember text + a subtle `linear-gradient(90deg, rgba(232,96,44,.14), transparent)` row wash; everyone else neutral steel. |

`MatchStatus` and `AnnouncementTag` are exported string-literal unions, so callers cast through `Parameters<typeof matchStatusColors>[0]`. `matchStatusLabel` + `matchStatusColors` are consumed by four match surfaces (public `match.tsx`; admin `matches.tsx`, `result.tsx`, `match/[id]`); `announcementTagColors` and `rankAccent` are shared by the home, franchises, and announcements screens.

### The status-badge idiom

The recurring badge shape: `matchStatusLabel(raw)` for text → `matchStatusColors(label)` for `[color, border]` → an inline mono pill.

```tsx
const label = matchStatusLabel(m.status);
const [stColor, stBorder] = matchStatusColors(label as Parameters<typeof matchStatusColors>[0]);
// → <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".1em",
//                   color: stColor, border: `1px solid ${stBorder}`, … }}>{label}</span>
```

---

## `globals.css` — the non-token bits

Beyond the two `:root` palette blocks and base `html/body` styles, `globals.css` holds:

- **Global scrollbars** (`::-webkit-scrollbar*`) — 10px, transparent track, `--sq-input-border` thumb (→ `--sq-field` on hover), pill radius with a padding-box inset.
- **`.admin-scope`** — a scoped override that shrinks scrollbars to 8px with a tighter 4px radius, applied on the shell root (`cn("admin-scope", …)` in both shells) to give the control-room its denser feel.
- **`.sq-field`** — the auth/form input class: `::placeholder` uses `--sq-label`; `:focus` switches the border to `--sq-red` and drops the outline. Used across the auth forms and the register / profile / lineup / match-scoring inputs (10 component files). This is the one place `:focus`/`::placeholder` need real CSS rather than inline styles.
- **`::selection`** — translucent ember highlight.

---

## Admin: same tokens, distinct control-room look

`components/admin/tokens.ts` is a single re-export line — admin does **not** fork the palette. The control-room reads as a different surface purely by *which* tokens each shell reaches for:

| | Public (`LeagueShell`) | Admin (`AdminShell`) |
|--|------------------------|----------------------|
| Canvas | `SQ.league` (lighter paper) | `SQ.bg` (a shade deeper) |
| Nav backdrop | `SQ.navBg` | `SQ.navBgAdmin` + `SQ.sidebar` rail |
| Chrome | Top nav bar | Left sidebar + top bar, `.admin-scope` scrollbars |
| Wordmark | Diamond + "SIDE QUEST" | Same diamond + a red `ADMIN` pill; "LEAGUE ADMIN" identity block |
| Accent, fonts, status colors | shared | **identical** (same `SQ.red`, same `FONT.*`, same badge helpers) |

`admin/toggle.tsx` (the 38×22 on/off switch) and `admin/table-scroll.tsx` are admin-local components, but they still style from the shared `SQ` tokens (`SQ.red` on, `SQ.toggleOff` off) — so the two shells stay visibly one product.

---

## Limitations

- **No design-token tests / visual regression.** The quality gate is `tsc --noEmit` + `next build` + ad-hoc Playwright; there is no automated check that a new component actually reads tokens (a stray hardcoded hex would pass CI). Reviewer discipline is the only guard.
- **Inline styles can't do pseudo-states.** `:hover` / `:focus` / `::placeholder` require a real CSS class or JS state; only `.sq-field` and the scrollbars currently use CSS. Adding a hover style means falling out of the token-inline pattern.
- **Two font-declaration sites.** Root layout and each shell layout re-declare the three `next/font` families; keep the weights/variables in sync if you touch one.
- **Theme is `data-theme` on `<html>` only.** There's no per-subtree theming; the whole document is light or dark. `prefers-color-scheme` is honored only on first visit (before a `sq-theme` is stored) — after that, the stored choice wins and won't follow the OS.
