"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SQ, FONT } from "../tokens";
import { Modal } from "../modal";
import { Avatar } from "../avatar";
import { useGames, usePlayerUsernames, useUpdateProfile, useUploadMedia } from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { ImageCropper } from "../image-cropper";
import { ranksFor } from "@/lib/ranks";
import type { PlayerDetail, ProfileGameEntry } from "@/lib/api/types";

const label = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: SQ.label,
} as const;

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: SQ.inset,
  border: `1px solid ${SQ.field}`,
  borderRadius: 5,
  padding: "10px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

const mini = { ...input, padding: "8px 10px", fontSize: 13 } as const;

const miniLabel = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.label,
  width: 52,
  flex: "0 0 auto",
} as const;

/** PUBLIC / PRIVATE pill toggle, mirroring the game-handle chip used on the player profile. */
function PrivacyToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        letterSpacing: ".1em",
        padding: "6px 10px",
        borderRadius: 4,
        cursor: "pointer",
        flex: "0 0 auto",
        color: value ? SQ.green : SQ.mute,
        border: `1px solid ${value ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
        background: "transparent",
      }}
      aria-pressed={value}
    >
      {value ? "PUBLIC" : "PRIVATE"}
    </button>
  );
}

interface GameRow {
  gameId: string;
  gameName: string;
  rating: number;
  handle: string;
  handlePublic: boolean;
  rankTier: string;
  kd: string;
  accountLevel: string;
}

const clampRating = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0);

/**
 * Owner/admin profile editor. Edits region/bio, an avatar image, the private contact fields with
 * per-field public/private toggles, and per-game skill + handle (with per-handle privacy). The
 * username (gamerTag) and account email are claimed at signup and shown read-only. Everything is
 * saved through the shared writer via PATCH /players/{id}.
 */
export function ProfileEditor({ player, onClose }: { player: PlayerDetail; onClose: () => void }) {
  const gamesQ = useGames(true);
  // Owner/admin: this returns private handles too, so we can prefill + toggle them.
  const usernamesQ = usePlayerUsernames(player.id);
  const updateProfile = useUpdateProfile();
  const uploadMedia = useUploadMedia();
  const { user, playerId } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Username (gamerTag) and account email are claimed at signup and immutable — shown read-only.
  // The account email lives on the auth session, so only surface it when editing your own profile.
  const isOwnProfile = playerId != null && playerId === player.id;
  const accountEmail = isOwnProfile ? user?.email : undefined;

  const [region, setRegion] = useState(player.region ?? "");
  const [bio, setBio] = useState(player.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(player.avatarUrl);
  const [realName, setRealName] = useState(player.realName ?? "");
  const [phone, setPhone] = useState(player.phone ?? "");
  // Contact email is a separate, publishable address (distinct from the login email). Prefill it with
  // the account email on your own profile so it isn't an empty field asking for the same thing again.
  const [contactEmail, setContactEmail] = useState(player.contactEmail ?? accountEmail ?? "");
  const [realNamePublic, setRealNamePublic] = useState(player.realNamePublic);
  const [phonePublic, setPhonePublic] = useState(player.phonePublic);
  const [contactEmailPublic, setContactEmailPublic] = useState(player.contactEmailPublic);

  const [rows, setRows] = useState<GameRow[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [addGameId, setAddGameId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Seed the per-game rows once from the profile's proficiencies + handles (handles carry privacy).
  useEffect(() => {
    if (seeded || usernamesQ.isLoading) return;
    const handleByGame = new Map((usernamesQ.data ?? []).map((u) => [u.gameId, u]));
    const nameByGame = new Map<string, string>();
    player.proficiencies.forEach((p) => nameByGame.set(p.gameId, p.gameName));
    (usernamesQ.data ?? []).forEach((u) => nameByGame.set(u.gameId, u.gameName));

    const ids = new Set<string>([
      ...player.proficiencies.map((p) => p.gameId),
      ...(usernamesQ.data ?? []).map((u) => u.gameId),
    ]);
    const initial: GameRow[] = [...ids].map((gameId) => {
      const prof = player.proficiencies.find((p) => p.gameId === gameId);
      const handle = handleByGame.get(gameId);
      return {
        gameId,
        gameName: nameByGame.get(gameId) ?? gameId,
        rating: prof?.rating ?? 50,
        handle: handle?.handle ?? "",
        handlePublic: handle?.isPublic ?? true,
        rankTier: prof?.rankTier ?? "",
        kd: prof?.kd != null ? String(prof.kd) : "",
        accountLevel: prof?.accountLevel != null ? String(prof.accountLevel) : "",
      };
    });
    setRows(initial);
    setSeeded(true);
  }, [seeded, usernamesQ.isLoading, usernamesQ.data, player.proficiencies]);

  const addableGames = useMemo(
    () => (gamesQ.data ?? []).filter((g) => !rows.some((r) => r.gameId === g.id)),
    [gamesQ.data, rows],
  );

  const patchRow = (gameId: string, patch: Partial<GameRow>) =>
    setRows((cur) => cur.map((r) => (r.gameId === gameId ? { ...r, ...patch } : r)));

  const addGame = () => {
    const g = (gamesQ.data ?? []).find((x) => x.id === addGameId);
    if (!g) return;
    setRows((cur) => [
      ...cur,
      { gameId: g.id, gameName: g.name, rating: 50, handle: "", handlePublic: true, rankTier: "", kd: "", accountLevel: "" },
    ]);
    setAddGameId("");
  };

  // The cropper returns an already-cropped-and-encoded data URL (1:1 for an avatar) — just upload it.
  const onCropped = async (dataUrl: string) => {
    setCropFile(null);
    setAvatarError(null);
    setImgBusy(true);
    try {
      const res = await uploadMedia.mutateAsync({ data: dataUrl, kind: "avatar" });
      setAvatarUrl(res.url);
    } catch (e) {
      setAvatarError(apiErrorMessage(e, "Couldn't process that image."));
    } finally {
      setImgBusy(false);
    }
  };

  const onSave = async () => {
    setError(null);
    const proficiencies: ProfileGameEntry[] = rows.map((r) => {
      const kd = parseFloat(r.kd);
      const lvl = parseInt(r.accountLevel, 10);
      return {
        gameId: r.gameId,
        rating: clampRating(r.rating),
        handle: r.handle.trim() || undefined,
        handlePublic: r.handlePublic,
        rankTier: r.rankTier.trim() || undefined,
        kd: Number.isFinite(kd) ? Math.max(0, kd) : undefined,
        accountLevel: Number.isFinite(lvl) ? Math.max(0, lvl) : undefined,
      };
    });
    try {
      await updateProfile.mutateAsync({
        id: player.id,
        body: {
          avatarUrl: avatarUrl ?? "",
          region,
          bio,
          realName,
          phone,
          contactEmail,
          realNamePublic,
          phonePublic,
          contactEmailPublic,
          proficiencies,
        },
      });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't save your profile. Please try again."));
    }
  };

  const busy = updateProfile.isPending;

  return (
    <>
    <Modal open title="Edit profile" onClose={busy ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
        {/* avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar url={avatarUrl} alt={player.gamerTag} size={72} />
          <div style={{ flex: 1 }}>
            <div style={label}>Profile picture</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imgBusy || uploadMedia.isPending}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".08em",
                  padding: "8px 12px",
                  borderRadius: 5,
                  cursor: "pointer",
                  color: SQ.ink,
                  border: `1px solid ${SQ.inputBorder}`,
                  background: "transparent",
                }}
              >
                {imgBusy || uploadMedia.isPending ? "Processing…" : avatarUrl ? "Change" : "Upload"}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(undefined)}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    letterSpacing: ".08em",
                    padding: "8px 12px",
                    borderRadius: 5,
                    cursor: "pointer",
                    color: SQ.mute,
                    border: `1px solid ${SQ.inputBorder}`,
                    background: "transparent",
                  }}
                >
                  Remove
                </button>
              ) : null}
              <span style={{ fontSize: 11.5, color: SQ.mute }}>PNG/JPG/WEBP · compressed automatically</span>
            </div>
            {avatarError ? (
              <div style={{ fontSize: 11.5, color: SQ.ember, marginTop: 6 }}>{avatarError}</div>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCropFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* identity — username is locked (claimed at signup); region stays editable alongside it */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 14,
          }}
        >
          <LockedField
            label="Username (gamer tag)"
            value={player.gamerTag}
            caption="Set at signup · can't be changed"
          />
          <Field label="Region">
            <input className="sq-field" style={input} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. IN" />
          </Field>
        </div>
        <LockedField label="Account email" value={accountEmail} caption="Set at signup · can't be changed" />
        <Field label="Bio">
          <textarea
            className="sq-field"
            style={{ ...input, minHeight: 70, lineHeight: 1.5, resize: "vertical" }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio shown on your public profile."
          />
        </Field>

        {/* contact + privacy */}
        <div style={{ ...label, marginTop: 4 }}>Contact · per-field privacy</div>
        <div style={{ fontSize: 11.5, color: SQ.mute, marginTop: -8 }}>
          Private fields are visible only to you, league admins, and your franchise&rsquo;s owner/manager.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gap: 14,
          }}
        >
          <ContactRow
            label="Real name"
            value={realName}
            onChange={setRealName}
            isPublic={realNamePublic}
            onPublic={setRealNamePublic}
            placeholder="Your real name"
          />
          <ContactRow
            label="Phone"
            value={phone}
            onChange={setPhone}
            isPublic={phonePublic}
            onPublic={setPhonePublic}
            placeholder="Contact number"
          />
          <ContactRow
            label="Contact email"
            value={contactEmail}
            onChange={setContactEmail}
            isPublic={contactEmailPublic}
            onPublic={setContactEmailPublic}
            placeholder="Contact email"
            type="email"
          />
        </div>

        {/* games */}
        <div style={{ ...label, marginTop: 4 }}>Game handles &amp; expertise</div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: SQ.mute }}>No games added yet.</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.gameId}
              style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 6, padding: "12px 14px", background: SQ.inset }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.gameName}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember }}>
                  {clampRating(r.rating)}
                  <span style={{ color: SQ.mute }}>/100</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ ...miniLabel }}>RATING</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={clampRating(r.rating)}
                  onChange={(e) => patchRow(r.gameId, { rating: clampRating(Number(e.target.value)) })}
                  style={{ flex: 1, accentColor: SQ.red, cursor: "pointer" }}
                />
                <input
                  className="sq-field"
                  type="number"
                  min={0}
                  max={100}
                  value={clampRating(r.rating)}
                  onChange={(e) => patchRow(r.gameId, { rating: clampRating(Number(e.target.value)) })}
                  style={{ ...mini, width: 66, flex: "0 0 auto" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ ...miniLabel }}>HANDLE</span>
                <input
                  className="sq-field"
                  style={{ ...mini, flex: 1 }}
                  value={r.handle}
                  onChange={(e) => patchRow(r.gameId, { handle: e.target.value })}
                  placeholder={`In-game name for ${r.gameName}`}
                />
                <PrivacyToggle value={r.handlePublic} onChange={(v) => patchRow(r.gameId, { handlePublic: v })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ ...miniLabel }}>RANK</span>
                {ranksFor(r.gameName) ? (
                  <select
                    className="sq-field"
                    value={r.rankTier}
                    onChange={(e) => patchRow(r.gameId, { rankTier: e.target.value })}
                    style={{ ...mini, flex: 1, minWidth: 140 }}
                  >
                    <option value="">— Rank (optional) —</option>
                    {ranksFor(r.gameName)!.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="sq-field"
                    style={{ ...mini, flex: 1, minWidth: 140 }}
                    value={r.rankTier}
                    onChange={(e) => patchRow(r.gameId, { rankTier: e.target.value })}
                    placeholder="Rank (optional)"
                  />
                )}
                <span style={{ ...miniLabel }}>K/D</span>
                <input
                  className="sq-field"
                  type="number"
                  min={0}
                  step="0.1"
                  style={{ ...mini, width: 80, flex: "0 0 auto" }}
                  value={r.kd}
                  onChange={(e) => patchRow(r.gameId, { kd: e.target.value })}
                  placeholder="2.4"
                />
                <span style={{ ...miniLabel }}>LVL</span>
                <input
                  className="sq-field"
                  type="number"
                  min={0}
                  style={{ ...mini, width: 80, flex: "0 0 auto" }}
                  value={r.accountLevel}
                  onChange={(e) => patchRow(r.gameId, { accountLevel: e.target.value })}
                  placeholder="150"
                />
              </div>
            </div>
          ))
        )}

        {addableGames.length > 0 ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="sq-field"
              value={addGameId}
              onChange={(e) => setAddGameId(e.target.value)}
              style={{ ...mini, flex: 1 }}
            >
              <option value="">Add a game…</option>
              {addableGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addGame}
              disabled={!addGameId}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                letterSpacing: ".08em",
                padding: "9px 13px",
                borderRadius: 5,
                cursor: addGameId ? "pointer" : "not-allowed",
                color: SQ.ink,
                border: `1px solid ${SQ.inputBorder}`,
                background: "transparent",
                opacity: addGameId ? 1 : 0.5,
              }}
            >
              + Add
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 5,
              background: "rgba(232,96,44,.10)",
              border: `1px solid ${SQ.red}`,
              color: SQ.ember,
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11.5,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "11px 16px",
              borderRadius: 5,
              cursor: busy ? "not-allowed" : "pointer",
              color: SQ.league,
              background: SQ.red,
              border: "none",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11.5,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "11px 16px",
              borderRadius: 5,
              cursor: busy ? "not-allowed" : "pointer",
              color: SQ.faint,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
    {cropFile ? (
      <ImageCropper
        file={cropFile}
        kind="avatar"
        onCancel={() => setCropFile(null)}
        onCropped={onCropped}
      />
    ) : null}
    </>
  );
}

function Field({
  label: text,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ ...label, marginBottom: 8 }}>{text}</div>
      {children}
    </div>
  );
}

/** Read-only, greyed field for immutable identity values (username, account email) set at signup. */
function LockedField({
  label: text,
  value,
  caption,
  style,
}: {
  label: string;
  value?: string;
  caption: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ ...label, marginBottom: 8 }}>{text}</div>
      <div
        style={{
          ...input,
          background: SQ.field,
          color: value ? SQ.faint : SQ.mute,
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "default",
        }}
        title={value || undefined}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || "—"}
        </span>
        <span
          aria-hidden
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: ".12em",
            color: SQ.mute,
            border: `1px solid ${SQ.inputBorder}`,
            borderRadius: 4,
            padding: "3px 7px",
            flex: "0 0 auto",
          }}
        >
          LOCKED
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: ".04em",
          color: SQ.mute,
          marginTop: 6,
        }}
      >
        {caption}
      </div>
    </div>
  );
}

function ContactRow({
  label: text,
  value,
  onChange,
  isPublic,
  onPublic,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isPublic: boolean;
  onPublic: (v: boolean) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ ...label, marginBottom: 6 }}>{text}</div>
        <input
          className="sq-field"
          type={type}
          style={input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <PrivacyToggle value={isPublic} onChange={onPublic} />
    </div>
  );
}
