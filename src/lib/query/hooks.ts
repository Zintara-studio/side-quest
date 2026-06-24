// TanStack Query hooks over the typed endpoint functions. Screens import these instead of
// reading from src/lib/mock/*. Query keys are namespaced per domain for easy invalidation.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  announcementsApi,
  franchisesApi,
  gamesApi,
  matchesApi,
  notificationsApi,
  playersApi,
  registrationsApi,
  seasonsApi,
  standingsApi,
  type AnnouncementListParams,
  type FranchiseListParams,
  type MatchListParams,
  type PlayerListParams,
  type RegistrationListParams,
} from "@/lib/api/endpoints";
import type {
  ApplyRequest,
  CreateAnnouncementRequest,
  CreateFranchiseRequest,
  CreateMatchRequest,
  EnterResultsRequest,
  EnterRoundsRequest,
  InviteRequest,
  ResolveDisputeRequest,
  StartSeasonRequest,
  UpdateFranchiseRequest,
  UpdateGameRequest,
  UpdatePlayerRequest,
  UpdateSettingsRequest,
} from "@/lib/api/types";

export const qk = {
  games: (enabled?: boolean) => ["games", { enabled }] as const,
  game: (id: string) => ["games", id] as const,
  players: (p?: PlayerListParams) => ["players", p ?? {}] as const,
  player: (id: string) => ["players", id] as const,
  playerMatches: (id: string) => ["players", id, "matches"] as const,
  playerUsernames: (id: string) => ["players", id, "usernames"] as const,
  franchises: (p?: FranchiseListParams) => ["franchises", p ?? {}] as const,
  franchise: (id: string) => ["franchises", id] as const,
  franchiseRoster: (id: string) => ["franchises", id, "roster"] as const,
  franchiseMatches: (id: string) => ["franchises", id, "matches"] as const,
  matches: (p?: MatchListParams) => ["matches", p ?? {}] as const,
  match: (id: string) => ["matches", id] as const,
  matchLeaderboard: (id: string) => ["matches", id, "leaderboard"] as const,
  matchRounds: (id: string) => ["matches", id, "rounds"] as const,
  standings: () => ["standings"] as const,
  topPlayers: (limit: number) => ["leaderboard", "players", limit] as const,
  announcements: (p?: AnnouncementListParams) => ["announcements", p ?? {}] as const,
  registrations: (p?: RegistrationListParams) => ["registrations", p ?? {}] as const,
  adminOverview: () => ["admin", "overview"] as const,
  settings: () => ["settings"] as const,
};

// ---- games -----------------------------------------------------------------

export const useGames = (enabled?: boolean) =>
  useQuery({ queryKey: qk.games(enabled), queryFn: () => gamesApi.list(enabled) });

export const useGame = (id: string | undefined) =>
  useQuery({ queryKey: qk.game(id ?? ""), queryFn: () => gamesApi.get(id!), enabled: !!id });

export const useUpdateGame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGameRequest }) =>
      gamesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
};

// ---- players ---------------------------------------------------------------

export const usePlayers = (params?: PlayerListParams) =>
  useQuery({ queryKey: qk.players(params), queryFn: () => playersApi.list(params) });

export const usePlayer = (id: string | undefined) =>
  useQuery({ queryKey: qk.player(id ?? ""), queryFn: () => playersApi.get(id!), enabled: !!id });

export const usePlayerMatches = (id: string | undefined) =>
  useQuery({
    queryKey: qk.playerMatches(id ?? ""),
    queryFn: () => playersApi.matches(id!),
    enabled: !!id,
  });

export const usePlayerUsernames = (id: string | undefined) =>
  useQuery({
    queryKey: qk.playerUsernames(id ?? ""),
    queryFn: () => playersApi.usernames(id!),
    enabled: !!id,
  });

export const useUpdatePlayer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePlayerRequest }) =>
      playersApi.update(id, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.player(v.id) }),
  });
};

export const useUpdatePlayerStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      playersApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
};

// ---- franchises ------------------------------------------------------------

export const useFranchises = (params?: FranchiseListParams) =>
  useQuery({ queryKey: qk.franchises(params), queryFn: () => franchisesApi.list(params) });

export const useFranchise = (id: string | undefined) =>
  useQuery({
    queryKey: qk.franchise(id ?? ""),
    queryFn: () => franchisesApi.get(id!),
    enabled: !!id,
  });

export const useFranchiseRoster = (id: string | undefined) =>
  useQuery({
    queryKey: qk.franchiseRoster(id ?? ""),
    queryFn: () => franchisesApi.roster(id!),
    enabled: !!id,
  });

export const useFranchiseMatches = (id: string | undefined) =>
  useQuery({
    queryKey: qk.franchiseMatches(id ?? ""),
    queryFn: () => franchisesApi.matches(id!),
    enabled: !!id,
  });

const invalidateFranchises = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["franchises"] });
  qc.invalidateQueries({ queryKey: ["standings"] });
  qc.invalidateQueries({ queryKey: ["players"] });
};

export const useCreateFranchise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFranchiseRequest) => franchisesApi.create(body),
    onSuccess: () => invalidateFranchises(qc),
  });
};

export const useUpdateFranchise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFranchiseRequest }) =>
      franchisesApi.update(id, body),
    onSuccess: () => invalidateFranchises(qc),
  });
};

export const useDiscardFranchise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => franchisesApi.discard(id),
    onSuccess: () => invalidateFranchises(qc),
  });
};

export const useSetFranchiseOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, playerId }: { id: string; playerId: string }) =>
      franchisesApi.setOwner(id, playerId),
    onSuccess: () => invalidateFranchises(qc),
  });
};

