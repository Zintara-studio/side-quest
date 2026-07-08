"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { SQ, FONT, rankAccent, announcementTagColors } from "../tokens";
import { StateNote } from "../state-note";
import {
  useStandings,
  useMatches,
  usePlayers,
  useCurrentSeason,
  useSeasons,
  useSeasonStandings,
  useTopPlayers,
  useAnnouncements,
  useActiveAuction,
} from "@/lib/query/hooks";
import { adaptUpcoming, shortDate, announcementTagFor, type UpcomingItem } from "@/lib/adapters/league";
import type {
  AnnouncementView,
  AuctionView,
  PlayerRankRow,
  SeasonStandingView,
  SeasonView,
  StandingRow,
} from "@/lib/api/types";

const sectionLabel = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".2em",
  textTransform: "uppercase",
} as const;

const headCell = {
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: ".12em",
  color: SQ.dim,
} as const;

const eyebrowStyle = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".22em",
  textTransform: "uppercase",
  color: SQ.red,
} as const;

const cardStyle = {
  background: SQ.panel,
  border: `1px solid ${SQ.hairline}`,
  borderRadius: 8,
  padding: "18px 20px",
  textDecoration: "none",
  color: SQ.ink,
} as const;

export function HomeScreen() {
  const standingsQ = useStandings();
  const upcomingQ = useMatches({ status: "SCHEDULED", limit: 6 });
  const recentQ = useMatches({ status: "COMPLETED", limit: 6 });
  const playersQ = usePlayers({ limit: 100 });
  const announcementsQ = useAnnouncements({ limit: 12 });
  const topPlayersQ = useTopPlayers(5);
  const seasonQ = useCurrentSeason();
  const seasonsQ = useSeasons();
  // Auction reads are public, so the banner shows for guests too during a live auction.
  const activeAuction = useActiveAuction().data ?? null;

  const season = seasonQ.data ?? null;
  const seasons = seasonsQ.data ?? [];
  // Only commit to a season mode once both queries have settled, so a signed-out first paint
  // doesn't flash the off-season page before the current season arrives.
  const seasonReady = !seasonQ.isLoading && !seasonsQ.isLoading;
  const offSeason = seasonReady && !season;

  // The most recently concluded season — powers the off-season champion + final table.
  const lastFinished = useMemo(() => {
    const finished = seasons.filter((s) => s.status === "FINISHED");
    return [...finished].sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0] ?? null;
  }, [seasons]);

  // Frozen final standings for that season — only fetched while we're between seasons.
  const finalStandingsQ = useSeasonStandings(offSeason ? lastFinished?.code : undefined);
  const finalStandings = finalStandingsQ.data ?? [];
  const champion = finalStandings[0] ?? null;

  const rows = standingsQ.data?.standings ?? [];

  const upcoming = useMemo(() => {
    const items = (upcomingQ.data?.items ?? [])
      .slice()
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    return adaptUpcoming(items);
  }, [upcomingQ.data]);

  const recent = useMemo(() => {
    const items = (recentQ.data?.items ?? [])
      .slice()
      .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))
      .slice(0, 6);
    return adaptUpcoming(items);
  }, [recentQ.data]);

  const announcements = announcementsQ.data?.items ?? [];
  const registrationCalls = announcements.filter((a) => a.registrationOpen).slice(0, 4);
  const feed = announcements.slice(0, 6);
  const topPlayers = topPlayersQ.data ?? [];

  // Best player per franchise = highest-points player in that franchise (real data).
  const bestByFranchise = useMemo(() => {
    const name: Record<string, string> = {};
    const top: Record<string, number> = {};
    for (const p of playersQ.data?.items ?? []) {
      const key = (p.franchiseName ?? "").toLowerCase();
      if (!key) continue;
      if (top[key] === undefined || p.points > top[key]) {
        top[key] = p.points;
        name[key] = p.gamerTag;
      }
    }
    return name;
  }, [playersQ.data]);

  return (
    <div>
      <Hero
        season={season}
        offSeason={offSeason}
        lastFinished={lastFinished}
        upcomingCount={upcoming.length}
        franchiseCount={rows.length}
        hasAuction={!!activeAuction}
      />

      {/* an in-progress / scheduled auction is headline news in either season state */}
      {activeAuction ? <AuctionBanner auction={activeAuction} /> : null}

      {offSeason ? (
        <OffSeason
          lastFinished={lastFinished}
          finalStandings={finalStandings}
          champion={champion}
          loading={finalStandingsQ.isLoading}
          error={finalStandingsQ.isError}
          hasAuction={!!activeAuction}
          feed={feed}
          registrationCalls={registrationCalls}
          upcoming={upcoming}
          upcomingLoading={upcomingQ.isLoading}
          upcomingError={upcomingQ.isError}
          recent={recent}
        />
      ) : (
        <InSeason
          upcoming={upcoming}
          upcomingLoading={upcomingQ.isLoading}
          upcomingError={upcomingQ.isError}
          recent={recent}
          registrationCalls={registrationCalls}
          rows={rows}
          standingsLoading={standingsQ.isLoading}
          standingsError={standingsQ.isError}
          bestByFranchise={bestByFranchise}
          topPlayers={topPlayers}
          feed={feed}
        />
      )}
    </div>
  );
}

