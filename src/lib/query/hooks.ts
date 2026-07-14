// TanStack Query hooks over the typed endpoint functions. Screens import these instead of
// reading from src/lib/mock/*. Query keys are namespaced per domain for easy invalidation.
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  adminApi,
  announcementsApi,
  auctionsApi,
  disputesApi,
  franchisesApi,
  gamesApi,
  matchesApi,
  mediaApi,
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
  UpdateAnnouncementRequest,
  CreateDisputeRequest,
  CreateFranchiseRequest,
  CreateMatchRequest,
  AddFundsRequest,
  AssignRequest,
  AuctionView,
  CreateAuctionRequest,
  EnterRoundsRequest,
  FranchiseInviteRequest,
  InviteRequest,
  PlaceBidRequest,
  ResolveDisputeRequest,
  StartSeasonRequest,
  UpdateAuctionRequest,
  UpdateBrandingRequest,
  CreateGameRequest,
  UpdateGameRequest,
  UpdateProfileRequest,
  UpdateSettingsRequest,
  OnboardRequest,
  SaveVotesRequest,
} from "@/lib/api/types";

// Per-domain cache freshness. The global default (providers.tsx) is 30s; these lengthen it for data
// that changes rarely, so navigating between pages stops refetching near-static data every time. Every
// mutation still invalidates the relevant keys, so longer windows never surface stale data after a write.
const MINUTE = 60_000;
const STALE_STATIC = 10 * MINUTE; // catalog: games, seasons
const STALE_SEMI = 3 * MINUTE; // directories & standings
const STALE_LIST = MINUTE; // filtered lists & admin badges

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
  useQuery({
    queryKey: qk.games(enabled),
    queryFn: () => gamesApi.list(enabled),
    staleTime: STALE_STATIC,
  });

export const useUpdateGame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGameRequest }) =>
      gamesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
};

export const useCreateGame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGameRequest) => gamesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
};

/** Main admin: seed the static games catalogue into the DB. */
export const useSeedStaticConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.seed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
};

/** The signed-in user's game upvotes (to pre-select the vote panel). Enabled only when logged in. */
export const useMyGameVotes = (enabled: boolean) =>
  useQuery({
    queryKey: ["games", "my-votes"],
    queryFn: () => gamesApi.myVotes(),
    enabled,
    staleTime: STALE_STATIC,
  });

/** Save the caller's game upvotes; the server recomputes popularity → refresh the games grid + votes. */
export const useSaveGameVotes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveVotesRequest) => gamesApi.saveVotes(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["games"] }),
  });
};

// ---- players ---------------------------------------------------------------

export const usePlayers = (params?: PlayerListParams) =>
  useQuery({
    queryKey: qk.players(params),
    queryFn: () => playersApi.list(params),
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,
  });

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

export const useUpdatePlayerStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      playersApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
};

/** Owner/admin edits a player's profile (contact fields, privacy, per-game skill/handle). */
export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProfileRequest }) =>
      playersApi.updateProfile(id, body),
    onSuccess: (updated, v) => {
      qc.setQueryData(qk.player(v.id), updated);
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: qk.playerUsernames(v.id) });
      // The edited player may appear on a franchise roster (contact fields / avatar).
      qc.invalidateQueries({ queryKey: ["franchises"] });
    },
  });
};

/**
 * Live username-availability for the signup / onboarding forms. Feed it an ALREADY-debounced value —
 * the query key changes per value, so debounce in the component to avoid a request per keystroke.
 * Disabled below the minimum length so short/empty inputs don't hit the API.
 */
export const useUsernameAvailability = (debouncedUsername: string) => {
  const value = debouncedUsername.trim();
  return useQuery({
    queryKey: ["username-available", value.toLowerCase()],
    queryFn: () => playersApi.usernameAvailable(value),
    enabled: value.length >= 3,
    staleTime: 30_000,
    retry: false,
  });
};

/** First-time SSO onboarding: claim the username + apply the profile, then refresh derived caches. */
export const useOnboard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OnboardRequest) => playersApi.onboard(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
};

/** Upload a small image (base64) → returns its serving url. No cache impact on its own. */
export const useUploadMedia = () =>
  useMutation({
    mutationFn: ({ data, kind }: { data: string; kind: "avatar" | "logo" | "banner" }) =>
      mediaApi.upload(data, kind),
  });

