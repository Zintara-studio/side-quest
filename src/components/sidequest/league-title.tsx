import { SQ, FONT } from "./tokens";

/** Eyebrow + oversized display title used across the league screens. */
export function LeagueTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: SQ.red,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(40px,6vw,68px)",
          lineHeight: 0.92,
          letterSpacing: "-.03em",
          marginTop: 12,
        }}
      >
        {title}
      </div>
    </>
  );
}
