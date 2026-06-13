import type { ReactNode, InputHTMLAttributes } from "react";
import { SQ, FONT } from "../tokens";

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: SQ.panel,
        border: `1px solid ${SQ.hairline}`,
        borderRadius: 10,
        padding: "30px 28px",
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
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
          fontSize: "clamp(28px,5vw,38px)",
          lineHeight: 0.95,
          letterSpacing: "-.02em",
          marginTop: 10,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 13.5, color: SQ.mute, marginTop: 10, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      ) : null}
      <div style={{ marginTop: 24 }}>{children}</div>
    </div>
  );
}

export function AuthField({
  label,
  ...props
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "style">) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={fieldLabel}>{label}</div>
      <input
        className="sq-field"
        {...props}
        style={{
          width: "100%",
          marginTop: 8,
          background: SQ.inset,
          border: `1px solid ${SQ.field}`,
          borderRadius: 5,
          padding: "12px 14px",
          fontSize: 14,
          color: SQ.ink,
          fontFamily: FONT.sans,
        }}
      />
    </label>
  );
}

export function AuthSubmit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      style={{
        width: "100%",
        marginTop: 8,
        fontFamily: FONT.mono,
        fontSize: 12,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        fontWeight: 700,
        color: SQ.league,
        background: SQ.red,
        border: "none",
        padding: 13,
        borderRadius: 5,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function OrDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: SQ.hairline }} />
      <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".14em", color: SQ.dim }}>
        OR
      </span>
      <div style={{ flex: 1, height: 1, background: SQ.hairline }} />
    </div>
  );
}

const socialBtn = {
  width: "100%",
  fontFamily: FONT.mono,
  fontSize: 11.5,
  letterSpacing: ".08em",
  color: SQ.faint,
  background: "transparent",
  border: `1px solid ${SQ.inputBorder}`,
  padding: "12px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function SocialRow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" style={socialBtn}>
        Continue with Google
      </button>
      <button type="button" style={socialBtn}>
        Continue with Discord
      </button>
    </div>
  );
}

export function AuthFootnote({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 22, textAlign: "center", fontSize: 13, color: SQ.mute }}>
      {children}
    </div>
  );
}

/** Inline accent link used inside footnotes / rows. */
export const authLinkStyle = {
  color: SQ.ember,
  textDecoration: "none",
  fontWeight: 600,
} as const;