/** Franchise owner/admin updates the franchise logo/banner. */
export const useUpdateFranchiseBranding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBrandingRequest }) =>
      franchisesApi.updateBranding(id, body),
    onSuccess: (updated, v) => {
      qc.setQueryData(qk.franchise(v.id), updated);
      qc.invalidateQueries({ queryKey: ["franchises"] });
    },
  });
};

// ---- franchises ------------------------------------------------------------

export const useFranchises = (params?: FranchiseListParams) =>
  useQuery({
    queryKey: qk.franchises(params),
    queryFn: () => franchisesApi.list(params),
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,
  });

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

/** Owner/manager/admin sets a roster player's franchise-private designation tags. */
export const useSetRosterTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, playerId, tags }: { id: string; playerId: string; tags: string[] }) =>
      franchisesApi.setRosterTags(id, playerId, tags),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.franchiseRoster(v.id) }),
  });
};

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

export const useDiscardFranchise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => franchisesApi.discard(id),
    onSuccess: () => invalidateFranchises(qc),
  });
};

export const useRestoreFranchise = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => franchisesApi.restore(id),
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

/** The franchise the current user owns/manages/plays for (+ their role), or null. */
export const useMyFranchise = (enabled = true) =>
  useQuery({
    queryKey: ["franchises", "mine"],
    queryFn: () => franchisesApi.mine(),
    enabled,
  });

/** Owner/manager offers addressed to the current user (franchise leadership invites). */
export const useMyFranchiseInvites = (enabled = true) =>
  useQuery({
    queryKey: ["franchise-invites", "mine"],
    queryFn: () => franchisesApi.myInvites(),
    enabled,
  });

/** A franchise's outstanding (PENDING) owner/manager invites (owner/admin only). */
export const useFranchisePendingInvites = (franchiseId?: string) =>
  useQuery({
    queryKey: ["franchises", franchiseId ?? "", "invites"],
    queryFn: () => franchisesApi.pendingInvites(franchiseId!),
    enabled: !!franchiseId,
  });

/** Owner (or admin) invites a user to become the franchise OWNER (transfer) or MANAGER. */
export const useCreateFranchiseInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FranchiseInviteRequest }) =>
      franchisesApi.createInvite(id, body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["franchises", v.id, "invites"] });
      qc.invalidateQueries({ queryKey: ["franchise-invites"] });
    },
  });
};

/** The invitee accepts/declines a franchise owner/manager invite. */
export const useRespondFranchiseInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      accept ? franchisesApi.acceptInvite(inviteId) : franchisesApi.rejectInvite(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["franchise-invites"] });
      qc.invalidateQueries({ queryKey: ["franchises"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

/** A match's per-franchise fielded lineups. */
export const useMatchLineups = (matchId?: string) =>
  useQuery({
    queryKey: ["matches", matchId ?? "", "lineups"],
    queryFn: () => matchesApi.lineups(matchId!),
    enabled: !!matchId,
  });

/** Owner/manager (or admin) sets a franchise's fielded lineup for a match. */
export const useSetLineup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, franchiseId, playerIds }: { id: string; franchiseId: string; playerIds: string[] }) =>
      matchesApi.setLineup(id, franchiseId, playerIds),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["matches", v.id, "lineups"] });
      qc.invalidateQueries({ queryKey: ["matches", v.id, "players"] });
    },
  });
};

/** Verified players eligible to fill this franchise's owner/manager slot. */
export const useEligibleOwners = (franchiseId?: string) =>
  useQuery({
    queryKey: ["franchises", franchiseId ?? "", "eligible-owners"],
    queryFn: () => franchisesApi.eligibleOwners(franchiseId!),
    enabled: !!franchiseId,
  });

/** Promote a FRANCHISE-type registration proposal into a real franchise. */
export const useCreateFranchiseFromProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: string) =>
      franchisesApi.createFromProposal(registrationId),
    onSuccess: () => {
      invalidateFranchises(qc);
      qc.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
};

// ---- matches ---------------------------------------------------------------

export const useMatches = (params?: MatchListParams) =>
  useQuery({
    queryKey: qk.matches(params),
    queryFn: () => matchesApi.list(params),
    staleTime: STALE_LIST,
    placeholderData: keepPreviousData,
  });

