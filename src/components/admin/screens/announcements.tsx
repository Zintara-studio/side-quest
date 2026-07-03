"use client";

import { useState } from "react";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { SearchableSelect, type SearchableSelectOption } from "@/components/sidequest/searchable-select";
import { MarkdownView } from "@/components/sidequest/markdown";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useGames,
  useMatches,
} from "@/lib/query/hooks";
import { announcementTagFor, shortDate } from "@/lib/adapters/league";
import type { RegistrationType } from "@/lib/api/types";

const fieldLabel = {
  fontFamily: FONT.mono,
  fontSize: 11,
  letterSpacing: ".16em",
  color: SQ.label,
} as const;

const inputBox = {
  width: "100%",
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "12px 14px",
  fontSize: 14,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

const CATEGORIES = ["GENERAL", "RESULT", "RECAP", "MATCH", "ROSTER"];

export function AnnouncementsScreen() {
  const list = useAnnouncements({ limit: 20 });
  const create = useCreateAnnouncement();
  const remove = useDeleteAnnouncement();
  const gamesQ = useGames(true);
  // All matches (not just SCHEDULED) so result / recap posts can point at a
  // LIVE, AWAITING_RESULT or COMPLETED fixture too.
  const matchesQ = useMatches({ limit: 50 });

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [gameId, setGameId] = useState("");
  const [registrationType, setRegistrationType] = useState<RegistrationType>("PLAYER");
  const [err, setErr] = useState<string | null>(null);

  const items = list.data?.items ?? [];
  const matches = matchesQ.data?.items ?? [];
  const selectedMatch = matches.find((m) => m.id === matchId);
  const matchOptions: SearchableSelectOption[] = [
    { value: "", label: "No linked match" },
    ...matches.map((m) => ({
      value: m.id,
      label: `${m.game?.name ?? "Match"} · ${shortDate(m.scheduledAt)} · ${m.matchType ?? "FRANCHISE"}`,
      hint: m.status,
    })),
  ];

  const onPublish = async () => {
    setErr(null);
    if (!title.trim() || !body.trim()) return;
    // A match announcement must point at a fixture (any status).
    if (category === "MATCH" && !matchId) {
      setErr("Pick the match this post is for.");
      return;
    }
    await create.mutateAsync({
      category,
      title: title.trim(),
      body: body.trim(),
      matchId: matchId || undefined,
      registrationOpen,
      gameId: registrationOpen && gameId ? gameId : undefined,
      registrationType: registrationOpen ? registrationType : undefined,
    });
    setTitle("");
    setBody("");
    setShowPreview(false);
    setMatchId("");
    setRegistrationOpen(false);
    setGameId("");
    setRegistrationType("PLAYER");
  };

  return (
    <div>
      <ScreenHeader eyebrow="Broadcast" title="ANNOUNCEMENTS" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        {/* composer */}
        <div
          style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 22 }}
        >
          <div style={{ ...fieldLabel, marginBottom: 8 }}>NEW POST · TITLE</div>
          <input
            className="sq-field"
            style={inputBox}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Register for BGMI — Match Day 6"
          />

          <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>CATEGORY</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: ".06em",
                  padding: "7px 11px",
                  borderRadius: 5,
                  cursor: "pointer",
                  color: category === c ? SQ.sidebar : SQ.faint,
                  background: category === c ? SQ.red : "transparent",
                  border: category === c ? "none" : `1px solid ${SQ.inputBorder}`,
                  fontWeight: category === c ? 600 : 400,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              margin: "18px 0 8px",
            }}
          >
            <div style={fieldLabel}>BODY</div>
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              disabled={!body.trim()}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: body.trim() ? SQ.ember : SQ.mute,
                background: "transparent",
                border: "none",
                cursor: body.trim() ? "pointer" : "not-allowed",
              }}
            >
              {showPreview ? "Edit" : "Preview"}
            </button>
          </div>
          {showPreview ? (
            <div style={{ ...inputBox, minHeight: 90, padding: "10px 14px" }}>
              {body.trim() ? (
                <MarkdownView content={body} />
              ) : (
                <span style={{ fontSize: 13, color: SQ.mute }}>Nothing to preview yet.</span>
              )}
            </div>
          ) : (
            <textarea
              className="sq-field"
              style={{ ...inputBox, minHeight: 90, lineHeight: 1.5, resize: "vertical" }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the announcement copy…  (Markdown supported)"
            />
          )}
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute, marginTop: 6 }}>
            Markdown supported — headings, **bold**, lists, links.
          </div>

          {/* tie to a match (any status) */}
          <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>
            LINKED MATCH{category === "MATCH" ? " (REQUIRED)" : " (OPTIONAL)"}
          </div>
          <SearchableSelect
            value={matchId}
            onChange={setMatchId}
            options={matchOptions}
            placeholder="No linked match"
            searchPlaceholder="Search matches…"
          />
          {selectedMatch ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute, marginTop: 8 }}>
              {selectedMatch.matchType === "FFA"
                ? "FFA match — registrations from this post feed its player list."
                : "Franchise match — players are pulled from the participating franchises."}
            </div>
          ) : null}

          {/* registration call */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              margin: "18px 0 0",
              fontSize: 13,
              color: SQ.faint,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={registrationOpen}
              onChange={(e) => setRegistrationOpen(e.target.checked)}
              style={{ accentColor: SQ.red }}
            />
            This is a registration call (players can register from it)
          </label>

          {registrationOpen ? (
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ ...fieldLabel, marginBottom: 6 }}>GAME (OPTIONAL)</div>
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  style={{ ...inputBox, cursor: "pointer" }}
                >
                  <option value="">Season (no game)</option>
                  {(gamesQ.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ ...fieldLabel, marginBottom: 6 }}>KIND</div>
                <select
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value as RegistrationType)}
                  style={{ ...inputBox, cursor: "pointer" }}
                >
                  <option value="PLAYER">Solo player (FFA)</option>
                  <option value="SQUAD">Squad / team (FFA)</option>
                  <option value="FRANCHISE">Franchise (pre-season)</option>
                </select>
              </div>
            </div>
          ) : null}

          {err ? (
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginTop: 12 }}>{err}</div>
          ) : null}

          <button
            type="button"
            onClick={onPublish}
            disabled={create.isPending || !title.trim() || !body.trim()}
            style={{
              width: "100%",
              marginTop: 18,
              textAlign: "center",
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              padding: 13,
              borderRadius: 5,
              cursor: create.isPending ? "not-allowed" : "pointer",
              opacity: create.isPending || !title.trim() || !body.trim() ? 0.6 : 1,
            }}
          >
            {create.isPending ? "Publishing…" : "Publish ▸"}
          </button>
        </div>

        {/* published list */}
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              letterSpacing: ".2em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Published
          </div>
          {list.isLoading ? (
            <StateNote>Loading…</StateNote>
          ) : items.length === 0 ? (
            <StateNote>No announcements yet.</StateNote>
          ) : (
            items.map((a) => {
              const tag = announcementTagFor(a.category);
              const [tagColor, tagBorder] = announcementTagColors(tag);
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "15px 16px",
                    background: SQ.panel,
                    border: `1px solid ${SQ.hairline}`,
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".12em",
                      color: a.registrationOpen ? SQ.ember : tagColor,
                      border: `1px solid ${a.registrationOpen ? "rgba(232,96,44,.45)" : tagBorder}`,
                      padding: "4px 8px",
                      borderRadius: 4,
                      width: 80,
                      textAlign: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    {a.registrationOpen ? "REGISTER" : tag}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, marginTop: 2 }}>
                      {shortDate(a.publishedAt)}
                      {a.gameName ? ` · ${a.gameName}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this announcement?")) remove.mutate(a.id);
                    }}
                    disabled={remove.isPending}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: SQ.ember,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