// ---- hero ------------------------------------------------------------------

function Hero({
  season,
  offSeason,
  lastFinished,
  upcomingCount,
  franchiseCount,
  hasAuction,
}: {
  season: SeasonView | null;
  offSeason: boolean;
  lastFinished: SeasonView | null;
  upcomingCount: number;
  franchiseCount: number;
  hasAuction: boolean;
}) {
  const eyebrow = season
    ? `${season.code} — ${season.name}`
    : lastFinished
      ? `${lastFinished.code} — ${lastFinished.name} · Concluded`
      : "Community Esports League";
  const meta = offSeason
    ? hasAuction
      ? "OFF-SEASON · AUCTION IN PROGRESS"
      : "OFF-SEASON · NEW SEASON FORMING"
    : `${upcomingCount} UPCOMING · ${franchiseCount} FRANCHISES`;

  return (
    <div style={{ paddingBottom: 26, borderBottom: `1px solid ${SQ.hairline}` }}>
      <div style={eyebrowStyle}>{eyebrow}</div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: "clamp(40px,6vw,72px)",
          lineHeight: 0.9,
          letterSpacing: "-.03em",
          marginTop: 14,
        }}
      >
        {offSeason ? (
          <>
            SEASON
            <br />
            BREAK
          </>
        ) : (
          <>
            MATCHDAY
            <br />& STANDINGS
          </>
        )}
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          letterSpacing: ".1em",
          color: SQ.mute,
          marginTop: 16,
        }}
      >
        {meta}
      </div>
    </div>
  );
}

// ---- auction banner --------------------------------------------------------

function AuctionBanner({ auction }: { auction: AuctionView }) {
  const live = auction.status === "LIVE";
  const tint = live ? SQ.red : auction.status === "DRAFT" ? SQ.blue : SQ.amber;
  const label = auction.status === "DRAFT" ? "SCHEDULED" : auction.status;
  const line =
    auction.status === "LIVE"
      ? "Bidding is live right now — step into the room."
      : auction.status === "LOBBY"
        ? "The auction hall is open — the room is filling up."
        : auction.status === "PAUSED"
          ? "The auction is paused — it resumes shortly."
          : auction.scheduledAt
            ? `Scheduled to open ${shortDate(auction.scheduledAt)}.`
            : "A player auction is being prepared.";

  return (
    <Link
      href="/auction"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 14,
        marginTop: 24,
        padding: "16px 20px",
        borderRadius: 10,
        textDecoration: "none",
        border: `1px solid ${tint}`,
        background: "linear-gradient(90deg,rgba(232,96,44,.14),transparent)",
        color: SQ.ink,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          letterSpacing: ".14em",
          color: tint,
          border: `1px solid ${tint}`,
          borderRadius: 999,
          padding: "4px 10px",
          whiteSpace: "nowrap",
        }}
      >
        ● {label}
      </span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" }}>
          Player auction — {auction.title}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10.5,
            letterSpacing: ".08em",
            color: SQ.faint,
            marginTop: 5,
          }}
        >
          {line}
        </div>
      </div>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 10.5,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: SQ.ember,
          whiteSpace: "nowrap",
        }}
      >
        Enter the room ▸
      </span>
    </Link>
  );
}