/** Cursor-paginated matches for the archive: accumulate pages via "Load more". */
export const useMatchesInfinite = (params?: MatchListParams) =>
  useInfiniteQuery({
    queryKey: [...qk.matches(params), "infinite"],
    queryFn: ({ pageParam }) =>
      matchesApi.list({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_LIST,
    placeholderData: keepPreviousData,
  });

export const useMatch = (id: string | undefined) =>
  useQuery({ queryKey: qk.match(id ?? ""), queryFn: () => matchesApi.get(id!), enabled: !!id });

export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMatchRequest) => matchesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
};

// ---- admin match lifecycle (start / end / reschedule / delete) ----

const afterMatchTransition = (qc: ReturnType<typeof useQueryClient>, id: string) => {
  qc.invalidateQueries({ queryKey: ["matches"] });
  qc.invalidateQueries({ queryKey: qk.match(id) });
  qc.invalidateQueries({ queryKey: ["matches", "my-rooms"] });
  qc.invalidateQueries({ queryKey: ["matches", id, "room"] });
};

export const useStartMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roomId, venue }: { id: string; roomId?: string; venue?: string }) =>
      matchesApi.start(id, { roomId, venue }),
    onSuccess: (_d, v) => afterMatchTransition(qc, v.id),
  });
};

export const useEndMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => matchesApi.end(id),
    onSuccess: (_d, id) => afterMatchTransition(qc, id),
  });
};

export const useRescheduleMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      matchesApi.reschedule(id, scheduledAt),
    onSuccess: (_d, v) => afterMatchTransition(qc, v.id),
  });
};

export const useDeleteMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => matchesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
};

/** Void a fixture (status → CANCELLED). Keeps the record; a completed match's points drop out. */
export const useVoidMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => matchesApi.update(id, { status: "CANCELLED" }),
    onSuccess: (_d, id) => {
      afterMatchTransition(qc, id);
      // Voiding a completed match recomputes the standings + leaderboards.
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["franchises"] });
    },
  });
};

// ---- match room (participant-only, polled while live) ----

/** The current user's live match rooms, for the home card. Polls modestly so a going-live match appears. */
export const useMyMatchRooms = (enabled = true) =>
  useQuery({
    queryKey: ["matches", "my-rooms"],
    queryFn: () => matchesApi.myRooms(),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

/**
 * The participant-only match room. Polls fast (4s) while the room is live; stops once it isn't (or on a
 * 403/404 for non-participants). `enabled` gates it to authenticated + live contexts.
 */
export const useMatchRoom = (id: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ["matches", id ?? "", "room"],
    queryFn: () => matchesApi.room(id!),
    enabled: !!id && enabled,
    retry: false, // a 403/404 (non-participant / gone) shouldn't be retried
    refetchInterval: (q) => (q.state.data?.live ? 4_000 : false),
    refetchOnWindowFocus: true,
  });

export const usePostMatchMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => matchesApi.postMessage(id, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["matches", v.id, "room"] }),
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
      // Publishing changes franchise points, which feed per-season + all-time standings.
      qc.invalidateQueries({ queryKey: ["seasons"] });
    },
  });
};

// ---- standings / leaderboards ---------------------------------------------

export const useStandings = () =>
  useQuery({ queryKey: qk.standings(), queryFn: () => standingsApi.standings(), staleTime: STALE_SEMI });

export const useTopPlayers = (limit = 20) =>
  useQuery({
    queryKey: qk.topPlayers(limit),
    queryFn: () => standingsApi.topPlayers(limit),
    staleTime: STALE_SEMI,
  });

// ---- announcements ---------------------------------------------------------

export const useAnnouncements = (params?: AnnouncementListParams) =>
  useQuery({
    queryKey: qk.announcements(params),
    queryFn: () => announcementsApi.list(params),
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,
  });

/** Cursor-paginated announcements (load-more), mirroring useMatchesInfinite. */
export const useAnnouncementsInfinite = (params?: AnnouncementListParams) =>
  useInfiniteQuery({
    queryKey: [...qk.announcements(params), "infinite"],
    queryFn: ({ pageParam }) =>
      announcementsApi.list({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,
  });

/** Admin: edit an announcement's content (title/body/category). */
export const useUpdateAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAnnouncementRequest }) =>
      announcementsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
};

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

export const useCloseAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.close(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
};

