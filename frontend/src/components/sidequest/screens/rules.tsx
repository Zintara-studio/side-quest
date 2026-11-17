"use client";

import { SQ, FONT } from "../tokens";
import { LeagueTitle } from "../league-title";

const sectionTitle = {
  fontFamily: FONT.mono,
  fontSize: 12,
  letterSpacing: ".18em",
  textTransform: "uppercase",
  color: SQ.red,
  margin: "30px 0 12px",
} as const;

const para = {
  fontSize: 14.5,
  lineHeight: 1.7,
  color: SQ.ink,
  margin: "0 0 12px",
} as const;

const RULES: { heading: string; points: string[] }[] = [
  {
    heading: "Fair play",
    points: [
      "No cheating, hacks, scripts, or third-party tools that give an unfair advantage. A confirmed cheat voids your results and can remove you from the league.",
      "No account sharing, ringers, or playing under another person's identity. The player who registers is the player who plays.",
      "Play every fixture to win. Match-fixing, sandbagging, or deliberately throwing a match is a serious violation.",
    ],
  },
  {
    heading: "Conduct",
    points: [
      "Treat opponents, teammates, admins and casters with respect. Harassment, hate speech, and targeted abuse are not tolerated in match rooms, chats, or anywhere in the community.",
      "Keep the real name, contact details, and profile you register accurate — franchises and admins rely on them.",
      "Follow admin instructions during a live match. Disputes go through the proper channel, not the match room.",
    ],
  },
  {
    heading: "Matches & results",
    points: [
      "Be on time and ready in the match room at the scheduled start. No-shows may be forfeited at admin discretion.",
      "Results are published by the league from the recorded rounds. If you believe a result is wrong, open a dispute on the match page — an admin will review it.",
      "Lineups lock a set time before each match. Once locked, the fielded roster is final for that fixture.",
    ],
  },
  {
    heading: "Registration & rosters",
    points: [
      "You may hold one live entry per match. Withdraw your own registration before it locks if you want to join a different team.",
      "Franchise rosters are set for the season through the draft/auction. Once you sign on to play a season, you're committed to it.",
      "Auction/pool entries are scouted by franchises — the expertise and handles you declare should be truthful.",
    ],
  },
  {
    heading: "Enforcement",
    points: [
      "Admins may warn, void results, remove entries, or suspend accounts for violations, proportionate to the offense.",
      "Decisions on disputes and conduct are made by the league admins and are final.",
      "These rules may be updated between seasons; the version in effect is the one posted here.",
    ],
  },
];

export function RulesScreen() {
  return (
    <div style={{ maxWidth: 820 }}>
      <LeagueTitle eyebrow="Community league" title="RULES & FAIR PLAY" />
      <p style={{ ...para, marginTop: 18, color: SQ.mute }}>
        Side Quest is a community esports league. By creating an account and registering, you agree to
        play by these rules. They exist to keep matches fair and the community welcoming.
      </p>
      {RULES.map((s) => (
        <section key={s.heading}>
          <div style={sectionTitle}>{s.heading}</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {s.points.map((p, i) => (
              <li key={i} style={{ ...para, marginBottom: 8 }}>
                {p}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p style={{ ...para, marginTop: 28, color: SQ.mute, fontSize: 12.5 }}>
        Questions or need to reach the organizers? Raise a dispute from the relevant page, or contact a
        league admin.
      </p>
    </div>
  );
}