// ---- in-season dashboard ---------------------------------------------------

function InSeason({
  upcoming,
  upcomingLoading,
  upcomingError,
  recent,
  registrationCalls,
  rows,
  standingsLoading,
  standingsError,
  bestByFranchise,
  topPlayers,
  feed,
}: {
  upcoming: UpcomingItem[];
  upcomingLoading: boolean;
  upcomingError: boolean;
  recent: UpcomingItem[];
  registrationCalls: AnnouncementView[];
  rows: StandingRow[];
  standingsLoading: boolean;
  standingsError: boolean;
  bestByFranchise: Record<string, string>;
  topPlayers: PlayerRankRow[];
  feed: AnnouncementView[];
}) {
  return (
    <>
      <CallsAndFixtures
        registrationCalls={registrationCalls}
        upcoming={upcoming}
        upcomingLoading={upcomingLoading}
        upcomingError={upcomingError}
        recent={recent}
        showEmptyUpcoming
      />

      <SectionHeadRow label="Franchise Leaderboard" href="/franchises" />
      <Leaderboard
        rows={rows}
        loading={standingsLoading}
        error={standingsError}
        bestByFranchise={bestByFranchise}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 28,
          marginTop: 34,
        }}
      >
        <div>
          <div style={sectionLabel}>Top Players</div>
          <div style={{ marginTop: 16 }}>
            <TopPlayersList rows={topPlayers} />
          </div>
        </div>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={sectionLabel}>League Feed</div>
            <ViewAllLink href="/announcements" />
          </div>
          <LeagueFeed items={feed} />
        </div>
      </div>
    </>
  );
}

// ---- shared: open registration calls + fixtures (rendered in BOTH season states) --------------
// FFA matches, franchise calls and auction sign-ups all continue between seasons, so these sections
// must not disappear off-season. `showEmptyUpcoming` keeps the always-on "Upcoming Matches" empty state
// in-season, while off-season only surfaces sections that actually have content.

function CallsAndFixtures({
  registrationCalls,
  upcoming,
  upcomingLoading,
  upcomingError,
  recent,
  showEmptyUpcoming,
}: {
  registrationCalls: AnnouncementView[];
  upcoming: UpcomingItem[];
  upcomingLoading: boolean;
  upcomingError: boolean;
  recent: UpcomingItem[];
  showEmptyUpcoming: boolean;
}) {
  const showUpcoming = showEmptyUpcoming || upcomingLoading || upcoming.length > 0;
  return (
    <>
      {registrationCalls.length > 0 ? (
        <>
          <SectionHead label="Open Registration" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
              gap: 16,
            }}
          >
            {registrationCalls.map((a) => (
              <RegistrationCallCard key={a.id} a={a} />
            ))}
          </div>
        </>
      ) : null}

      {showUpcoming ? (
        <>
          <SectionHead label="Upcoming Matches" />
          {upcomingLoading ? (
            <StateNote>Loading fixtures…</StateNote>
          ) : upcoming.length === 0 ? (
            <StateNote tone={upcomingError ? "error" : "muted"}>
              {upcomingError ? "Couldn't reach the league API." : "No upcoming matches scheduled."}
            </StateNote>
          ) : (
            <MatchGrid items={upcoming} kind="upcoming" />
          )}
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionHead label="Recent Results" />
          <MatchGrid items={recent} kind="result" />
        </>
      ) : null}
    </>
  );
}

