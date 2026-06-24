"use client";

import { useState } from "react";
import Link from "next/link";
import { SQ, FONT } from "../tokens";
import { ScreenHeader } from "../screen-header";
import { TableScroll } from "../table-scroll";
import { StateNote } from "@/components/sidequest/state-note";
import {
  useFranchises,
  useFranchise,
  useFranchiseRoster,
  useCreateFranchise,
  useDiscardFranchise,
  useSetFranchiseOwner,
  useSetFranchiseManager,
  useRegistrations,
} from "@/lib/query/hooks";
import { apiErrorMessage } from "@/lib/api/client";

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const formInput = {
  background: SQ.inset,
  border: `1px solid ${SQ.inputBorder}`,
  borderRadius: 5,
  padding: "9px 12px",
  fontSize: 13.5,
  color: SQ.ink,
  fontFamily: FONT.sans,
} as const;

const smallBtn = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  padding: "7px 11px",
  borderRadius: 5,
  cursor: "pointer",
} as const;

export function FranchisesScreen() {
  const { data, isLoading, isError } = useFranchises({});
  const franchises = data?.items ?? [];
  const create = useCreateFranchise();
  const pendingFranchiseRegs = useRegistrations({ status: "PENDING", type: "FRANCHISE", limit: 50 });

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);

  const submitCreate = async () => {
    setErr(null);
    if (!name.trim() || !tag.trim()) {
      setErr("Enter a name and a tag.");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), tag: tag.trim().toUpperCase() });
      setName("");
      setTag("");
    } catch (e) {
      setErr(apiErrorMessage(e, "Couldn't create the franchise."));
    }
  };

  return (
    <div>
      <ScreenHeader eyebrow="Teams & rosters" title="FRANCHISES" />

      {/* create + form-from-registration */}
      <div
        style={{
          background: SQ.panel,
          border: `1px solid ${SQ.hairline}`,
          borderRadius: 9,
          padding: 18,
          margin: "18px 0 24px",
        }}
      >
        <div style={{ ...headCell, marginBottom: 10 }}>CREATE A FRANCHISE</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Franchise name" style={{ ...formInput, flex: 1, minWidth: 200 }} />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="TAG" style={{ ...formInput, width: 120 }} />
          <button
            type="button"
            onClick={submitCreate}
            disabled={create.isPending}
            style={{
              ...smallBtn,
              fontSize: 11,
              fontWeight: 700,
              color: SQ.sidebar,
              background: SQ.red,
              border: "none",
              padding: "11px 18px",
            }}
          >
            {create.isPending ? "Creating…" : "Create ▸"}
          </button>
        </div>
        {err ? <div style={{ fontFamily: FONT.mono, fontSize: 12, color: SQ.ember, marginTop: 8 }}>{err}</div> : null}

        {(pendingFranchiseRegs.data?.items ?? []).length > 0 ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SQ.hairlineSoft}` }}>
            <div style={{ ...headCell, marginBottom: 8 }}>FRANCHISE REGISTRATIONS · CLICK TO PREFILL</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(pendingFranchiseRegs.data?.items ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setName(r.squadName ?? "");
                    setTag((r.squadName ?? "").replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase());
                  }}
                  style={{ ...smallBtn, color: SQ.faint, background: "transparent", border: `1px solid ${SQ.inputBorder}` }}
                >
                  {r.squadName ?? r.player?.gamerTag ?? "Franchise"} ▸
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: SQ.mute, marginTop: 8 }}>
              Approve the registration in Registrations once the franchise is formed.
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <StateNote>Loading franchises…</StateNote>
      ) : franchises.length === 0 ? (
        <StateNote tone={isError ? "error" : "muted"}>
          {isError ? "Couldn't load franchises (admin sign-in required)." : "No franchises yet."}
        </StateNote>
      ) : (
        <TableScroll minWidth={760}>
          <div style={{ display: "flex", padding: "14px 18px", borderBottom: `1px solid ${SQ.hairline}`, ...headCell }}>
            <div style={{ width: 44 }}>#</div>
            <div style={{ flex: 1 }}>FRANCHISE</div>
            <div style={{ width: 100 }}>STATUS</div>
            <div style={{ width: 80, textAlign: "center" }}>PLAYERS</div>
            <div style={{ width: 70, textAlign: "right" }}>PTS</div>
            <div style={{ width: 170, textAlign: "right" }}>MANAGE</div>
          </div>

          {franchises.map((f) => (
            <div key={f.id} style={{ borderBottom: `1px solid ${SQ.hairlineSoft}` }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 18px" }}>
                <div style={{ width: 44, fontFamily: FONT.display, fontSize: 16, color: f.rank === 1 ? SQ.red : SQ.steel }}>
                  {String(f.rank).padStart(2, "0")}
                </div>
                <Link href={`/admin/franchise/${f.id}`} style={{ flex: 1, fontWeight: 700, fontSize: 14.5, textDecoration: "none", color: SQ.ink }}>
                  {f.name}
                  {f.tag ? <span style={{ fontFamily: FONT.mono, fontSize: 10, color: SQ.mute, fontWeight: 400, marginLeft: 6 }}>{f.tag}</span> : null}
                </Link>
                <div style={{ width: 100 }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      letterSpacing: ".1em",
                      color: f.active ? SQ.green : SQ.mute,
                      border: `1px solid ${f.active ? "rgba(31,157,99,.45)" : SQ.inputBorder}`,
                      padding: "4px 9px",
                      borderRadius: 9,
                    }}
                  >
                    {f.active ? "ACTIVE" : "DISCARDED"}
                  </span>
                </div>
                <div style={{ width: 80, textAlign: "center", fontFamily: FONT.mono, fontSize: 13, color: SQ.faint }}>{f.rosterSize}</div>
                <div style={{ width: 70, textAlign: "right", fontFamily: FONT.display, fontSize: 16 }}>{f.points}</div>
                <div style={{ width: 170, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => setManaging(managing === f.id ? null : f.id)}
                    style={{ ...smallBtn, color: managing === f.id ? SQ.sidebar : SQ.faint, background: managing === f.id ? SQ.red : "transparent", border: `1px solid ${managing === f.id ? SQ.red : SQ.inputBorder}` }}
                  >
                    {managing === f.id ? "Close" : "Manage"}
                  </button>
                </div>
              </div>
              {managing === f.id ? <ManagePanel franchiseId={f.id} /> : null}
            </div>
          ))}
        </TableScroll>
      )}
    </div>
  );
}

function ManagePanel({ franchiseId }: { franchiseId: string }) {
  const detailQ = useFranchise(franchiseId);
  const rosterQ = useFranchiseRoster(franchiseId);
  const setOwner = useSetFranchiseOwner();
  const setManager = useSetFranchiseManager();
  const discard = useDiscardFranchise();
  const roster = rosterQ.data ?? [];
  const d = detailQ.data;

  const rowLabel = { fontFamily: FONT.mono, fontSize: 10, letterSpacing: ".12em", color: SQ.label } as const;
  const sel = {
    ...formInput,
    fontFamily: FONT.mono,
    fontSize: 12,
    cursor: "pointer",
    minWidth: 180,
  } as const;

  return (
    <div style={{ padding: "0 18px 18px 62px", display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-end" }}>
      <label>
        <div style={{ ...rowLabel, marginBottom: 6 }}>OWNER</div>
        <select
          value={d?.owner?.playerId ?? ""}
          disabled={setOwner.isPending || roster.length === 0}
          onChange={(e) => e.target.value && setOwner.mutate({ id: franchiseId, playerId: e.target.value })}
          style={sel}
        >
          <option value="">{d?.owner ? d.owner.gamerTag : "Set owner…"}</option>
          {roster.map((m) => (
            <option key={m.playerId} value={m.playerId}>{m.gamerTag}</option>
          ))}
        </select>
      </label>
      <label>
        <div style={{ ...rowLabel, marginBottom: 6 }}>MANAGER</div>
        <select
          value={d?.manager?.playerId ?? ""}
          disabled={setManager.isPending || roster.length === 0}
          onChange={(e) => e.target.value && setManager.mutate({ id: franchiseId, playerId: e.target.value })}
          style={sel}
        >
          <option value="">{d?.manager ? d.manager.gamerTag : "Set manager…"}</option>
          {roster.map((m) => (
            <option key={m.playerId} value={m.playerId}>{m.gamerTag}</option>
          ))}
        </select>
      </label>
      {roster.length === 0 ? (
        <div style={{ fontSize: 12, color: SQ.mute, paddingBottom: 8 }}>Assign players to the roster first.</div>
      ) : null}
      {d?.active !== false ? (
        <button
          type="button"
          disabled={discard.isPending}
          onClick={() => {
            if (window.confirm("Discard this franchise? It will stop competing (history is kept).")) {
              discard.mutate(franchiseId);
            }
          }}
          style={{ ...smallBtn, color: SQ.ember, background: "transparent", border: "1px solid rgba(232,96,44,.45)" }}
        >
          {discard.isPending ? "Discarding…" : "Discard franchise"}
        </button>
      ) : null}
    </div>
  );
}
