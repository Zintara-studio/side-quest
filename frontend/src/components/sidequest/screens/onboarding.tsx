"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";
import { Avatar } from "../avatar";
import { StateNote } from "../state-note";
import { useAuth } from "@/lib/auth/context";
import { usePlayer, useOnboard, useUsernameAvailability, useUploadMedia } from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { ImageCropper } from "../image-cropper";
import { validateUsername, USERNAME_MIN } from "@/lib/username";

const label = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".14em",
  textTransform: "uppercase" as const,
  color: SQ.label,
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: SQ.inset,
  border: `1px solid ${SQ.field}`,
  borderRadius: 6,
  padding: "11px 13px",
  fontSize: 14,
  color: SQ.ink,
  fontFamily: FONT.sans,
};

function Field({ children, htmlLabel, hint }: { children: React.ReactNode; htmlLabel: string; hint?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={label}>{htmlLabel}</span>
        {hint ? <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.steel }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const { playerId, onboardingRequired, hydrated, refreshUser, logout } = useAuth();
  const playerQ = usePlayer(playerId ?? undefined);
  const onboard = useOnboard();
  const uploadMedia = useUploadMedia();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState("");
  const [debounced, setDebounced] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const seeded = useRef(false);

  // Seed the pre-fillable fields from what Google gave us (stored on the player at signup) — once.
  useEffect(() => {
    if (seeded.current || !playerQ.data) return;
    seeded.current = true;
    if (playerQ.data.realName) setRealName(playerQ.data.realName);
    if (playerQ.data.avatarUrl) setAvatarUrl(playerQ.data.avatarUrl);
  }, [playerQ.data]);

  // Debounce the username before hitting the availability endpoint (avoids a request per keystroke).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(username), 400);
    return () => clearTimeout(t);
  }, [username]);

  // If somehow this page is reached by an already-onboarded user, send them home.
  useEffect(() => {
    if (hydrated && !onboardingRequired) router.replace("/");
  }, [hydrated, onboardingRequired, router]);

  const formatError = username.trim() ? validateUsername(username) : null;
  const availQ = useUsernameAvailability(formatError ? "" : debounced);
  const checking = !formatError && debounced.trim().length >= USERNAME_MIN && availQ.isFetching;
  const available = !formatError && availQ.data?.available === true && debounced === username;
  const takenReason =
    !formatError && availQ.data && !availQ.data.available && debounced === username ? availQ.data.reason : null;

  const canSubmit = !formatError && available && !onboard.isPending;

  const onCropped = async (dataUrl: string) => {
    setCropFile(null);
    setError(null);
    setImgBusy(true);
    try {
      const res = await uploadMedia.mutateAsync({ data: dataUrl, kind: "avatar" });
      setAvatarUrl(res.url);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't process that image."));
    } finally {
      setImgBusy(false);
    }
  };

  const onSubmit = async () => {
    const reason = validateUsername(username);
    if (reason) {
      setError(reason);
      return;
    }
    setError(null);
    try {
      await onboard.mutateAsync({
        gamerTag: username.trim(),
        // Send the avatar as-is: an unchanged Google URL is kept server-side; an uploaded /media ref
        // is accepted. Empty string clears it.
        avatarUrl: avatarUrl ?? "",
        realName: realName.trim() || "",
        phone: phone.trim() || "",
        region: region.trim() || "",
        bio: bio.trim() || "",
        contactEmail: contactEmail.trim() || "",
        // Contact fields stay private by default — the user opts into visibility later from their profile.
      });
      await refreshUser();
      router.replace("/");
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't finish setting up your account. Please try again."));
    }
  };

  const usernameBorder = formatError || takenReason ? SQ.ember : available ? SQ.green : SQ.field;

  return (
    <>
    <div style={{ minHeight: "100vh", background: SQ.bg, color: SQ.ink, fontFamily: FONT.sans }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "clamp(28px,6vh,64px) clamp(16px,5vw,28px) 80px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <LeagueTitle eyebrow="One last step" title="COMPLETE YOUR ACCOUNT" />
        </div>

        <div
          style={{
            background: SQ.panel,
            border: `1px solid ${SQ.hairline}`,
            borderRadius: 12,
            padding: "clamp(20px,4vw,30px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 13.5, color: SQ.mute, lineHeight: 1.6 }}>
            Welcome to Side Quest. Choose your public username to finish creating your account — everything
            else is optional and stays private unless you share it later.
          </div>

          {/* avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar url={avatarUrl} alt={username || "you"} size={64} />
            <div>
              <div style={label}>Profile picture</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
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
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCropFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* username (required) */}
          <Field htmlLabel="Username" hint="Can't be changed later">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. NightHawk"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ ...input, border: `1px solid ${usernameBorder}` }}
            />
            <div style={{ marginTop: 6, fontFamily: FONT.mono, fontSize: 11, minHeight: 15 }}>
              {formatError ? (
                <span style={{ color: SQ.ember }}>{formatError}</span>
              ) : checking ? (
                <span style={{ color: SQ.steel }}>Checking availability…</span>
              ) : available ? (
                <span style={{ color: SQ.green }}>✓ {username} is available</span>
              ) : takenReason ? (
                <span style={{ color: SQ.ember }}>{takenReason}</span>
              ) : (
                <span style={{ color: SQ.steel }}>Your public handle across the league. Letters, numbers, . _ -</span>
              )}
            </div>
          </Field>

          {/* optional fields */}
          <Field htmlLabel="Real name" hint="Private · optional">
            <input value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="Full name" style={input} />
          </Field>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <Field htmlLabel="Phone" hint="Private · optional">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" style={input} />
            </Field>
            <Field htmlLabel="Region" hint="Optional">
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Bangalore" style={input} />
            </Field>
          </div>

          <Field htmlLabel="Contact email" hint="Private · optional">
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Where teams can reach you"
              style={input}
            />
          </Field>

          <Field htmlLabel="Bio" hint="Optional">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line about you…"
              rows={3}
              style={{ ...input, resize: "vertical", minHeight: 68 }}
            />
          </Field>

          {error ? <StateNote tone="error">{error}</StateNote> : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "13px 18px",
              borderRadius: 7,
              border: "none",
              color: SQ.sidebar,
              background: canSubmit ? SQ.red : SQ.inputBorder,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {onboard.isPending ? "Creating account…" : "Create account ▸"}
          </button>

          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.steel, textAlign: "center" }}>
            You can add your games and edit private details anytime from your profile.
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12.5, color: SQ.mute }}>
          Not you?{" "}
          <button
            type="button"
            onClick={() => logout()}
            style={{ background: "none", border: "none", color: SQ.ember, cursor: "pointer", font: "inherit", padding: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
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