// ---- off-season state ------------------------------------------------------

function OffSeason({
  lastFinished,
  finalStandings,
  champion,
  loading,
  error,
  hasAuction,
  feed,
  registrationCalls,
  upcoming,
  upcomingLoading,
  upcomingError,
  recent,
}: {
  lastFinished: SeasonView | null;
  finalStandings: SeasonStandingView[];
  champion: SeasonStandingView | null;
  loading: boolean;
  error: boolean;
  hasAuction: boolean;
  feed: AnnouncementView[];
  registrationCalls: AnnouncementView[];
  upcoming: UpcomingItem[];
  upcomingLoading: boolean;
  upcomingError: boolean;
  recent: UpcomingItem[];
}) {
  return (
    <>
      <ChampionCard season={lastFinished} champion={champion} />

      {/* Between seasons the league keeps moving — surface any open calls and off-season fixtures. */}
      <CallsAndFixtures
        registrationCalls={registrationCalls}
        upcoming={upcoming}
        upcomingLoading={upcomingLoading}
        upcomingError={upcomingError}
        recent={recent}
        showEmptyUpcoming={false}
      />

      <SectionHead label={lastFinished ? `Final Standings · ${lastFinished.code}` : "Final Standings"} />
      {loading ? (
        <StateNote>Loading final standings…</StateNote>
      ) : finalStandings.length === 0 ? (
        <StateNote tone={error ? "error" : "muted"}>
          {error
            ? "Couldn't reach the league API."
            : lastFinished
              ? "No standings were recorded for the last season."
              : "No seasons have concluded yet."}
        </StateNote>
      ) : (
        <SnapshotTable rows={finalStandings} />
      )}

      <div
        style={{
          marginTop: 34,
          padding: "20px 22px",
          borderRadius: 10,
          border: `1px solid ${SQ.hairline}`,
          background: SQ.panel,
        }}
      >
        <div style={{ ...sectionLabel, fontSize: 11 }}>What&rsquo;s Next</div>
        <div style={{ fontSize: 14, color: SQ.faint, marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
          {hasAuction
            ? "The next season's player auction is underway — head to the room to follow the bidding as squads take shape."
            : "A new season is forming. Rosters reset and fresh fixtures drop when it begins — watch this space."}
        </div>
        {hasAuction ? (
          <Link
            href="/auction"
            style={{
              display: "inline-block",
              marginTop: 14,
              fontFamily: FONT.mono,
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: SQ.league,
              background: SQ.red,
              padding: "10px 16px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Enter the auction room ▸
          </Link>
        ) : null}
      </div>

      {feed.length > 0 ? (
        <>
          <SectionHeadRow label="League Feed" href="/announcements" />
          <LeagueFeed items={feed} />
        </>
      ) : null}
    </>
  );
}

function ChampionCard({
  season,
  champion,
}: {
  season: SeasonView | null;
  champion: SeasonStandingView | null;
}) {
  if (!champion) return null;
  return (
    <div
      style={{
        marginTop: 26,
        padding: "26px 24px",
        borderRadius: 12,
        border: `1px solid ${SQ.red}`,
        background: "linear-gradient(120deg,rgba(232,96,44,.16),transparent)",
      }}
    >
      <div style={eyebrowStyle}>{season ? `${season.code} Champion` : "Season Champion"}</div>
      <Link
        href={`/franchise/${champion.franchiseId}`}
        style={{ textDecoration: "none", color: SQ.ink }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: "clamp(30px,5vw,52px)",
            lineHeight: 0.95,
            letterSpacing: "-.03em",
            marginTop: 12,
          }}
        >
          {champion.name}
          {champion.tag ? <span style={{ color: SQ.mute }}> — {champion.tag}</span> : null}
        </div>
      </Link>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: ".1em",
          color: SQ.mute,
          marginTop: 12,
        }}
      >
        {champion.points} POINTS · FINISHED TOP OF THE TABLE
      </div>
    </div>
  );
}

// ---- shared section pieces -------------------------------------------------

function SectionHead({ label }: { label: string }) {
  return <div style={{ ...sectionLabel, margin: "34px 0 16px" }}>{label}</div>;
}

function SectionHeadRow({ label, href }: { label: string; href: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        margin: "34px 0 16px",
      }}
    >
      <div style={sectionLabel}>{label}</div>
      <ViewAllLink href={href} />
    </div>
  );
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: ".14em",
        color: SQ.mute,
        textDecoration: "none",
      }}
    >
      VIEW ALL ▸
    </Link>
  );
}

