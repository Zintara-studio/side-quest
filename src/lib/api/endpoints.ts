// Typed wrappers over every backend endpoint the frontend consumes, grouped by domain.
// All paths are relative to the /v1 context-path baked into `api`'s baseURL.
import { api } from "@/lib/api/client";
import type {
  AnnouncementView,
  ApplyRequest,
  AuthResponse,
  CreateAnnouncementRequest,
  CreateDisputeRequest,
  CreateFranchiseRequest,
  CreateMatchRequest,
  DisputeView,
  EligiblePlayer,
  EnterResultsRequest,
  FranchiseDetail,
  FranchiseMatchView,
  FranchiseSummary,
  GameDetail,
  GameRankRow,
  GameSummary,
  EnterRoundsRequest,
  InviteRequest,
  InviteView,
  LoginRequest,
  MatchDetail,
  MatchPlayerView,
  MatchRoundView,
  MatchSummary,
  MeResponse,
  NotificationView,
  OverviewResponse,
  PageResponse,
  UnreadCountResponse,
  PlayerDetail,
  PlayerMatchView,
  PlayerRankRow,
  PlayerSummary,
  RegisterRequest,
  RegistrationView,
  ResolveDisputeRequest,
  ResultView,
  RosterMember,
  SeasonStandingView,
  SeasonView,
  SettingsView,
  StandingsResponse,
  StartSeasonRequest,
  UpdateFranchiseRequest,
  UpdateGameRequest,
  UpdatePlayerRequest,
  UpdateSettingsRequest,
  UsernameView,
} from "@/lib/api/types";

type Params = Record<string, string | number | boolean | undefined>;

const clean = (params?: Params): Params | undefined => {
  if (!params) return undefined;
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out[k] = v;
  return out;
};

// ---- auth ------------------------------------------------------------------

export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<AuthResponse>("/auth/register", body).then((r) => r.data),
  login: (body: LoginRequest) =>
    api.post<AuthResponse>("/auth/login", body).then((r) => r.data),
  logout: (refreshToken?: string) =>
    api.post<void>("/auth/logout", { refreshToken }).then((r) => r.data),
  me: () => api.get<MeResponse>("/auth/me").then((r) => r.data),
};

// ---- games -----------------------------------------------------------------

export const gamesApi = {
  list: (enabled?: boolean) =>
    api.get<GameSummary[]>("/games", { params: clean({ enabled }) }).then((r) => r.data),
  get: (id: string) => api.get<GameDetail>(`/games/${id}`).then((r) => r.data),
  update: (id: string, body: UpdateGameRequest) =>
    api.patch<GameDetail>(`/games/${id}`, body).then((r) => r.data),
};

// ---- players ---------------------------------------------------------------

