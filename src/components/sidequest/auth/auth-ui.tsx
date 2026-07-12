"use client";

import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { SQ, FONT } from "../tokens";
import { useAuth } from "@/lib/auth/context";
import { safeNextPath } from "@/lib/nav";

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
  reveal = false,
  ...props
}: { label: string; reveal?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "style">) {
  const [show, setShow] = useState(false);
  const type = reveal ? (show ? "text" : "password") : props.type;
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={fieldLabel}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          className="sq-field"
          {...props}
          type={type}
          style={{
            width: "100%",
            marginTop: 8,
            background: SQ.inset,
            border: `1px solid ${SQ.field}`,
            borderRadius: 5,
            padding: "12px 14px",
            paddingRight: reveal ? 62 : 14,
            fontSize: 14,
            color: SQ.ink,
            fontFamily: FONT.sans,
          }}
        />
        {reveal ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 8,
              top: "calc(50% + 4px)",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: FONT.mono,
              fontSize: 10.5,
              letterSpacing: ".1em",
              color: SQ.ember,
              padding: "4px 6px",
            }}
          >
            {show ? "HIDE" : "SHOW"}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function AuthSubmit({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
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
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Inline form-level error banner shown above the submit button. */
export function AuthError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      style={{
        margin: "0 0 14px",
        padding: "10px 12px",
        borderRadius: 5,
        background: "rgba(232,96,44,.10)",
        border: `1px solid ${SQ.red}`,
        color: SQ.ember,
        fontSize: 12.5,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
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

/**
 * Whether any social sign-in provider is configured (Google is the only one wired). Callers use this
 * to hide the OR divider + social section entirely when there's nothing to show, so the divider never
 * dangles over an empty block. Build-time constant — NEXT_PUBLIC_* is inlined by Next.
 */
export const hasGoogleAuth = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** Minimal typing for the Google Identity Services global we load on demand. */
type GoogleId = {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string;
        callback: (r: { credential?: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};
const gis = () => (window as unknown as { google?: GoogleId }).google;

/**
 * Google Sign-In via Google Identity Services. The GIS SDK returns an id_token which we hand to the
 * backend (`/auth/google`) to verify + exchange for a real session — the frontend never signs or trusts
 * a token itself. The button only renders when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, so dev without
 * Google credentials just hides it.
 */
export function SocialRow() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const { googleLogin } = useAuth();
  const router = useRouter();
  const btnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const SRC = "https://accounts.google.com/gsi/client";
    let cancelled = false;

    // (Re)draw the button for the CURRENT site theme. GIS renders inside a locked shadow DOM we
    // can't token-theme, so the closest we can do is pick its dark/light variant so it doesn't sit
    // as a bright white block on the espresso theme. We read data-theme live (set pre-paint by the
    // root-layout script, so it's correct on first render) and clear the container first — GIS
    // *appends*, so re-rendering on a theme flip would otherwise stack a second button.
    const drawButton = () => {
      const g = gis();
      if (cancelled || !g?.accounts?.id || !btnRef.current) return;
      const dark = document.documentElement.dataset.theme === "dark";
      btnRef.current.innerHTML = "";
      g.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        theme: dark ? "filled_black" : "outline",
        shape: "pill",
        size: "large",
        text: "continue_with",
        width: 300,
      });
    };

    const init = () => {
      const g = gis();
      if (cancelled || !g?.accounts?.id || !btnRef.current) return;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          if (!resp.credential) return;
          try {
            const role = await googleLogin(resp.credential);
            const safe = safeNextPath(new URLSearchParams(window.location.search).get("next"));
            router.push(safe ?? (role === "ADMIN" ? "/admin" : "/"));
          } catch {
            /* invalid/rejected token — stay on the page */
          }
        },
      });
      drawButton();
    };

    // useTheme() is isolated per-hook (local state, no shared store), so a toggle in the nav can't
    // notify us through React. Watch the shared source of truth instead — the data-theme attribute
    // on <html> — and redraw the button in the matching variant whenever it flips.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.attributeName === "data-theme")) drawButton();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing && gis()?.accounts?.id) {
      init();
    } else if (existing) {
      existing.addEventListener("load", init);
    } else {
      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [clientId, googleLogin, router]);

  // No social providers configured (Google is the only one wired) → render nothing so the caller's
  // OR divider doesn't dangle over an empty block. Discord isn't offered: there is no Discord auth
  // backend, and a permanently-disabled "Coming soon" button reads as unfinished UI.
  if (!clientId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <div ref={btnRef} style={{ minHeight: 44 }} />
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
