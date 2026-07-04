"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { StateNote } from "@/components/sidequest/state-note";
import { Modal } from "@/components/sidequest/modal";
import { useDisputes, useResolveDispute } from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";
import { shortDate } from "@/lib/adapters/league";
import type { DisputeCategory } from "@/lib/api/types";

const cardBtn = {
  fontFamily: FONT.mono,
  fontSize: 10.5,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  fontWeight: 700,
  padding: "9px 14px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

/** [text color, border color] for a dispute category chip. */
function categoryColors(c: DisputeCategory): [string, string] {
  switch (c) {
    case "APPEAL":
      return [SQ.blue, "rgba(59,111,212,.45)"];
    case "GENERAL":
      return [SQ.slate, SQ.inputBorder];
    default: // RESULT
      return [SQ.ember, "rgba(232,96,44,.45)"];
  }
}

export function DisputesScreen() {
  const { data, isLoading, isError } = useDisputes();
  const resolve = useResolveDispute();
  const disputes = data ?? [];

  // Modal-driven resolve/dismiss (replaces window.prompt).
  const [active, setActive] = useState<{ id: string; dismiss: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const openAction = (id: string, dismiss: boolean) => {
    setErr(null);
    setNote("");
    setActive({ id, dismiss });
  };

  const closeAction = () => {
    if (resolve.isPending) return;
    setActive(null);
    setNote("");
    setErr(null);
  };

  const confirmAction = async () => {
    if (!active) return;
    const resolution = note.trim();
    if (!resolution) {
      setErr("Please add a short note.");
      return;
    }
    try {
      await resolve.mutateAsync({ id: active.id, body: { resolution, dismiss: active.dismiss } });
      setActive(null);
      setNote("");
      setErr(null);
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't save. Please try again."));
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="Result integrity" title="DISPUTES" />

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          margin: "14px 0 24px",
          paddingBottom: 22,
          borderBottom: `1px solid ${SQ.hairline}`,
        }}
      >
        {disputes.length} OPEN · RESULT CHALLENGES, APPEALS &amp; REPORTED ISSUES
      </div>

      {isLoading ? (
        <StateNote>Loading disputes…</StateNote>
      ) : disputes.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load disputes (admin sign-in required)." : "No open disputes — all clear."}
        </StateNote>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {disputes.map((d) => {
            const [catColor, catBorder] = categoryColors(d.category);
            return (
              <div
                key={d.id}
                style={{ background: SQ.panel, border: `1px solid ${SQ.hairline}`, borderRadius: 9, padding: 18 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".1em",
                      color: SQ.ember,
                      border: "1px solid rgba(232,96,44,.45)",
                      padding: "4px 8px",
                      borderRadius: 9,
                    }}
                  >
                    {d.status}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".1em",
                      color: catColor,
                      border: `1px solid ${catBorder}`,
                      padding: "4px 8px",
                      borderRadius: 9,
                    }}
                  >
                    {d.category}
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: ".08em", color: SQ.mute }}>
                    RAISED BY{" "}
                    <span style={{ color: SQ.ink }}>{d.raisedByGamerTag || d.raisedByName || "—"}</span>
                    {" · "}
                    {shortDate(d.createdAt)}
                  </span>
                  {d.matchTitle ? (
                    <span style={{ fontFamily: FONT.mono, fontSize: 11, color: SQ.faint }}>· {d.matchTitle}</span>
                  ) : null}
                  {d.matchId ? (
                    <Link
                      href={`/admin/match/${d.matchId}`}
                      style={{
                        marginLeft: "auto",
                        fontFamily: FONT.mono,
                        fontSize: 10.5,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: SQ.faint,
                        border: `1px solid ${SQ.inputBorder}`,
                        padding: "7px 12px",
                        borderRadius: 5,
                        textDecoration: "none",
                      }}
                    >
                      View match ▸
                    </Link>
                  ) : null}
                </div>
                <div style={{ fontSize: 14.5, color: SQ.ink, marginTop: 12, lineHeight: 1.5 }}>{d.reason}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    disabled={resolve.isPending}
                    onClick={() => openAction(d.id, false)}
                    style={{ ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none", opacity: resolve.isPending ? 0.6 : 1 }}
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={resolve.isPending}
                    onClick={() => openAction(d.id, true)}
                    style={{ ...cardBtn, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}`, opacity: resolve.isPending ? 0.6 : 1 }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!active}
        title={active?.dismiss ? "Dismiss dispute" : "Resolve dispute"}
        onClose={closeAction}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: SQ.label,
            marginBottom: 10,
          }}
        >
          {active?.dismiss ? "Why is this being dismissed?" : "How was it resolved?"}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          autoFocus
          placeholder={active?.dismiss ? "Note for the record…" : "Describe the resolution…"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: SQ.inset,
            border: `1px solid ${SQ.inputBorder}`,
            borderRadius: 5,
            padding: "11px 12px",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: SQ.ink,
            fontFamily: FONT.sans,
            resize: "vertical",
          }}
        />
        {err ? (
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: SQ.ember, marginTop: 10 }}>{err}</div>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            disabled={resolve.isPending || !note.trim()}
            onClick={confirmAction}
            style={
              active?.dismiss
                ? { ...cardBtn, color: SQ.league, background: SQ.ember, border: "none", opacity: resolve.isPending || !note.trim() ? 0.6 : 1 }
                : { ...cardBtn, color: SQ.sidebar, background: SQ.green, border: "none", opacity: resolve.isPending || !note.trim() ? 0.6 : 1 }
            }
          >
            {resolve.isPending ? "Saving…" : active?.dismiss ? "Dismiss dispute" : "Resolve dispute"}
          </button>
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={closeAction}
            style={{ ...cardBtn, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}`, opacity: resolve.isPending ? 0.6 : 1 }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
