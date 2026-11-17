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
/** The multi-colour Google "G", inline so it renders on any themed background without an asset request. */
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden style={{ flex: "0 0 auto" }}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function SocialRow() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const { googleLogin } = useAuth();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null); // relative box holding both buttons
  const gisRef = useRef<HTMLDivElement | null>(null); // where Google's real (transparent) button mounts

  useEffect(() => {
    if (!clientId) return;
    const SRC = "https://accounts.google.com/gsi/client";
    let cancelled = false;

    // We render Google's OWN button but keep it fully transparent and stretched over our custom,
    // theme-token-styled button below. Google Identity Services renders inside a locked shadow DOM whose
    // chrome we can't restyle — even `filled_black` still paints the "G" on a bright white tile that
    // clashes with the espresso theme. So we hide Google's button and show our own, while its invisible
    // hit-area still runs the exact same secure id_token flow — no backend/contract change. We size the
    // transparent button to our container so the whole visible button is clickable.
    const drawButton = () => {
      const g = gis();
      if (cancelled || !g?.accounts?.id || !gisRef.current || !wrapRef.current) return;
      const width = Math.min(400, Math.max(200, Math.round(wrapRef.current.offsetWidth)));
      gisRef.current.innerHTML = ""; // GIS appends — clear before re-rendering so buttons don't stack
      g.accounts.id.renderButton(gisRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        width,
      });
    };

    const init = () => {
      const g = gis();
      if (cancelled || !g?.accounts?.id) return;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          if (!resp.credential) return;
          try {
            const { role, onboardingRequired } = await googleLogin(resp.credential);
            // A first-time Google user must pick a username + complete their profile before anything else.
            if (onboardingRequired) {
              router.push("/onboarding");
              return;
            }
            const safe = safeNextPath(new URLSearchParams(window.location.search).get("next"));
            router.push(safe ?? (role === "ADMIN" ? "/admin" : "/"));
          } catch {
            /* invalid/rejected token — stay on the page */
          }
        },
      });
      drawButton();
    };

    // Keep the invisible hit-area matched to our button's width as the layout resizes.
    const ro = new ResizeObserver(() => drawButton());
    if (wrapRef.current) ro.observe(wrapRef.current);

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
      ro.disconnect();
    };
  }, [clientId, googleLogin, router]);

  // No social providers configured (Google is the only one wired) → render nothing so the caller's
  // OR divider doesn't dangle over an empty block. Discord isn't offered: there is no Discord auth
  // backend, and a permanently-disabled "Coming soon" button reads as unfinished UI.
  if (!clientId) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: 44 }}>
      {/* Our themed button — presentational only; the transparent Google button on top takes the click. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 11,
          borderRadius: 8,
          border: `1px solid ${SQ.inputBorder}`,
          background: SQ.inset,
          color: SQ.ink,
          fontFamily: FONT.sans,
          fontSize: 14,
          fontWeight: 600,
          pointerEvents: "none",
        }}
      >
        <GoogleGlyph />
        Continue with Google
      </div>
      {/* Google's real button: same box, fully transparent, still receives the click and runs the flow. */}
      <div
        ref={gisRef}
        aria-label="Continue with Google"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: "pointer",
        }}
      />
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
