// Typed mirrors of the Spring Boot backend DTOs (com.sidequest.arena.*.dto).
// Kept in lock-step with the controllers under /v1. `Instant` fields serialize as
// ISO-8601 strings (Jackson is configured with write-dates-as-timestamps: false).

// ---- shared ----------------------------------------------------------------

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

// ---- auth ------------------------------------------------------------------

export interface RegisterRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginRequest {
  identifier: string; // email or phone
  password: string;
}

export interface AuthUserView {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserView;
}

export interface MeUserView {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export interface MePlayerView {
  id: string;
  gamerTag: string;
  avatarUrl?: string;
  status: string;
  points: number;
  franchiseId?: string;
}

export interface MeResponse {
  user: MeUserView;
  player: MePlayerView | null;
}

// ---- games -----------------------------------------------------------------

export interface GameSummary {
  id: string;
  name: string;
  format: string;
  iconUrl?: string;
  enabled: boolean;
  popularity: number;
}

export interface GameMatchView {
  matchId: string;
  scheduledAt: string;
  status: string;
  arena?: string;
}

export interface GameDetail extends GameSummary {
  matches: GameMatchView[];
}

export interface UpdateGameRequest {
  enabled?: boolean;
  format?: string;
  popularity?: number;
}

// ---- players ---------------------------------------------------------------

export interface PlayerSummary {
  id: string;
  gamerTag: string;
  avatarUrl?: string;
  region?: string;
  status: string;
  points: number;
  franchiseId?: string;
  franchiseName?: string;
}

export interface PlayerDetail {
  id: string;
  gamerTag: string;
  avatarUrl?: string;
  region?: string;
  bio?: string;
  status: string;
  points: number;
  user: { name: string };
  franchise: { id: string; name: string; tag: string } | null;
  proficiencies: { gameId: string; gameName: string; rating: number }[];
}

export interface PlayerMatchView {
  matchId: string;
  gameName: string;
  scheduledAt: string;
  status: string;
  franchiseRank: number | null;
  total: number | null;
}

export interface UsernameView {
  gameId: string;
  gameName: string;
  handle: string;
  isPublic: boolean;
}

export interface UpdatePlayerRequest {
  gamerTag?: string;
  region?: string;
  bio?: string;
  avatarUrl?: string;
}

// ---- franchises ------------------------------------------------------------

export interface FranchiseSummary {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string;
  points: number;
  rank: number;
  active: boolean;
  seasonId?: string;
  rosterSize: number;
}

export interface FranchisePerson {
  playerId: string;
  gamerTag: string;
}

export interface FranchiseDetail {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string;
  points: number;
  rank: number;
  active: boolean;
  seasonId?: string;
  igl: { playerId: string; gamerTag: string } | null;
  owner: FranchisePerson | null;
  manager: FranchisePerson | null;
  rosterSize: number;
  matchesPlayed: number;
}

export interface UpdateFranchiseRequest {
  name?: string;
  tag?: string;
  logoUrl?: string;
  points?: number;
  active?: boolean;
  iglPlayerId?: string;
}

export interface RosterMember {
  playerId: string;
  gamerTag: string;
  avatarUrl?: string;
  status: string;
  isIgl: boolean;
}

export interface FranchiseMatchView {
  matchId: string;
  gameName: string;
  scheduledAt: string;
  status: string;
  rank: number | null;
  total: number | null;
}

export interface CreateFranchiseRequest {
  name: string;
  tag: string;
  seasonId?: string;
  logoUrl?: string;
}

/** Verified player eligible to fill a franchise owner/manager slot (unassigned or already on it). */
export interface EligiblePlayer {
  playerId: string;
  gamerTag: string;
}

// ---- matches ---------------------------------------------------------------

export interface GameMini {
  id: string;
  name: string;
}

export interface ParticipantView {
  franchiseId: string;
  name: string;
  tag: string;
}

export type MatchType = "FRANCHISE" | "FFA";

export interface MatchSummary {
  id: string;
  game: GameMini;
  scheduledAt: string;
  status: string;
  arena?: string;
  format?: string;
  seasonId?: string;
  matchType?: MatchType;
  participantTags: string[];
}

export interface MatchPlayerView {
  playerId: string;
  gamerTag: string;
  franchiseId?: string;
  franchiseTag?: string;
  squadName?: string;
}

export interface MatchDetail {
  id: string;
  game: GameMini;
  scheduledAt: string;
  status: string;
  arena?: string;
  format?: string;
  seasonId?: string;
  hasResults: boolean;
  matchType?: MatchType;
  pointsPerKill: number;
  placementPoints: string;
  participants: ParticipantView[];
}

export interface CreateMatchRequest {
  gameId: string;
  scheduledAt: string;
  matchType?: MatchType;
  arena?: string;
  format?: string;
  seasonId?: string;
  participantFranchiseIds?: string[];
}

export interface ResultView {
  rank: number;
  franchiseId: string;
  franchiseName: string;
  franchiseTag: string;
  kills: number;
  placePts: number;
  total: number;
}

export interface ResultEntry {
  franchiseId: string;
  kills: number;
  placePts: number;
}

export interface EnterResultsRequest {
  rows: ResultEntry[];
}

// ---- per-round results (every match is scored round-by-round) ----

export interface PlayerStatView {
  playerId: string;
  gamerTag: string;
  kills: number;
  survivalSeconds: number;
}

export interface RoundResultView {
  rank: number;
  franchiseId: string;
  franchiseName: string;
  franchiseTag: string;
  kills: number;
  survivalSeconds: number;
  placePts: number;
  players: PlayerStatView[];
}

export interface MatchRoundView {
  roundNumber: number;
  mapName?: string;
  mode?: string;
  rows: RoundResultView[];
}

export interface PlayerStatEntry {
  playerId: string;
  kills: number;
  survivalSeconds: number;
}

export interface RoundResultEntry {
  /** FRANCHISE matches: the franchise entrant. Omit for FFA (use playerId instead). */
  franchiseId?: string;
  /** FFA matches: the individual player entrant. Omit for FRANCHISE matches. */
  playerId?: string;
  rank: number;
  kills: number;
  survivalSeconds: number;
  /** Optional per-player breakdown; when present team kills are summed from these. */
  players?: PlayerStatEntry[];
}

export interface RoundEntry {
  roundNumber: number;
  mapName?: string;
  mode?: string;
  rows: RoundResultEntry[];
}

export interface EnterRoundsRequest {
  /** Scoring weights for the match; omit to keep the match's current weights. */
  pointsPerKill?: number;
  placementPoints?: string;
  rounds: RoundEntry[];
}

// ---- standings -------------------------------------------------------------

export interface StandingRow {
  rank: number;
  franchiseId: string;
  name: string;
  tag: string;
  points: number;
  active: boolean;
}

export interface StandingsResponse {
  season: string;
  standings: StandingRow[];
}

export interface PlayerRankRow {
  rank: number;
  playerId: string;
  gamerTag: string;
  avatarUrl?: string;
  points: number;
  franchiseTag?: string;
}

export interface GameRankRow {
  rank: number;
  playerId: string;
  gamerTag: string;
  rating: number;
}

// ---- announcements ---------------------------------------------------------

export interface AnnouncementView {
  id: string;
  category: string;
  title: string;
  body: string;
  matchId?: string;
  author?: string;
  publishedAt: string;
  registrationOpen: boolean;
  gameId?: string;
  gameName?: string;
  registrationType?: RegistrationType;
}

export interface CreateAnnouncementRequest {
  category: string;
  title: string;
  body: string;
  matchId?: string;
  registrationOpen?: boolean;
  gameId?: string;
  registrationType?: RegistrationType;
}

// ---- registrations ---------------------------------------------------------

export type RegistrationType = "PLAYER" | "SQUAD" | "FRANCHISE";

export interface ApplyRequest {
  type: RegistrationType;
  squadName?: string;
  games: string[];
  contact?: string;
  matchId?: string;
  /** Only needed for match-less / general sign-ups; match-tied calls derive the game from the match. */
  gameId?: string;
}

export type InviteStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface RegistrationMemberView {
  playerId: string;
  gamerTag: string;
  status: string; // ACCEPTED for the captain, else the invite status
  isCaptain: boolean;
}

export interface RegistrationView {
  id: string;
  type: string;
  player: { id: string; gamerTag: string } | null;
  squadName?: string;
  games: string[];
  contact?: string;
  status: string;
  reviewedBy?: string;
  reason?: string;
  createdAt: string;
  matchId?: string;
  /** Game the sign-up is for — derived from the linked match, or supplied for general calls. */
  gameId?: string;
  gameName?: string;
  members: RegistrationMemberView[];
  acceptedCount: number;
}

export interface InviteView {
  id: string;
  registrationId: string;
  squadName?: string;
  captainGamerTag?: string;
  games: string[];
  status: string;
  message?: string;
  createdAt: string;
}

export interface InviteRequest {
  gamerTag?: string;
  playerId?: string;
  message?: string;
}

// ---- admin / settings ------------------------------------------------------

export interface OverviewResponse {
  pendingRegistrations: number;
  resultsToEnter: number;
  openDisputes: number;
  totals: {
    players: number;
    franchises: number;
    games: number;
    matches: number;
    users: number;
  };
  recentActivity: {
    action: string;
    entityType: string;
    entityId: string;
    detail?: string;
    actorEmail: string;
    at: string;
  }[];
}

export interface SettingsView {
  seasonId: string;
  seasonName: string;
  pointsPerKill: number;
  placementPoints: string;
  registrationOpen: boolean;
  updatedAt: string;
}

export interface UpdateSettingsRequest {
  seasonId?: string;
  seasonName?: string;
  pointsPerKill?: number;
  placementPoints?: string;
  registrationOpen?: boolean;
}

export type DisputeCategory = "RESULT" | "APPEAL" | "GENERAL";

export interface DisputeView {
  id: string;
  matchId?: string;
  /** Display label for the disputed match (the game name); null for match-less disputes. */
  matchTitle?: string;
  reason: string;
  category: DisputeCategory;
  status: string;
  resolution?: string;
  createdAt: string;
}

/**
 * Body for POST /disputes. Pass matchId for result challenges; leave it null for
 * status appeals / general issues. category defaults to RESULT on the backend.
 */
export interface CreateDisputeRequest {
  matchId?: string;
  reason: string;
  category?: DisputeCategory;
}

export interface ResolveDisputeRequest {
  resolution: string;
  dismiss?: boolean;
}

// ---- seasons ---------------------------------------------------------------

export type SeasonStatus = "ACTIVE" | "FINISHED";

export interface SeasonView {
  code: string;
  name: string;
  status: SeasonStatus;
  current: boolean;
  startedAt?: string;
  endedAt?: string;
}

export interface SeasonStandingView {
  rank: number;
  franchiseId: string;
  name: string;
  tag: string;
  points: number;
}

export interface StartSeasonRequest {
  code: string;
  name: string;
}

// ---- notifications ---------------------------------------------------------

export type NotificationType =
  | "GENERAL"
  | "REGISTRATION"
  | "MATCH"
  | "RESULT"
  | "ANNOUNCEMENT"
  | "AUCTION";

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}
