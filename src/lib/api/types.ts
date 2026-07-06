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

/** Genre classification driving type-appropriate result entry + default scoring. */
export type GameType = "BATTLE_ROYALE" | "TACTICAL" | "SPORTS" | "FIGHTING" | "PARTY";

export interface GameSummary {
  id: string;
  name: string;
  format: string;
  iconUrl?: string;
  enabled: boolean;
  popularity: number;
  gameType: GameType;
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
  gameType?: GameType;
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
  proficiencies: {
    gameId: string;
    gameName: string;
    rating: number;
    rankTier?: string | null;
    kd?: number | null;
    accountLevel?: number | null;
  }[];
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
  owner: FranchisePerson | null;
  manager: FranchisePerson | null;
  rosterSize: number;
  matchesPlayed: number;
}

export type FranchiseRole = "OWNER" | "MANAGER";

/** The franchise the current user owns/manages/plays for, plus their role. Null body when none. */
export interface FranchiseMineView {
  franchise: FranchiseDetail;
  myRole: "OWNER" | "MANAGER" | "PLAYER";
}

export interface FranchiseInviteRequest {
  gamerTag?: string;
  playerId?: string;
  role: FranchiseRole;
  message?: string;
}

export interface FranchiseInviteView {
  id: string;
  franchiseId: string;
  franchiseName: string;
  franchiseTag: string;
  role: string; // OWNER | MANAGER
  invitedByGamerTag?: string;
  invitedPlayerGamerTag?: string;
  status: string; // PENDING | ACCEPTED | REJECTED
  message?: string;
  createdAt: string;
}

export interface UpdateFranchiseRequest {
  name?: string;
  tag?: string;
  logoUrl?: string;
  points?: number;
  active?: boolean;
}

export interface RosterMember {
  playerId: string;
  gamerTag: string;
  avatarUrl?: string;
  status: string;
  role: "OWNER" | "MANAGER" | "PLAYER";
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
  gameType?: GameType;
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

/** A franchise's fielded lineup for a match (empty `lineup` = no lineup set → full-roster fallback). */
export interface MatchLineupView {
  franchiseId: string;
  franchiseTag: string;
  franchiseName: string;
  lineup: MatchPlayerView[];
}

export interface SetLineupRequest {
  playerIds: string[];
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
  /** SQUAD registration calls: the configured roster cap for squads registering from this post. */
  teamSize: number | null;
}

export interface CreateAnnouncementRequest {
  category: string;
  title: string;
  body: string;
  matchId?: string;
  registrationOpen?: boolean;
  gameId?: string;
  registrationType?: RegistrationType;
  /** SQUAD registration calls: the roster cap squads registering from this post must respect. */
  teamSize?: number;
}

// ---- registrations ---------------------------------------------------------

export type RegistrationType = "PLAYER" | "SQUAD" | "FRANCHISE" | "AUCTION";

/**
 * Match registrations are live from creation: a SQUAD starts FORMING (open for invites), a solo
 * PLAYER starts ACTIVE; both flip to LOCKED automatically N hours before the match (pending invites
 * are voided). PENDING/APPROVED/REJECTED apply only to admin-curated FRANCHISE-creation proposals
 * (REJECTED = discarded).
 */
export type RegistrationStatus =
  | "FORMING"
  | "ACTIVE"
  | "LOCKED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

/** One game's expertise line in an exhaustive auction self-registration. rating is 0-100. */
export interface ProficiencyEntry {
  gameId: string;
  rating: number;
  handle?: string;
  /** Objective rank/tier label (e.g. "Immortal 2", "Conqueror"). */
  rankTier?: string;
  /** Self-reported kill/death ratio. */
  kd?: number;
  /** Self-reported in-game account level. */
  accountLevel?: number;
}

export interface ApplyRequest {
  type: RegistrationType;
  squadName?: string;
  /** FRANCHISE proposals: requested tag/abbreviation (e.g. "RXG"); derived from the name when blank. */
  franchiseTag?: string;
  games: string[];
  contact?: string;
  matchId?: string;
  /** Only needed for match-less / general sign-ups; match-tied calls derive the game from the match. */
  gameId?: string;
  /** AUCTION registrations: per-game expertise (upserts the player's proficiency + in-game handle). */
  proficiencies?: ProficiencyEntry[];
  /** AUCTION registrations: a free-form note shown to admins. */
  note?: string;
  /** SQUAD registrations: the invite/roster cap for the squad (from the announcement's teamSize). */
  teamSize?: number;
}

/** EXPIRED = a still-pending invite voided when the registration locked. */
export type InviteStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";

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
  /** FRANCHISE proposals: the requested tag/abbreviation (null when none supplied). */
  franchiseTag?: string | null;
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
  /** SQUAD registrations: the invite/roster cap (null = uncapped). */
  teamSize: number | null;
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
  /** The squad's confirmed/pending roster, so an invitee can see who's already on the team. */
  members: { gamerTag: string; status: string; isCaptain: boolean }[];
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
  /** Match registrations lock this many hours before the match starts. */
  registrationLockHours: number;
  updatedAt: string;
}