export interface PlayerListParams {
  franchiseId?: string;
  gameId?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export const playersApi = {
  list: (params?: PlayerListParams) =>
    api
      .get<PageResponse<PlayerSummary>>("/players", { params: clean(params as Params) })
      .then((r) => r.data),
  get: (id: string) => api.get<PlayerDetail>(`/players/${id}`).then((r) => r.data),
  matches: (id: string) =>
    api.get<PlayerMatchView[]>(`/players/${id}/matches`).then((r) => r.data),
  usernames: (id: string) =>
    api.get<UsernameView[]>(`/players/${id}/usernames`).then((r) => r.data),
  update: (id: string, body: UpdatePlayerRequest) =>
    api.patch<PlayerDetail>(`/players/${id}`, body).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<PlayerDetail>(`/players/${id}/status`, { status }).then((r) => r.data),
};

// ---- franchises ------------------------------------------------------------

export interface FranchiseListParams {
  active?: boolean;
  seasonId?: string;
  limit?: number;
  cursor?: string;
}

export const franchisesApi = {
  list: (params?: FranchiseListParams) =>
    api
      .get<PageResponse<FranchiseSummary>>("/franchises", { params: clean(params as Params) })
      .then((r) => r.data),
  get: (id: string) => api.get<FranchiseDetail>(`/franchises/${id}`).then((r) => r.data),
  roster: (id: string) =>
    api.get<RosterMember[]>(`/franchises/${id}/roster`).then((r) => r.data),
  matches: (id: string) =>
    api.get<FranchiseMatchView[]>(`/franchises/${id}/matches`).then((r) => r.data),
  create: (body: CreateFranchiseRequest) =>
    api.post<FranchiseDetail>("/franchises", body).then((r) => r.data),
  update: (id: string, body: UpdateFranchiseRequest) =>
    api.patch<FranchiseDetail>(`/franchises/${id}`, body).then((r) => r.data),
  assignPlayer: (id: string, playerId: string) =>
    api.post<RosterMember[]>(`/franchises/${id}/roster`, { playerId }).then((r) => r.data),
  setOwner: (id: string, playerId: string) =>
    api.post<FranchiseDetail>(`/franchises/${id}/owner`, { playerId }).then((r) => r.data),
  setManager: (id: string, playerId: string) =>
    api.post<FranchiseDetail>(`/franchises/${id}/manager`, { playerId }).then((r) => r.data),
  discard: (id: string) =>
    api.post<FranchiseDetail>(`/franchises/${id}/discard`).then((r) => r.data),
  eligibleOwners: (id: string) =>
    api.get<EligiblePlayer[]>(`/franchises/${id}/eligible-owners`).then((r) => r.data),
  createFromProposal: (registrationId: string) =>
    api
      .post<FranchiseDetail>(`/franchises/from-proposal/${registrationId}`)
      .then((r) => r.data),
};

// ---- matches ---------------------------------------------------------------

export interface MatchListParams {
  status?: string;
  gameId?: string;
  limit?: number;
  cursor?: string;
}

export const matchesApi = {
  list: (params?: MatchListParams) =>
    api
      .get<PageResponse<MatchSummary>>("/matches", { params: clean(params as Params) })
      .then((r) => r.data),
  create: (body: CreateMatchRequest) =>
    api.post<MatchDetail>("/matches", body).then((r) => r.data),
  get: (id: string) => api.get<MatchDetail>(`/matches/${id}`).then((r) => r.data),
  leaderboard: (id: string) =>
    api.get<ResultView[]>(`/matches/${id}/leaderboard`).then((r) => r.data),
  rounds: (id: string) =>
    api.get<MatchRoundView[]>(`/matches/${id}/rounds`).then((r) => r.data),
  players: (id: string) =>
    api.get<MatchPlayerView[]>(`/matches/${id}/players`).then((r) => r.data),
  enterResults: (id: string, body: EnterResultsRequest) =>
    api.post<ResultView[]>(`/matches/${id}/results`, body).then((r) => r.data),
  enterRounds: (id: string, body: EnterRoundsRequest) =>
    api.post<ResultView[]>(`/matches/${id}/rounds`, body).then((r) => r.data),
};

// ---- standings -------------------------------------------------------------

export const standingsApi = {
  standings: () => api.get<StandingsResponse>("/standings").then((r) => r.data),
  topPlayers: (limit = 20) =>
    api
      .get<PlayerRankRow[]>("/leaderboard/players", { params: { limit } })
      .then((r) => r.data),
  gameRankings: (id: string) =>
    api.get<GameRankRow[]>(`/leaderboard/games/${id}`).then((r) => r.data),
};

// ---- announcements ---------------------------------------------------------

export interface AnnouncementListParams {
  category?: string;
  limit?: number;
  cursor?: string;
}

export const announcementsApi = {
  list: (params?: AnnouncementListParams) =>
    api
      .get<PageResponse<AnnouncementView>>("/announcements", { params: clean(params as Params) })
      .then((r) => r.data),
  get: (id: string) => api.get<AnnouncementView>(`/announcements/${id}`).then((r) => r.data),
  create: (body: CreateAnnouncementRequest) =>
    api.post<AnnouncementView>("/announcements", body).then((r) => r.data),
  remove: (id: string) => api.delete<void>(`/announcements/${id}`).then((r) => r.data),
};

// ---- registrations ---------------------------------------------------------

export interface RegistrationListParams {
  status?: string;
  type?: string;
  limit?: number;
  cursor?: string;
}

export const registrationsApi = {
  apply: (body: ApplyRequest) =>
    api.post<RegistrationView>("/registrations", body).then((r) => r.data),
  list: (params?: RegistrationListParams) =>
    api
      .get<PageResponse<RegistrationView>>("/registrations", { params: clean(params as Params) })
      .then((r) => r.data),
  mine: () => api.get<RegistrationView[]>("/registrations/mine").then((r) => r.data),
  myInvites: () => api.get<InviteView[]>("/registrations/invites/mine").then((r) => r.data),
  invite: (id: string, body: InviteRequest) =>
    api.post<RegistrationView>(`/registrations/${id}/invite`, body).then((r) => r.data),
  acceptInvite: (inviteId: string) =>
    api.post<InviteView>(`/registrations/invites/${inviteId}/accept`).then((r) => r.data),
  rejectInvite: (inviteId: string) =>
    api.post<InviteView>(`/registrations/invites/${inviteId}/reject`).then((r) => r.data),
  approve: (id: string, reason?: string) =>
    api.post<RegistrationView>(`/registrations/${id}/approve`, { reason }).then((r) => r.data),
  reject: (id: string, reason?: string) =>
    api.post<RegistrationView>(`/registrations/${id}/reject`, { reason }).then((r) => r.data),
};

// ---- admin / settings ------------------------------------------------------

export const adminApi = {
  overview: () => api.get<OverviewResponse>("/admin/overview").then((r) => r.data),
  settings: () => api.get<SettingsView>("/settings").then((r) => r.data),
  updateSettings: (body: UpdateSettingsRequest) =>
    api.patch<SettingsView>("/settings", body).then((r) => r.data),
  disputes: () => api.get<DisputeView[]>("/admin/disputes").then((r) => r.data),
  resolveDispute: (id: string, body: ResolveDisputeRequest) =>
    api.post<DisputeView>(`/admin/disputes/${id}/resolve`, body).then((r) => r.data),
};

// ---- disputes (any logged-in user) ----------------------------------------

export const disputesApi = {
  create: (body: CreateDisputeRequest) =>
    api.post<DisputeView>("/disputes", body).then((r) => r.data),
  mine: () => api.get<DisputeView[]>("/disputes/mine").then((r) => r.data),
};

// ---- seasons ---------------------------------------------------------------

export const seasonsApi = {
  list: () => api.get<SeasonView[]>("/seasons").then((r) => r.data),
  current: () => api.get<SeasonView | "">("/seasons/current").then((r) => r.data || null),
  standings: (code: string) =>
    api.get<SeasonStandingView[]>(`/seasons/${code}/standings`).then((r) => r.data),
  allTimeStandings: () =>
    api.get<SeasonStandingView[]>("/seasons/all-time/standings").then((r) => r.data),
  start: (body: StartSeasonRequest) =>
    api.post<SeasonView>("/seasons/start", body).then((r) => r.data),
  finish: () => api.post<SeasonView>("/seasons/finish").then((r) => r.data),
};

// ---- notifications ---------------------------------------------------------

export const notificationsApi = {
  list: () => api.get<NotificationView[]>("/notifications").then((r) => r.data),
  unreadCount: () =>
    api.get<UnreadCountResponse>("/notifications/unread-count").then((r) => r.data),
  markRead: (id: string) =>
    api.post<NotificationView>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post<void>("/notifications/read-all").then((r) => r.data),
};
