import { SQ } from "./tokens";

/** Visual on/off switch matching the Broadcast HUD spec (38×22 track, 18px knob). */
export function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: on ? SQ.red : "rgba(255,255,255,.14)",
        position: "relative",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: SQ.ink,
        }}
      />
    </div>
  );
}
