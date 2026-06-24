import { SQ } from "./tokens";

/**
 * Visual on/off switch (38×22 track, 18px knob). When {@code onToggle} is provided it acts as a
 * button; otherwise it's a static indicator.
 */
export function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  const interactive = typeof onToggle === "function";
  return (
    <button
      type="button"
      onClick={interactive ? onToggle : undefined}
      disabled={!interactive || disabled}
      aria-pressed={on}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: on ? SQ.red : SQ.toggleOff,
        position: "relative",
        flex: "0 0 auto",
        border: "none",
        padding: 0,
        cursor: interactive && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
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
          background: "#FFFFFF",
          transition: "left .15s ease",
        }}
      />
    </button>
  );
}