// ---- registrations ---------------------------------------------------------

export const useRegistrations = (params?: RegistrationListParams, enabled = true) =>
  useQuery({
    queryKey: qk.registrations(params),
    queryFn: () => registrationsApi.list(params),
    enabled,
    staleTime: STALE_LIST,
    placeholderData: keepPreviousData,
  });

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

/** Reject / discard a registration (also used to discard a FRANCHISE proposal). */
export const useRejectRegistration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      registrationsApi.reject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
};

/** Player: withdraw your own registration (solo/squad/auction). Frees you to join another team. */
export const useCancelRegistration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => registrationsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

/** Player: remove a settled registration from their own My-Team history. */
export const useHideRegistration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => registrationsApi.hide(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
};

/** Player: leave a FORMING squad you accepted. */
export const useLeaveSquad = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => registrationsApi.leaveSquad(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

// ---- disputes (any logged-in user) ----------------------------------------

/** File a dispute: result challenge (pass matchId), status appeal, or general issue. */
export const useCreateDispute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDisputeRequest) => disputesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes", "mine"] });
    },
  });
};

/** The signed-in user's own disputes, newest-first. */
export const useMyDisputes = (enabled = true) =>
  useQuery({
    queryKey: ["disputes", "mine"],
    queryFn: () => disputesApi.mine(),
    enabled,
  });

// ---- admin -----------------------------------------------------------------

export const useAdminOverview = (enabled = true) =>
  useQuery({
    queryKey: qk.adminOverview(),
    queryFn: () => adminApi.overview(),
    enabled,
    staleTime: STALE_LIST,
  });

export const useAdminTeam = (enabled = true) =>
  useQuery({
    queryKey: ["admin", "team"],
    queryFn: () => adminApi.team(),
    enabled,
    staleTime: STALE_LIST,
  });

export const useAppointAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) => adminApi.appointAdmin(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
};

export const useRevokeAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) => adminApi.revokeAdmin(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
};

export const useSettings = () =>
  useQuery({ queryKey: qk.settings(), queryFn: () => adminApi.settings(), staleTime: STALE_LIST });

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
  useQuery({ queryKey: ["seasons"], queryFn: () => seasonsApi.list(), staleTime: STALE_STATIC });

export const useCurrentSeason = () =>
  useQuery({ queryKey: ["seasons", "current"], queryFn: () => seasonsApi.current(), staleTime: STALE_STATIC });

export const useSeasonStandings = (code: string | undefined) =>
  useQuery({
    queryKey: ["seasons", code ?? "", "standings"],
    queryFn: () => seasonsApi.standings(code!),
    enabled: !!code,
    staleTime: STALE_SEMI,
    placeholderData: keepPreviousData,
  });

/** Cumulative points per franchise across all seasons + live play, ranked. */
export const useAllTimeStandings = () =>
  useQuery({
    queryKey: ["seasons", "all-time"],
    queryFn: () => seasonsApi.allTimeStandings(),
    staleTime: STALE_STATIC,
  });

// A season transition clears all rosters and repoints the current season, so
// franchises, players, standings/leaderboard and matches all change — invalidate them.
const invalidateSeasonWorld = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["seasons"] });
  qc.invalidateQueries({ queryKey: ["seasons", "current"] });
  qc.invalidateQueries({ queryKey: ["franchises"] });
  qc.invalidateQueries({ queryKey: ["standings"] });
  qc.invalidateQueries({ queryKey: ["leaderboard"] });
  qc.invalidateQueries({ queryKey: ["players"] });
  qc.invalidateQueries({ queryKey: ["matches"] });
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
    // Poll at a modest cadence and snap fresh the moment the user refocuses the tab. v5 pauses the
    // interval automatically while the tab is hidden, so backgrounded tabs stop hitting the backend.
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      // Clear the bell badge immediately rather than waiting for the next poll.
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    },
  });
};

// ---- auction ---------------------------------------------------------------

const applyAuction = (qc: ReturnType<typeof useQueryClient>, view: AuctionView) => {
  qc.setQueryData(["auctions", view.id], view);
  qc.invalidateQueries({ queryKey: ["auctions", "active"] });
  // SOLD lots attach players to franchises + change balances.
  qc.invalidateQueries({ queryKey: ["franchises"] });
  qc.invalidateQueries({ queryKey: ["players"] });
};

