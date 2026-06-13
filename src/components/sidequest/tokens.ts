// Side Quest "Broadcast HUD" design tokens — exact values from the design prototype.
// Shared by the player-facing league (`/league`) and the admin control room (`/admin`).
import type {
  MatchStatus,
  PlayerStatus,
  AnnouncementTag,
} from "@/lib/mock/admin";

export const SQ = {
  bg: "#0B0C0F", // admin canvas
  league: "#0E0F13", // player-facing canvas / form insets
  sidebar: "#0E0F13",
  panel: "#16181D",
  inset: "#0E0F13",
  ink: "#F2F1ED",
  red: "#FF3D2E",
  ember: "#FF6A5E",
  green: "#3FCF8E",
  amber: "#E0A82E",
  blue: "#7FB2FF",
  faint: "#C9C9CE", // light grey body text
  mute: "#8A8C93", // mid grey
  dim: "#6E7077", // table head grey
  label: "#7B7D84",
  steel: "#5A5C63",
  slate: "#9A9AA1", // inactive nav text
  hairline: "rgba(255,255,255,.09)",
  hairlineSoft: "rgba(255,255,255,.05)",
  hairlineFaint: "rgba(255,255,255,.06)",
  hairlineCell: "rgba(255,255,255,.07)",
  inputBorder: "rgba(255,255,255,.16)", // admin controls / chips
  field: "rgba(255,255,255,.14)", // league form-field & badge border
  avatar: "#262932",
  avatarBorder: "rgba(255,255,255,.12)",
} as const;

export const FONT = {
  display: "var(--font-sq-display), 'Archivo Black', sans-serif",
  sans: "var(--font-sq-sans), 'Archivo', sans-serif",
  mono: "var(--font-sq-mono), 'Spline Sans Mono', monospace",
} as const;

/** First-place accent: red rank + subtle gradient row, else neutral. */
export function rankAccent(isFirst: boolean): { color: string; rowBg: string } {
  return {
    color: isFirst ? SQ.red : SQ.steel,
    rowBg: isFirst ? "linear-gradient(90deg,rgba(255,61,46,.10),transparent)" : "transparent",
  };
}

/** [text color, border color] */
export function matchStatusColors(s: MatchStatus): [string, string] {
  switch (s) {
    case "Live":
      return [SQ.ember, "rgba(255,61,46,.4)"];
    case "Scheduled":
      return [SQ.blue, "rgba(120,150,255,.4)"];
    case "Awaiting result":
      return [SQ.amber, "rgba(224,168,46,.4)"];
    default:
      return [SQ.mute, "rgba(255,255,255,.16)"];
  }
}

export function playerStatusColors(s: PlayerStatus): [string, string] {
  switch (s) {
    case "Verified":
      return [SQ.green, "rgba(63,207,142,.4)"];
    case "Pending":
      return [SQ.amber, "rgba(224,168,46,.4)"];
    default:
      return [SQ.ember, "rgba(255,61,46,.4)"];
  }
}

export function announcementTagColors(t: AnnouncementTag): [string, string] {
  switch (t) {
    case "RESULT":
      return [SQ.ember, "rgba(255,61,46,.4)"];
    case "LEAGUE":
      return [SQ.blue, "rgba(120,150,255,.4)"];
    default:
      return [SQ.slate, "rgba(255,255,255,.18)"];
  }
}
