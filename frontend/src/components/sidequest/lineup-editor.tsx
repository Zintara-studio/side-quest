"use client";

import { useEffect, useMemo, useState } from "react";
import { SQ, FONT } from "./tokens";
import { Modal } from "./modal";
import { StateNote } from "./state-note";
import { useFranchiseRoster, useMatchLineups, useSetLineup } from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/auth/context";

/**
 * Shared modal to set a franchise's fielded LINEUP for a match — pick which roster players are
 * playing this fixture. Used by the /my/franchise portal (owner/manager) and the admin matches
 * screen. Persisting an empty selection clears the lineup (reverts to the full-roster fallback).
 */
export function LineupEditor({
  open,
  matchId,
  franchiseId,
  franchiseTag,
  onClose,
}: {
  open: boolean;
  matchId: string;
  franchiseId: string;
  franchiseTag?: string;
  onClose: () => void;
}) {
  const rosterQ = useFranchiseRoster(open ? franchiseId : undefined);
  const lineupsQ = useMatchLineups(open ? matchId : undefined);
  const setLineup = useSetLineup();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const currentLineup = useMemo(
    () => lineupsQ.data?.find((l) => l.franchiseId === franchiseId)?.lineup ?? [],
    [lineupsQ.data, franchiseId],
  );

  // Seed the selection from the saved lineup once loaded (once per open).
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(currentLineup.map((p) => p.playerId)));
    setSearch("");
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lineupsQ.data]);

  const roster = rosterQ.data ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? roster.filter(
        (m) =>
          m.gamerTag.toLowerCase().includes(q) ||
          (m.realName ? m.realName.toLowerCase().includes(q) : false),
      )
    : roster;
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setErr(null);
    try {
      await setLineup.mutateAsync({ id: matchId, franchiseId, playerIds: [...selected] });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't save the lineup."));
    }
  };

  return (
    <Modal open={open} title={`Set lineup${franchiseTag ? ` · ${franchiseTag}` : ""}`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: SQ.mute, lineHeight: 1.5, marginBottom: 14 }}>
        Choose the players fielding this match. Unselected roster players sit this one out. Leaving
        none selected falls back to the whole roster.
      </div>

      {rosterQ.isLoading || lineupsQ.isLoading ? (
        <StateNote>Loading roster…</StateNote>
      ) : roster.length === 0 ? (
        <StateNote tone="muted">This franchise has no roster players yet.</StateNote>
      ) : (
        <>
          <input
            className="sq-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by handle or real name…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 10,
              background: SQ.inset,
              border: `1px solid ${SQ.field}`,
              borderRadius: 5,
              padding: "9px 12px",
              fontSize: 13,
              color: SQ.ink,
              fontFamily: FONT.sans,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <StateNote tone="muted">No players match “{search}”.</StateNote>
            ) : (
              filtered.map((m) => {
                const on = selected.has(m.playerId);
                const realName = m.realName && m.realName.trim() ? m.realName : null;
                return (
                  <button
                    key={m.playerId}
                    type="button"
                    onClick={() => toggle(m.playerId)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${on ? SQ.red : SQ.inputBorder}`,
                      background: on ? "rgba(232,96,44,.08)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `1.5px solid ${on ? SQ.red : SQ.inputBorder}`,
                        background: on ? SQ.red : "transparent",
                        color: SQ.sidebar,
                        fontSize: 11,
                        lineHeight: "14px",
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{ display: "block", fontSize: 14, fontWeight: on ? 700 : 500, color: SQ.ink }}
                      >
                        {m.gamerTag}
                      </span>
                      {realName ? (
                        <span
                          style={{ display: "block", fontSize: 11.5, color: SQ.mute, marginTop: 1 }}
                        >
                          {realName}
                        </span>
                      ) : null}
                      {m.tags && m.tags.length ? (
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {m.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontFamily: FONT.mono,
                                fontSize: 9,
                                letterSpacing: ".04em",
                                color: SQ.ember,
                                border: `1px solid rgba(232,96,44,.4)`,
                                borderRadius: 999,
                                padding: "2px 7px",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {err ? (
        <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.red, marginTop: 12 }}>{err}</div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.mute }}>
          {selected.size} selected
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={setLineup.isPending}
            style={btn("transparent", SQ.faint, true, setLineup.isPending)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={setLineup.isPending}
            style={btn(SQ.red, SQ.sidebar, false, setLineup.isPending)}
          >
            {setLineup.isPending ? "Saving…" : "Save lineup"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function btn(bg: string, color: string, outline: boolean, disabled: boolean) {
  return {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: ".12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    padding: "10px 16px",
    borderRadius: 5,
    cursor: disabled ? "not-allowed" : "pointer",
    color,
    background: bg,
    border: outline ? `1px solid ${SQ.inputBorder}` : "none",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