// ---- match cards -----------------------------------------------------------

function MatchGrid({ items, kind }: { items: UpcomingItem[]; kind: "upcoming" | "result" }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
        gap: 16,
      }}
    >
      {items.map((u) => (
        <Link key={u.id} href={`/match/${u.id}`} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".12em",
                color: kind === "result" ? SQ.mute : SQ.ember,
              }}
            >
              {u.meta}
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: SQ.mute }}>
              {u.day} {u.mon}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 14 }}>{u.title}</div>
          {kind === "result" ? (
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: SQ.ember,
                marginTop: 12,
              }}
            >
              View result ▸
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function RegistrationCallCard({ a }: { a: AnnouncementView }) {
  return (
    <Link
      href={`/register?announcement=${a.id}`}
      style={{
        ...cardStyle,
        border: `1px solid rgba(232,96,44,.45)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          letterSpacing: ".14em",
          color: SQ.ember,
        }}
      >
        {a.gameName ? `REGISTER · ${a.gameName.toUpperCase()}` : "REGISTER OPEN"}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 10, flex: 1 }}>{a.title}</div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10.5,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: SQ.ember,
          marginTop: 14,
        }}
      >
        Register ▸
      </div>
    </Link>
  );
}

// ---- top players + league feed ---------------------------------------------

function TopPlayersList({ rows }: { rows: PlayerRankRow[] }) {
  if (rows.length === 0) return <StateNote>No player rankings yet.</StateNote>;
  return (
    <div style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 8, overflow: "hidden" }}>
      {rows.map((p) => {
        const accent = rankAccent(p.rank === 1);
        return (
          <Link
            key={p.playerId}
            href={`/player/${p.playerId}`}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "13px 18px",
              borderBottom: `1px solid ${SQ.hairlineSoft}`,
              background: accent.rowBg,
              textDecoration: "none",
              color: SQ.ink,
            }}
          >
            <div style={{ width: 40, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>
              {String(p.rank).padStart(2, "0")}
            </div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
              {p.gamerTag}
              {p.franchiseTag ? (
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    color: SQ.mute,
                    fontWeight: 400,
                    marginLeft: 6,
                  }}
                >
                  {p.franchiseTag}
                </span>
              ) : null}
            </div>
            <div style={{ fontFamily: FONT.display, fontSize: 17 }}>{p.points}</div>
          </Link>
        );
      })}
    </div>
  );
}

function LeagueFeed({ items }: { items: AnnouncementView[] }) {
  if (items.length === 0) return <StateNote>No announcements yet.</StateNote>;
  return (
    <div style={{ border: `1px solid ${SQ.hairline}`, borderRadius: 8, overflow: "hidden" }}>
      {items.map((a) => {
        const tag = announcementTagFor(a.category);
        const [tagColor, tagBorder] = announcementTagColors(tag);
        const chipColor = a.registrationOpen ? SQ.ember : tagColor;
        const chipBorder = a.registrationOpen ? "rgba(232,96,44,.45)" : tagBorder;
        const href = a.registrationOpen
          ? `/register?announcement=${a.id}`
          : a.matchId
            ? `/match/${a.matchId}`
            : null;
        const inner = (
          <>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                letterSpacing: ".14em",
                color: chipColor,
                border: `1px solid ${chipBorder}`,
                padding: "4px 8px",
                borderRadius: 4,
                width: 84,
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {a.registrationOpen ? "REGISTER" : tag}
            </span>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{a.title}</div>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                letterSpacing: ".1em",
                color: SQ.mute,
                whiteSpace: "nowrap",
              }}
            >
              {shortDate(a.publishedAt)}
            </span>
          </>
        );
        const rowStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: `1px solid ${SQ.hairlineCell}`,
          textDecoration: "none",
          color: SQ.ink,
        };
        return href ? (
          <Link key={a.id} href={href} style={rowStyle}>
            {inner}
          </Link>
        ) : (
          <div key={a.id} style={rowStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// ---- standings tables ------------------------------------------------------

function Leaderboard({
  rows,
  loading,
  error,
  bestByFranchise,
}: {
  rows: StandingRow[];
  loading: boolean;
  error: boolean;
  bestByFranchise: Record<string, string>;
}) {
  if (loading) return <StateNote>Loading standings…</StateNote>;
  if (rows.length === 0)
    return (
      <StateNote tone={error ? "error" : "muted"}>
        {error ? "Couldn't reach the league API." : "No standings yet."}
      </StateNote>
    );
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
      <div style={{ minWidth: 520 }}>
        <div
          style={{
            display: "flex",
            padding: "14px 18px",
            borderBottom: `1px solid ${SQ.hairline}`,
            ...headCell,
          }}
        >
          <div style={{ width: 44 }}>#</div>
          <div style={{ flex: 1 }}>FRANCHISE</div>
          <div style={{ width: 80, textAlign: "right" }}>PTS</div>
          <div style={{ width: 180, textAlign: "right" }}>BEST PLAYER</div>
        </div>
        {rows.map((r) => {
          const accent = rankAccent(r.rank === 1);
          const best = bestByFranchise[(r.name ?? "").toLowerCase()];
          return (
            <Link
              key={r.franchiseId}
              href={`/franchise/${r.franchiseId}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
                cursor: "pointer",
                background: accent.rowBg,
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div style={{ width: 44, fontFamily: FONT.display, fontSize: 18, color: accent.color }}>
                {String(r.rank).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                {r.name}
                {r.tag ? (
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: SQ.mute,
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    {r.tag}
                  </span>
                ) : null}
              </div>
              <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 18 }}>
                {r.points}
              </div>
              <div style={{ width: 180, textAlign: "right", fontSize: 13, color: SQ.faint }}>
                {best ?? "—"}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SnapshotTable({ rows }: { rows: SeasonStandingView[] }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${SQ.hairline}`, borderRadius: 8 }}>
      <div style={{ minWidth: 480 }}>
        <div
          style={{
            display: "flex",
            padding: "14px 18px",
            borderBottom: `1px solid ${SQ.hairline}`,
            ...headCell,
          }}
        >
          <div style={{ width: 44 }}>#</div>
          <div style={{ flex: 1 }}>FRANCHISE</div>
          <div style={{ width: 80, textAlign: "right" }}>PTS</div>
        </div>
        {rows.map((r) => {
          const accent = rankAccent(r.rank === 1);
          return (
            <Link
              key={`${r.rank}-${r.tag}`}
              href={`/franchise/${r.franchiseId}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: `1px solid ${SQ.hairlineSoft}`,
                background: accent.rowBg,
                textDecoration: "none",
                color: SQ.ink,
              }}
            >
              <div style={{ width: 44, fontFamily: FONT.display, fontSize: 17, color: accent.color }}>
                {String(r.rank).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                {r.name}
                {r.tag ? (
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: SQ.mute,
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    {r.tag}
                  </span>
                ) : null}
              </div>
              <div style={{ width: 80, textAlign: "right", fontFamily: FONT.display, fontSize: 17 }}>
                {r.points}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
