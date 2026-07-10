"use client";

import { useState } from "react";
import { SQ, FONT, announcementTagColors } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { SearchableSelect, type SearchableSelectOption } from "@/components/sidequest/searchable-select";
import { MarkdownView } from "@/components/sidequest/markdown";
import { ConfirmModal } from "@/components/sidequest/confirm-modal";
import { Modal } from "@/components/sidequest/modal";
import {
  useAnnouncementsInfinite,
  useCreateAnnouncement,
  useCloseAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
  useGames,
  useMatches,
} from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { announcementTagFor, shortDate } from "@/lib/adapters/league";
import type { AnnouncementView, RegistrationType } from "@/lib/api/types";

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

const CATEGORIES = ["GENERAL", "RESULT", "RECAP", "MATCH", "ROSTER", "AUCTION"];

// One-line explainer shown under the KIND picker so admins know what each registration call opens.
const KIND_HINTS: Record<RegistrationType, string> = {
  PLAYER: "Solo players sign up individually for the FFA lobby.",
  SQUAD: "Captains register a team and invite teammates from Side Quest.",
  FRANCHISE: "Owners propose a franchise; admins form the franchises before the season.",
  AUCTION:
    "Opens the exhaustive self-registration form — players declare per-game expertise (rating + handle) and feed the player auction pool.",
};

// Ready-made presets that prefill the composer's existing setters. `category`
// is always one of CATEGORIES; `registrationType` is only set on registration
// calls. Templates never touch matchId/gameId/showPreview.
type Template = {
  id: string;
  label: string;
  category: string;
  registrationOpen: boolean;
  registrationType?: RegistrationType;
  title: string;
  body: string;
};

const TEMPLATES: Template[] = [
  {
    id: "season-kickoff",
    label: "Season Kickoff",
    category: "GENERAL",
    registrationOpen: false,
    title: "Season __ is live",
    body: [
      "# Welcome to Season __",
      "",
      "The new season is officially underway. Here's what to know:",
      "",
      "- **Format:** __",
      "- **Kickoff:** __",
      "",
      "Good luck out there.",
    ].join("\n"),
  },
  {
    id: "match-day",
    label: "Match Day",
    category: "MATCH",
    registrationOpen: false,
    title: "Match Day __",
    body: [
      "## Match Day __ — Fixtures",
      "",
      "- __ vs __ — __ IST",
      "- __ vs __ — __ IST",
      "",
      "_Lobby details drop ~30 minutes before start._",
      "",
      "> Remember to link the fixture below before publishing.",
    ].join("\n"),
  },
  {
    id: "result-recap",
    label: "Result Recap",
    category: "RESULT",
    registrationOpen: false,
    title: "__ — Match Result",
    body: [
      "## __ — Match Result",
      "",
      "**Final:** __",
      "**Winner:** __",
      "",
      "| Placement | Team | Points |",
      "| --- | --- | --- |",
      "| 1 | __ | __ |",
      "| 2 | __ | __ |",
      "| 3 | __ | __ |",
    ].join("\n"),
  },
  {
    id: "reg-solo",
    label: "Registration Open — Solo",
    category: "GENERAL",
    registrationOpen: true,
    registrationType: "PLAYER",
    title: "Registration open — Solo",
    body: [
      "**Solo sign-ups open.**",
      "",
      "Register directly from this post to claim your spot in the FFA lobby.",
      "",
      "- **Game:** __",
      "- **Closes:** __",
    ].join("\n"),
  },
  {
    id: "reg-squad",
    label: "Registration Open — Squad",
    category: "GENERAL",
    registrationOpen: true,
    registrationType: "SQUAD",
    title: "Registration open — Squad",
    body: [
      "**Squad sign-ups open.**",
      "",
      "Captains: register your team and invite your roster from Side Quest.",
      "",
      "- **Game:** __",
      "- **Squad size:** __",
      "- **Closes:** __",
    ].join("\n"),
  },
  {
    id: "reg-franchise",
    label: "Franchise Call",
    category: "GENERAL",
    registrationOpen: true,
    registrationType: "FRANCHISE",
    title: "Franchise call",
    body: [
      "**Franchise applications open.**",
      "",
      "Owners: propose your franchise. Admins form the franchises before the season begins.",
      "",
      "- **Season:** __",
      "- **Closes:** __",
    ].join("\n"),
  },
  {
    id: "reg-auction",
    label: "Auction Call",
    category: "AUCTION",
    registrationOpen: true,
    registrationType: "AUCTION",
    title: "Auction call",
    body: [
      "**Enter the auction pool** — declare your per-game rating + handle.",
      "",
      "Fill the self-registration form so franchises can bid on you.",
      "",
      "- **Games + rating:** __",
      "- **In-game handle:** __",
      "- **Closes:** __",
    ].join("\n"),
  },
  {
    id: "roster-move",
    label: "Roster Move",
    category: "ROSTER",
    registrationOpen: false,
    title: "Roster Move — __",
    body: [
      "## Roster Move",
      "",
      "**Player:** __",
      "**From:** __ → **To:** __",
      "",
      "_Effective __._",
    ].join("\n"),
  },
  {
    id: "blank",
    label: "Blank / General Notice",
    category: "GENERAL",
    registrationOpen: false,
    title: "",
    body: "",
  },
];