export interface UpdateSettingsRequest {
  seasonId?: string;
  seasonName?: string;
  pointsPerKill?: number;
  placementPoints?: string;
  registrationOpen?: boolean;
  registrationLockHours?: number;
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
  /** Display name of the user who raised the dispute; null if unknown. */
  raisedByName?: string;
  /** Gamer tag of the raiser's player profile; null if the raiser has no player. */
  raisedByGamerTag?: string;
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

// ---- auction ---------------------------------------------------------------

export type AuctionStatus = "DRAFT" | "LOBBY" | "LIVE" | "PAUSED" | "COMPLETED";
export type AuctionLotStatus = "QUEUED" | "ON_BLOCK" | "SOLD" | "UNSOLD";

export interface AuctionLotView {
  id: string;
  playerId: string;
  gamerTag: string;
  status: AuctionLotStatus;
  currentBid: number;
  /** The exact minimum the next bid must meet (basePrice, or currentBid + smallest increment). */
  minNextBid: number;
  currentBidderFranchiseId?: string;
  currentBidderTag?: string;
  soldToFranchiseId?: string;
  soldToTag?: string;
  soldPrice: number;
  /** When the current bid timer expires (server-authoritative). */
  bidDeadline?: string;
  /**
   * When bidding opens (server-authoritative). During the short review window after a lot is
   * nominated, franchises can study the player but cannot bid until this instant passes. Null when
   * there's no review window or it has already opened.
   */
  bidOpensAt: string | null;
  lotOrder: number;
  /** Games this player registered for the auction with. */
  games: string[];
  /** Per-game expertise the player self-reported at registration (rating 0-100 + objective signals). */
  expertise: {
    game: string;
    rating: number;
    handle: string | null;
    rankTier?: string | null;
    kd?: number | null;
    accountLevel?: number | null;
  }[];
  /** Free-form contact the player supplied at registration; null if none. */
  contact: string | null;
}

export interface AuctionFranchiseView {
  franchiseId: string;
  name: string;
  tag: string;
  budget: number;
  balance: number;
  acquiredCount: number;
  /** Whether this franchise has joined the auction hall / is present. */
  joined: boolean;
}

export interface AuctionBidView {
  lotId: string;
  playerGamerTag: string;
  franchiseTag: string;
  amount: number;
  at: string;
}

export interface AuctionView {
  id: string;
  title: string;
  seasonId?: string;
  status: AuctionStatus;
  basePrice: number;
  bidTimerSeconds: number;
  antiSnipeSeconds: number;
  raiseIncrements: number[];
  /** Authoritative server clock — reconcile the countdown against this each poll. */
  serverTime: string;
  /** When the auction is scheduled to open, if set; null otherwise (ISO instant). */
  scheduledAt: string | null;
  /** When set and in the future, a lot just sold and the room is in a brief SOLD intermission. */
  intermissionUntil: string | null;
  currentLot: AuctionLotView | null;
  franchises: AuctionFranchiseView[];
  lots: AuctionLotView[];
  recentBids: AuctionBidView[];
}

export interface CreateAuctionRequest {
  title: string;
  seasonId?: string;
  basePrice: number;
  bidTimerSeconds: number;
  antiSnipeSeconds?: number;
  raiseIncrements: number[];
  defaultBudget: number;
  participantFranchiseIds: string[];
  playerIds?: string[];
  /** Optional scheduled open time (ISO instant). */
  scheduledAt?: string;
}

/** Edit an auction's config while DRAFT/LOBBY (all fields optional; only non-null applied). */
export interface UpdateAuctionRequest {
  basePrice?: number;
  bidTimerSeconds?: number;
  antiSnipeSeconds?: number;
  raiseIncrements?: number[];
  defaultBudget?: number;
  intermissionSeconds?: number;
  scheduledAt?: string;
  participantFranchiseIds?: string[];
}

export interface PlaceBidRequest {
  lotId: string;
  amount: number;
}

export interface AssignRequest {
  lotId: string;
  franchiseId: string;
  price: number;
}

export interface AddFundsRequest {
  franchiseId: string;
  amount: number;
}