/** The current DRAFT/LOBBY/LIVE/PAUSED auction (or null). Light poll so nav/CTA notice a live auction. */
export const useActiveAuction = (enabled = true) =>
  useQuery({
    queryKey: ["auctions", "active"],
    queryFn: () => auctionsApi.active(),
    enabled,
    // Adaptive cadence: no auction (the common case) → slow 60s poll; a live auction → 5s; other
    // non-terminal states → 15s. Cuts site-wide idle polling ~12x while still noticing a going-live auction.
    refetchInterval: (q) => {
      if (!enabled) return false;
      const s = q.state.data?.status;
      if (!s || s === "COMPLETED") return 60_000;
      return s === "LIVE" ? 5_000 : 15_000;
    },
    refetchOnWindowFocus: true,
  });

/**
 * The standing auction pool — players registered and waiting, shown even when no auction exists yet.
 * Enabled only when there is NO active auction (the board is the source of truth once one exists), so
 * it costs nothing during a live auction. Slow 30s poll so a new registrant appears without a reload.
 */
export const useAuctionPool = (enabled = true) =>
  useQuery({
    queryKey: ["auctions", "pool"],
    queryFn: () => auctionsApi.pool(),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

/**
 * The live auction board. Polls fast (1.5s) while LIVE, keeps a slower poll (4s) for every other
 * non-terminal state (DRAFT/LOBBY/PAUSED) so the board notices an Open-hall/Start/Resume/join, and
 * stops only at COMPLETED. Must NOT stop on LOBBY or PAUSED — otherwise a watcher's board freezes
 * and never sees the auction advance.
 */
export const useAuction = (id: string | undefined) =>
  useQuery({
    queryKey: ["auctions", id ?? ""],
    queryFn: () => auctionsApi.get(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "COMPLETED") return false;
      return s === "LIVE" ? 1_500 : 4_000;
    },
    // Don't poll the (heavy) board in a hidden tab; snap fresh instantly when the user refocuses.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });

export const useCreateAuction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAuctionRequest) => auctionsApi.create(body),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

/** Admin edits an auction's config while it is DRAFT or LOBBY (409 once LIVE). */
export const useUpdateAuction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAuctionRequest }) =>
      auctionsApi.update(id, body),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

/** Shared factory for the id-only auction admin actions (start/pause/resume/finalize/unsold/complete). */
function useAuctionAction(fn: (id: string) => Promise<AuctionView>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => fn(id), onSuccess: (v) => applyAuction(qc, v) });
}

/** Lock pool also auto-closes the open AUCTION registration call server-side — refresh both feeds. */
export const useLockPool = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => auctionsApi.lockPool(id),
    onSuccess: (v) => {
      applyAuction(qc, v);
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
};
export const useOpenHall = () => useAuctionAction(auctionsApi.openHall);
export const useJoinAuction = () => useAuctionAction(auctionsApi.join);
export const useStartAuction = () => useAuctionAction(auctionsApi.start);
export const usePauseAuction = () => useAuctionAction(auctionsApi.pause);
export const useResumeAuction = () => useAuctionAction(auctionsApi.resume);
export const useFinalizeLot = () => useAuctionAction(auctionsApi.finalize);
export const useUnsoldLot = () => useAuctionAction(auctionsApi.unsold);
export const useCompleteAuction = () => useAuctionAction(auctionsApi.complete);
export const useCancelAuction = () => useAuctionAction(auctionsApi.cancel);

/** Admin reschedules the auction's open time (DRAFT/LOBBY). */
export const useRescheduleAuction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      auctionsApi.reschedule(id, scheduledAt),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

export const useNominateLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lotId }: { id: string; lotId: string }) => auctionsApi.nominate(id, lotId),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

export const useReauctionLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lotId }: { id: string; lotId: string }) => auctionsApi.reauction(id, lotId),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

export const useAssignLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AssignRequest }) => auctionsApi.assign(id, body),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

export const useAddAuctionFunds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddFundsRequest }) => auctionsApi.funds(id, body),
    onSuccess: (v) => applyAuction(qc, v),
  });
};

/** Franchise owner/manager places a raise bid on the on-block lot. */
export const usePlaceBid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PlaceBidRequest }) => auctionsApi.bid(id, body),
    onSuccess: (v) => applyAuction(qc, v),
  });
};