export function AnnouncementsScreen() {
  const list = useAnnouncementsInfinite({ limit: 20 });
  const create = useCreateAnnouncement();
  const remove = useDeleteAnnouncement();
  const close = useCloseAnnouncement();
  const update = useUpdateAnnouncement();
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState<AnnouncementView | null>(null);
  // Inline editor for an existing post's content (title/body/category only — not its registration wiring).
  const [editing, setEditing] = useState<AnnouncementView | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("GENERAL");
  const [editBody, setEditBody] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
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
  // Roster cap for SQUAD registration calls — squads registering from this post can invite up to this many.
  const [teamSize, setTeamSize] = useState(5);
  const [err, setErr] = useState<string | null>(null);

  const items = (list.data?.pages ?? []).flatMap((p) => p.items);
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

  // Prefill the composer from a preset. Only touches the fields the preset
  // owns (category/title/body/registrationOpen [+ registrationType]); leaves
  // matchId/gameId alone. Confirm before clobbering a draft in progress.
  const commitTemplate = (t: Template) => {
    setCategory(t.category);
    setTitle(t.title);
    setBody(t.body);
    setRegistrationOpen(t.registrationOpen);
    if (t.registrationType) setRegistrationType(t.registrationType);
    setErr(null);
    setPendingTemplate(null);
  };
  const applyTemplate = (t: Template) => {
    // Confirm before clobbering a draft in progress (themed dialog, not native confirm).
    if (title.trim() || body.trim()) {
      setPendingTemplate(t);
    } else {
      commitTemplate(t);
    }
  };

  // Open the editor prefilled with the post's current content. Guarantee the current
  // category is a selectable option even if it isn't one of the composer's presets.
  const openEdit = (a: AnnouncementView) => {
    setEditing(a);
    setEditTitle(a.title);
    setEditBody(a.body);
    setEditCategory(a.category);
    setEditErr(null);
  };

  const onSaveEdit = () => {
    if (!editing) return;
    const title = editTitle.trim();
    const body = editBody.trim();
    if (!title || !body) {
      setEditErr("Title and body are required.");
      return;
    }
    setEditErr(null);
    update.mutate(
      { id: editing.id, body: { title, body, category: editCategory } },
      {
        onSuccess: () => setEditing(null),
        onError: (e) => setEditErr(apiErrorMessage(e, "Couldn't save changes.")),
      },
    );
  };

  const onPublish = async () => {
    setErr(null);
    if (!title.trim() || !body.trim()) return;
    // A match announcement must point at a fixture (any status).
    if (category === "MATCH" && !matchId) {
      setErr("Pick the match this post is for.");
      return;
    }
    // The backend now rejects a RESULT post with no linked fixture — block it here too.
    if (category === "RESULT" && !matchId) {
      setErr("Pick the match this result is for.");
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
      // Only meaningful for SQUAD calls — the roster cap squads must respect.
      teamSize:
        registrationOpen && registrationType === "SQUAD" ? Math.max(2, teamSize) : undefined,
    });
    setTitle("");
    setBody("");
    setShowPreview(false);
    setMatchId("");
    setRegistrationOpen(false);
    setGameId("");
    setRegistrationType("PLAYER");
    setTeamSize(5);
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
          <div style={{ ...fieldLabel, marginBottom: 8 }}>TEMPLATES</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: ".06em",
                  padding: "7px 11px",
                  borderRadius: 5,
                  cursor: "pointer",
                  color: SQ.faint,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  fontWeight: 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

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
            <div style={{ ...inputBox, minHeight: 260, padding: "10px 14px" }}>
              {body.trim() ? (
                <MarkdownView content={body} />
              ) : (
                <span style={{ fontSize: 13, color: SQ.mute }}>Nothing to preview yet.</span>
              )}
            </div>
          ) : (
            <textarea
              className="sq-field"
              style={{ ...inputBox, minHeight: 260, lineHeight: 1.5, resize: "vertical" }}
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
            LINKED MATCH{category === "MATCH" || category === "RESULT" ? " (REQUIRED)" : " (OPTIONAL)"}
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
                  <option value="AUCTION">Auction (pre-season)</option>
                </select>
              </div>
              {registrationType === "SQUAD" ? (
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ ...fieldLabel, marginBottom: 6 }}>SQUAD SIZE</div>
                  <input
                    className="sq-field"
                    type="number"
                    min={2}
                    value={teamSize}
                    onChange={(e) =>
                      setTeamSize(Math.max(2, Math.floor(Number(e.target.value) || 0)))
                    }
                    style={inputBox}
                  />
                </div>
              ) : null}
              <div
                style={{
                  flexBasis: "100%",
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: SQ.mute,
                }}
              >
                {KIND_HINTS[registrationType]}
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
                  {a.registrationOpen ? (
                    <button
                      type="button"
                      onClick={() => setPendingClose(a)}
                      disabled={close.isPending}
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: SQ.amber,
                        background: "transparent",
                        border: `1px solid ${SQ.inputBorder}`,
                        borderRadius: 5,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Close registration
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: SQ.faint,
                      background: "transparent",
                      border: `1px solid ${SQ.inputBorder}`,
                      borderRadius: 5,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(a.id)}
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

          {list.hasNextPage ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: SQ.faint,
                  background: "transparent",
                  border: `1px solid ${SQ.inputBorder}`,
                  borderRadius: 6,
                  padding: "10px 20px",
                  cursor: list.isFetchingNextPage ? "not-allowed" : "pointer",
                }}
              >
                {list.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={!!pendingTemplate}
        title="Replace draft"
        message="Replace the current draft with this template? Your unsaved title and body will be overwritten."
        confirmLabel="Replace"
        onConfirm={() => pendingTemplate && commitTemplate(pendingTemplate)}
        onClose={() => setPendingTemplate(null)}
      />
      <ConfirmModal
        open={!!pendingClose}
        title="Close registration"
        tone="destructive"
        message={
          pendingClose
            ? `Close registration for “${pendingClose.title}”? The Register button is removed everywhere${
                pendingClose.registrationType === "AUCTION"
                  ? " — existing pool entries stay in the auction pool."
                  : " and any still-open sign-ups are voided."
              }`
            : ""
        }
        confirmLabel="Close registration"
        busy={close.isPending}
        onConfirm={() =>
          pendingClose && close.mutate(pendingClose.id, { onSettled: () => setPendingClose(null) })
        }
        onClose={() => setPendingClose(null)}
      />
      <ConfirmModal
        open={!!pendingDelete}
        title="Delete announcement"
        tone="destructive"
        message="Delete this announcement? This permanently removes it from the league feed."
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={() =>
          pendingDelete && remove.mutate(pendingDelete, { onSettled: () => setPendingDelete(null) })
        }
        onClose={() => setPendingDelete(null)}
      />

      <Modal open={!!editing} title="Edit announcement" onClose={() => setEditing(null)}>
        <div style={{ ...fieldLabel, marginBottom: 8 }}>TITLE</div>
        <input
          className="sq-field"
          style={inputBox}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Announcement title"
        />

        <div style={{ ...fieldLabel, margin: "16px 0 8px" }}>CATEGORY</div>
        <select
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          style={{ ...inputBox, cursor: "pointer" }}
        >
          {(CATEGORIES.includes(editCategory) ? CATEGORIES : [editCategory, ...CATEGORIES]).map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ),
          )}
        </select>

        <div style={{ ...fieldLabel, margin: "16px 0 8px" }}>BODY</div>
        <textarea
          className="sq-field"
          style={{ ...inputBox, minHeight: 220, lineHeight: 1.5, resize: "vertical" }}
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="Write the announcement copy…  (Markdown supported)"
        />

        {editErr ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginTop: 12 }}>
            {editErr}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => setEditing(null)}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: SQ.faint,
              background: "transparent",
              border: `1px solid ${SQ.inputBorder}`,
              borderRadius: 5,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={update.isPending || !editTitle.trim() || !editBody.trim()}
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              borderRadius: 5,
              padding: "10px 18px",
              cursor: update.isPending ? "not-allowed" : "pointer",
              opacity: update.isPending || !editTitle.trim() || !editBody.trim() ? 0.6 : 1,
            }}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
