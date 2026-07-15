"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { Avatar } from "@/components/sidequest/avatar";
import { useAuth, apiErrorMessage } from "@/lib/auth/context";
import { useAdminOverview, useCurrentSeason, useUploadMedia } from "@/lib/query/hooks";
import { adminApi } from "@/lib/api/endpoints";
import { compressImage, IMAGE_PRESETS } from "@/lib/image";

const tile = {
  padding: "18px 22px",
  borderRight: `1px solid ${SQ.hairlineCell}`,
  borderBottom: `1px solid ${SQ.hairlineCell}`,
} as const;
const tileLabel = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label } as const;
const tileValue = { fontFamily: FONT.display, fontSize: 30, letterSpacing: "-.02em", marginTop: 5 } as const;

const linkBtn = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: SQ.faint,
  border: `1px solid ${SQ.inputBorder}`,
  padding: "11px 16px",
  borderRadius: 5,
  textDecoration: "none",
} as const;

export function AdminProfileScreen() {
  const { user, logout } = useAuth();
  const overviewQ = useAdminOverview();
  const seasonQ = useCurrentSeason();
  const t = overviewQ.data?.totals;

  return (
    <div>
      <ScreenHeader eyebrow="Your account" title="LEAGUE ADMIN" />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 22,
          alignItems: "center",
          marginTop: 18,
          paddingBottom: 26,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        <AdminAvatar />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".16em", color: SQ.red }}>
            {user?.role ?? "ADMIN"}
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: "clamp(34px,5vw,52px)",
              lineHeight: 0.92,
              letterSpacing: "-.03em",
              marginTop: 8,
            }}
          >
            {user?.name ?? "League Admin"}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: ".1em", color: SQ.mute, marginTop: 10 }}>
            {user?.email ?? ""}
            {seasonQ.data ? ` · ${seasonQ.data.name}` : " · between seasons"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: SQ.ember,
            background: "transparent",
            border: "1px solid rgba(232,96,44,.45)",
            padding: "11px 16px",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>

      {overviewQ.isLoading ? (
        <div style={{ marginTop: 24 }}>
          <StateNote>Loading league snapshot…</StateNote>
        </div>
      ) : t ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 8,
            overflow: "hidden",
            marginTop: 26,
          }}
        >
          <div style={tile}>
            <div style={tileLabel}>PLAYERS</div>
            <div style={tileValue}>{t.players}</div>
          </div>
          <div style={tile}>
            <div style={tileLabel}>FRANCHISES</div>
            <div style={tileValue}>{t.franchises}</div>
          </div>
          <div style={tile}>
            <div style={tileLabel}>MATCHES</div>
            <div style={tileValue}>{t.matches}</div>
          </div>
          <div style={tile}>
            <div style={tileLabel}>GAMES</div>
            <div style={tileValue}>{t.games}</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
        <Link href="/admin/history" style={linkBtn}>Season history ▸</Link>
        <Link href="/admin/settings" style={linkBtn}>League settings ▸</Link>
        <Link href="/admin" style={linkBtn}>Control room ▸</Link>
      </div>
    </div>
  );
}

/**
 * The admin's profile picture + upload control. An admin with a player profile (an appointed admin)
 * manages their photo on their player page — their player avatar wins on display — so for them this
 * links there instead of offering a second, ineffective uploader. An admin WITHOUT a player (the league
 * admin) uploads their account-level avatar here.
 */
function AdminAvatar() {
  const { avatarUrl, playerId, gamerTag, refreshUser } = useAuth();
  const uploadMedia = useUploadMedia();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (mediaUrl: string) => {
    setError(null);
    try {
      await adminApi.updateAvatar(mediaUrl);
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't update your photo."));
    }
  };

  const onPick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, IMAGE_PRESETS.avatar);
      const res = await uploadMedia.mutateAsync({ data: dataUrl, kind: "avatar" });
      await save(res.url);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't process that image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <Avatar url={avatarUrl} alt="Your avatar" size={84} />
      {playerId ? (
        // Appointed admin: their player avatar is authoritative — send them there.
        <Link
          href={gamerTag ? `/player/${encodeURIComponent(gamerTag)}` : "/player"}
          style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".08em", color: SQ.ember, textDecoration: "none" }}
        >
          Edit on profile ▸
        </Link>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || uploadMedia.isPending}
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: ".08em",
              color: SQ.faint,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 5,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {busy || uploadMedia.isPending ? "…" : avatarUrl ? "Change" : "Upload"}
          </button>
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => save("")}
              disabled={busy}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".08em",
                color: SQ.mute,
                background: "transparent",
                border: `1px solid ${SQ.inputBorder}`,
                borderRadius: 5,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: SQ.ember, maxWidth: 120, textAlign: "center" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
