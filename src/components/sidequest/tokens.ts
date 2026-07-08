// Side Quest "Broadcast HUD" design tokens.
// Values are CSS custom properties so the whole app re-themes by flipping
// `document.documentElement.dataset.theme` between "light" (warm paper) and "dark"
// (warm espresso). The actual colour values live in globals.css (:root / [data-theme=dark]).
// Display-status unions used by the status/tag colour helpers below.
export type MatchStatus = "Live" | "Scheduled" | "Awaiting result" | "Completed";
export type AnnouncementTag = "RESULT" | "LEAGUE" | "RECAP" | "AUCTION";

export const SQ = {
  bg: "var(--sq-bg)", // admin canvas
  league: "var(--sq-league)", // player-facing canvas / light text-on-accent
  sidebar: "var(--sq-sidebar)",
  panel: "var(--sq-panel)", // cards / panels
  inset: "var(--sq-inset)", // inset fields / wells
  ink: "var(--sq-ink)", // primary text
  red: "var(--sq-red)", // primary accent (ember)
  ember: "var(--sq-ember)", // accent text / links / eyebrows
  green: "var(--sq-green)",
  amber: "var(--sq-amber)",
  blue: "var(--sq-blue)",
  faint: "var(--sq-faint)", // secondary body text
  mute: "var(--sq-mute)", // mid grey
  dim: "var(--sq-dim)", // table-head grey
  label: "var(--sq-label)",
  steel: "var(--sq-steel)",
  slate: "var(--sq-slate)", // inactive nav text
  hairline: "var(--sq-hairline)",
  hairlineSoft: "var(--sq-hairline-soft)",
  hairlineFaint: "var(--sq-hairline-faint)",
  hairlineCell: "var(--sq-hairline-cell)",
  inputBorder: "var(--sq-input-border)",
  field: "var(--sq-field)",
  avatar: "var(--sq-avatar)",
  avatarBorder: "var(--sq-avatar-border)",
  // theme-driven literals (gradients / translucent surfaces)
  navBg: "var(--sq-nav-bg)",
  navBgAdmin: "var(--sq-nav-bg-admin)",
  avatarGrad: "var(--sq-avatar-grad)",
  hatch: "var(--sq-hatch)",
  track: "var(--sq-track)",
  toggleOff: "var(--sq-toggle-off)",
} as const;

export const FONT = {
  display: "var(--font-sq-display), 'Archivo Black', sans-serif",
  sans: "var(--font-sq-sans), 'Archivo', sans-serif",
  mono: "var(--font-sq-mono), 'Spline Sans Mono', monospace",
} as const;

/** First-place accent: ember rank + subtle gradient row, else neutral. */
export function rankAccent(isFirst: boolean): { color: string; rowBg: string } {
  return {
    color: isFirst ? SQ.red : SQ.steel,
    rowBg: isFirst ? "linear-gradient(90deg,rgba(232,96,44,.14),transparent)" : "transparent",
  };
}

/** [text color, border color] */
export function matchStatusColors(s: MatchStatus): [string, string] {
  switch (s) {
    case "Live":
      return [SQ.ember, "rgba(232,96,44,.45)"];
    case "Scheduled":
      return [SQ.blue, "rgba(59,111,212,.45)"];
    case "Awaiting result":
      return [SQ.amber, "rgba(181,131,26,.5)"];
    default:
      return [SQ.mute, SQ.inputBorder];
  }
}

export function announcementTagColors(t: AnnouncementTag): [string, string] {
  switch (t) {
    case "RESULT":
      return [SQ.ember, "rgba(232,96,44,.45)"];
    case "LEAGUE":
      return [SQ.blue, "rgba(59,111,212,.45)"];
    default:
      return [SQ.slate, SQ.inputBorder];
  }
}