export const useSetFranchiseManager = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, playerId }: { id: string; playerId: string }) =>
      franchisesApi.setManager(id, playerId),
    onSuccess: () => invalidateFranchises(qc),
  });
};

// ---- matches ---------------------------------------------------------------

export const useMatches = (params?: MatchListParams) =>
  useQuery({ queryKey: qk.matches(params), queryFn: () => matchesApi.list(params) });

export const useMatch = (id: string | undefined) =>
  useQuery({ queryKey: qk.match(id ?? ""), queryFn: () => matchesApi.get(id!), enabled: !!id });

export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMatchRequest) => matchesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
};

export const useMatchLeaderboard = (id: string | undefined) =>
  useQuery({
    queryKey: qk.matchLeaderboard(id ?? ""),
    queryFn: () => matchesApi.leaderboard(id!),
    enabled: !!id,
  });

export const useMatchRounds = (id: string | undefined) =>
  useQuery({
    queryKey: qk.matchRounds(id ?? ""),
    queryFn: () => matchesApi.rounds(id!),
    enabled: !!id,
  });

export const useMatchPlayers = (id: string | undefined) =>
  useQuery({
    queryKey: ["matches", id ?? "", "players"],
    queryFn: () => matchesApi.players(id!),
    enabled: !!id,
  });

export const useEnterResults = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EnterResultsRequest }) =>
      matchesApi.enterResults(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.matchLeaderboard(v.id) });
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

export const useEnterRounds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EnterRoundsRequest }) =>
      matchesApi.enterRounds(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.matchLeaderboard(v.id) });
      qc.invalidateQueries({ queryKey: qk.matchRounds(v.id) });
      qc.invalidateQueries({ queryKey: qk.match(v.id) });
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

// ---- standings / leaderboards ---------------------------------------------

export const useStandings = () =>
  useQuery({ queryKey: qk.standings(), queryFn: () => standingsApi.standings() });

export const useTopPlayers = (limit = 20) =>
  useQuery({ queryKey: qk.topPlayers(limit), queryFn: () => standingsApi.topPlayers(limit) });

// ---- announcements ---------------------------------------------------------

export const useAnnouncements = (params?: AnnouncementListParams) =>
  useQuery({ queryKey: qk.announcements(params), queryFn: () => announcementsApi.list(params) });

export const useAnnouncement = (id: string | undefined) =>
  useQuery({
    queryKey: ["announcements", id ?? ""],
    queryFn: () => announcementsApi.get(id!),
    enabled: !!id,
  });

export const useCreateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnnouncementRequest) => announcementsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
};

export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
};

// ---- registrations ---------------------------------------------------------

export const useRegistrations = (params?: RegistrationListParams) =>
  useQuery({ queryKey: qk.registrations(params), queryFn: () => registrationsApi.list(params) });

export const useApplyRegistration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyRequest) => registrationsApi.apply(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
};

export const useMyRegistrations = (enabled = true) =>
  useQuery({
    queryKey: ["registrations", "mine"],
    queryFn: () => registrationsApi.mine(),
    enabled,
  });

export const useMyInvites = (enabled = true) =>
  useQuery({
    queryKey: ["registrations", "invites", "mine"],
    queryFn: () => registrationsApi.myInvites(),
    enabled,
  });

export const useInviteTeammate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: InviteRequest }) =>
      registrationsApi.invite(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
};

export const useRespondInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      accept
        ? registrationsApi.acceptInvite(inviteId)
        : registrationsApi.rejectInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useReviewRegistration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "approve" | "reject";
      reason?: string;
    }) =>
      action === "approve"
        ? registrationsApi.approve(id, reason)
        : registrationsApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
};

// ---- admin -----------------------------------------------------------------

export const useAdminOverview = () =>
  useQuery({ queryKey: qk.adminOverview(), queryFn: () => adminApi.overview() });

export const useSettings = () =>
  useQuery({ queryKey: qk.settings(), queryFn: () => adminApi.settings() });

export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSettingsRequest) => adminApi.updateSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings() }),
  });
};

export const useDisputes = () =>
  useQuery({ queryKey: ["admin", "disputes"], queryFn: () => adminApi.disputes() });

export const useResolveDispute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveDisputeRequest }) =>
      adminApi.resolveDispute(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
      qc.invalidateQueries({ queryKey: qk.adminOverview() });
    },
  });
};

// ---- seasons ---------------------------------------------------------------

export const useSeasons = () =>
  useQuery({ queryKey: ["seasons"], queryFn: () => seasonsApi.list() });

export const useCurrentSeason = () =>
  useQuery({ queryKey: ["seasons", "current"], queryFn: () => seasonsApi.current() });

export const useSeasonStandings = (code: string | undefined) =>
  useQuery({
    queryKey: ["seasons", code ?? "", "standings"],
    queryFn: () => seasonsApi.standings(code!),
    enabled: !!code,
  });

const invalidateSeasonWorld = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["seasons"] });
  qc.invalidateQueries({ queryKey: ["franchises"] });
  qc.invalidateQueries({ queryKey: ["standings"] });
  qc.invalidateQueries({ queryKey: ["players"] });
  qc.invalidateQueries({ queryKey: qk.settings() });
};

export const useStartSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartSeasonRequest) => seasonsApi.start(body),
    onSuccess: () => invalidateSeasonWorld(qc),
  });
};

export const useFinishSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => seasonsApi.finish(),
    onSuccess: () => invalidateSeasonWorld(qc),
  });
};

// ---- notifications ---------------------------------------------------------

export const useNotifications = (enabled = true) =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    enabled,
  });

export const useUnreadCount = (enabled = true) =>
  useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};
