package com.sidequest.arena.players;

import com.sidequest.arena.audit.AuditService;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.Cursors;
import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.media.MediaRefs;
import com.sidequest.arena.notifications.NotificationService;
import com.sidequest.arena.players.dto.PlayerDetail;
import com.sidequest.arena.players.dto.PlayerMatchView;
import com.sidequest.arena.players.dto.PlayerSummary;
import com.sidequest.arena.players.dto.UpdatePlayerRequest;
import com.sidequest.arena.players.dto.UpdateStatusRequest;
import com.sidequest.arena.players.dto.UsernameAvailability;
import com.sidequest.arena.players.dto.UsernameView;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RefreshTokenRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.config.CacheConfig;
import com.sidequest.arena.security.SecurityUtils;
import com.sidequest.arena.security.UserPrincipal;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Player directory, profile and standings logic: listing/filtering, profile detail, a player's
 * franchise match history, game handles (with owner/admin visibility rules), and owner/admin edits.
 */
@Service
public class PlayerService {

    private final PlayerRepository playerRepository;
    @SuppressWarnings("unused")
    private final FranchiseRepository franchiseRepository;
    private final MatchParticipantRepository matchParticipantRepository;
    private final ResultRowRepository resultRowRepository;
    private final PlayerGameUsernameRepository playerGameUsernameRepository;
    private final PlayerGameProficiencyRepository playerGameProficiencyRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PlayerProfileWriter profileWriter;

    public PlayerService(PlayerRepository playerRepository,
                         FranchiseRepository franchiseRepository,
                         MatchParticipantRepository matchParticipantRepository,
                         ResultRowRepository resultRowRepository,
                         PlayerGameUsernameRepository playerGameUsernameRepository,
                         PlayerGameProficiencyRepository playerGameProficiencyRepository,
                         AuditService auditService,
                         NotificationService notificationService,
                         RefreshTokenRepository refreshTokenRepository,
                         PlayerProfileWriter profileWriter) {
        this.playerRepository = playerRepository;
        this.franchiseRepository = franchiseRepository;
        this.matchParticipantRepository = matchParticipantRepository;
        this.resultRowRepository = resultRowRepository;
        this.playerGameUsernameRepository = playerGameUsernameRepository;
        this.playerGameProficiencyRepository = playerGameProficiencyRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.profileWriter = profileWriter;
    }

    /**
     * List players ordered by points desc, optionally filtered by franchise, game proficiency and
     * status, then paginated.
     */
    @Cacheable(CacheConfig.PLAYERS)
    @Transactional(readOnly = true)
    public PageResponse<PlayerSummary> list(UUID franchiseId, UUID gameId, PlayerStatus status,
                                            Integer limit, String cursor) {
        List<Player> players = playerRepository.findAllByOrderByPointsDesc();

        if (franchiseId != null) {
            players = players.stream()
                    .filter(p -> p.getFranchise() != null
                            && franchiseId.equals(p.getFranchise().getId()))
                    .toList();
        }

        if (gameId != null) {
            Set<UUID> playerIds = playerGameProficiencyRepository.findByGameId(gameId).stream()
                    .map(prof -> prof.getPlayer().getId())
                    .collect(Collectors.toSet());
            players = players.stream()
                    .filter(p -> playerIds.contains(p.getId()))
                    .toList();
        }

        if (status != null) {
            players = players.stream()
                    .filter(p -> p.getStatus() == status)
                    .toList();
        }

        List<PlayerSummary> summaries = players.stream()
                .map(PlayerService::toSummary)
                .toList();

        return Cursors.paginate(summaries, cursor, limit);
    }

    /**
     * Full profile for a single player, resolved by either the UUID or the (unique) gamerTag slug — so
     * {@code /player/SammyUrfen} works alongside the legacy {@code /player/{uuid}}.
     */
    @Transactional(readOnly = true)
    public PlayerDetail get(String idOrTag) {
        return toDetail(resolve(idOrTag));
    }

    /** Resolve a player by UUID (tried first) or by unique gamerTag. 404 if neither matches. */
    private Player resolve(String idOrTag) {
        try {
            return playerRepository.findById(UUID.fromString(idOrTag))
                    .orElseThrow(() -> ApiException.notFound("Player", idOrTag));
        } catch (IllegalArgumentException notAUuid) {
            return playerRepository.findByGamerTagIgnoreCase(idOrTag)
                    .orElseThrow(() -> ApiException.notFound("Player", idOrTag));
        }
    }

    /**
     * Past/scheduled matches for the player's franchise, newest first, including the franchise's
     * placement when results exist. Empty if the player has no franchise.
     */
    @Transactional(readOnly = true)
    public List<PlayerMatchView> matches(String idOrTag) {
        Player player = resolve(idOrTag);

        Franchise franchise = player.getFranchise();
        if (franchise == null) {
            return List.of();
        }
        UUID franchiseId = franchise.getId();

        // One query for ALL of the franchise's result rows (keyed by match), instead of one
        // result-row query per historical match.
        Map<UUID, ResultRow> rowByMatch = resultRowRepository
                .findByFranchiseIdOrderByCreatedAtDesc(franchiseId).stream()
                .filter(r -> r.getMatch() != null)
                .collect(Collectors.toMap(r -> r.getMatch().getId(), r -> r, (a, b) -> a));

        return matchParticipantRepository.findByFranchiseId(franchiseId).stream()
                .map(MatchParticipant::getMatch)
                .map(match -> toMatchView(match, rowByMatch.get(match.getId())))
                .sorted(Comparator.comparing(PlayerMatchView::scheduledAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * The player's game handles. The owner (or an admin) sees all handles; everyone else sees only
     * the public ones.
     */
    @Transactional(readOnly = true)
    public List<UsernameView> usernames(String idOrTag) {
        Player player = resolve(idOrTag);

        boolean privileged = isOwner(player) || SecurityUtils.isAdmin();

        List<PlayerGameUsername> usernames = privileged
                ? playerGameUsernameRepository.findByPlayerId(player.getId())
                : playerGameUsernameRepository.findByPlayerIdAndIsPublicTrue(player.getId());

        return usernames.stream()
                .map(u -> new UsernameView(
                        u.getGame().getId().toString(),
                        u.getGame().getName(),
                        u.getHandle(),
                        u.isPublic()))
                .toList();
    }

    /** Owner/admin partial update of a player's profile fields. Returns the updated profile. */
    @CacheEvict(value = CacheConfig.PLAYERS, allEntries = true)
    @Transactional
    public PlayerDetail update(UUID id, UpdatePlayerRequest request) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        // A profile is editable ONLY by its owner — not by admins. Admins (and franchise leaders) may
        // VIEW every field (see canViewPrivate), but editing someone else's personal details, avatar,
        // or privacy toggles would be a serious authority overreach, so it is forbidden outright.
        // Admin-only account actions live on dedicated endpoints (e.g. updateStatus).
        if (!isOwner(player)) {
            throw ApiException.forbidden("You may only edit your own profile");
        }

        // The gamer tag (username) is claimed at signup and is immutable — the request field is ignored
        // here so it can never be changed via profile edit (nor via any other path). Onboarding is the
        // one exception (see onboard()), where an SSO account claims its username for the first time.
        if (request.avatarUrl() != null) {
            // Only accept a server-issued /media/{id} reference (or blank to clear) — never an arbitrary
            // external/data URL, which would be rendered as an <img> to every viewer of the profile.
            String avatar = MediaRefs.normalize(request.avatarUrl(), "avatarUrl");
            player.setAvatarUrl(avatar.isEmpty() ? null : avatar);
        }
        applyEditableProfile(player, request);

        Player saved = playerRepository.save(player);
        applyProficiencies(saved, request);
        return toDetail(saved);
    }

    /**
     * Completes onboarding for a first-time SSO account: claims the immutable username and applies the
     * (optional, skippable) profile fields in one step. This is the ONLY path that may set a gamerTag
     * after account creation, and only while {@code onboardingRequired} is still true — so it can never
     * be used to rename an established account.
     */
    @CacheEvict(value = CacheConfig.PLAYERS, allEntries = true)
    @Transactional
    public PlayerDetail onboard(UpdatePlayerRequest request) {
        UUID userId = SecurityUtils.currentUserId();
        Player player = playerRepository.findByUserId(userId)
                .orElseThrow(() -> ApiException.notFound("Player", userId));

        if (!player.isOnboardingRequired()) {
            throw ApiException.conflict("Your account is already set up.");
        }

        // Claim the username — validate the shape and enforce case-insensitive uniqueness. (The current
        // value is a throwaway placeholder, so it never collides with the chosen name.)
        String username = UsernameRules.require(request.gamerTag());
        if (!username.equalsIgnoreCase(player.getGamerTag())
                && playerRepository.existsByGamerTagIgnoreCase(username)) {
            throw ApiException.conflict("That username is already taken — pick another.");
        }
        player.setGamerTag(username);
        // Keep the account display-name in step with the chosen username (as the email-signup path does).
        // The User is a managed entity in this transaction, so the change is flushed on commit.
        player.getUser().setName(username);

        // Avatar: keep the pre-filled Google picture (an external URL) when unchanged; otherwise only a
        // server-issued /media/{id} reference is accepted — never an arbitrary external URL slipped in here.
        if (request.avatarUrl() != null && !request.avatarUrl().equals(player.getAvatarUrl())) {
            String avatar = MediaRefs.normalize(request.avatarUrl(), "avatarUrl");
            player.setAvatarUrl(avatar.isEmpty() ? null : avatar);
        }
        applyEditableProfile(player, request);
        player.setOnboardingRequired(false);

        Player saved = playerRepository.save(player);
        applyProficiencies(saved, request);
        return toDetail(saved);
    }

    /**
     * Whether a candidate username is free to claim: valid in shape AND not already taken
     * (case-insensitively). Powers the live availability check on the signup / onboarding forms.
     */
    @Transactional(readOnly = true)
    public UsernameAvailability usernameAvailability(String username) {
        String reason = UsernameRules.validate(username);
        if (reason != null) {
            return new UsernameAvailability(false, reason);
        }
        String trimmed = username.trim();
        if (playerRepository.existsByGamerTagIgnoreCase(trimmed)) {
            return new UsernameAvailability(false, "That username is already taken.");
        }
        return new UsernameAvailability(true, null);
    }

    /** Applies the editable profile fields (everything except the immutable username + avatar). */
    private static void applyEditableProfile(Player player, UpdatePlayerRequest request) {
        if (request.region() != null) {
            player.setRegion(request.region());
        }
        if (request.bio() != null) {
            player.setBio(request.bio());
        }
        if (request.realName() != null) {
            player.setRealName(request.realName().isBlank() ? null : request.realName().trim());
        }
        if (request.phone() != null) {
            player.setPhone(request.phone().isBlank() ? null : request.phone().trim());
        }
        if (request.contactEmail() != null) {
            player.setContactEmail(request.contactEmail().isBlank() ? null : request.contactEmail().trim());
        }
        if (request.realNamePublic() != null) {
            player.setRealNamePublic(request.realNamePublic());
        }
        if (request.phonePublic() != null) {
            player.setPhonePublic(request.phonePublic());
        }
        if (request.contactEmailPublic() != null) {
            player.setContactEmailPublic(request.contactEmailPublic());
        }
    }

    /** Per-game skill + handle go through the single canonical writer shared with auction registration. */
    private void applyProficiencies(Player saved, UpdatePlayerRequest request) {
        if (request.proficiencies() != null) {
            profileWriter.upsert(saved, request.proficiencies().stream()
                    .filter(e -> e != null && e.gameId() != null)
                    .map(PlayerService::toUpsert)
                    .toList());
        }
    }

    /** Map a profile-form game line to the shared writer's input, parsing the string game id. */
    private static PlayerProfileWriter.Upsert toUpsert(UpdatePlayerRequest.GameEntry e) {
        UUID gameId;
        try {
            gameId = UUID.fromString(e.gameId());
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("Invalid game id: " + e.gameId());
        }
        return new PlayerProfileWriter.Upsert(gameId, e.rating(), e.handle(), e.handlePublic(),
                e.rankTier(), e.kd(), e.accountLevel());
    }

    /**
     * Admin-only change of a player's account standing. Records an audit entry and notifies the
     * affected player in-app so they learn their account was verified / flagged / suspended.
     */
    @CacheEvict(value = CacheConfig.PLAYERS, allEntries = true)
    @Transactional
    public PlayerDetail updateStatus(UUID id, UpdateStatusRequest request) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Player", id));

        PlayerStatus previous = player.getStatus();
        player.setStatus(request.status());
        Player saved = playerRepository.save(player);

        auditService.record("player.status", "Player", id.toString(),
                "Set " + saved.getGamerTag() + " to " + request.status());

        // A suspension must take effect immediately: revoke all refresh tokens so the user cannot renew
        // their session (their current short-lived access token still expires on its own).
        if (request.status() == PlayerStatus.SUSPENDED && saved.getUser() != null) {
            refreshTokenRepository.revokeAllForUser(saved.getUser().getId());
        }

        // Notify the player whose standing changed (skip no-op updates).
        if (previous != request.status() && saved.getUser() != null) {
            notificationService.create(saved.getUser(), NotificationType.GENERAL,
                    "Account status updated",
                    "Your player account is now " + request.status() + ".",
                    "/player/" + saved.getId());
        }
        return toDetail(saved);
    }

    // ---- helpers ----

    private static boolean isOwner(Player player) {
        return SecurityUtils.currentPrincipal().isPresent()
                && player.getUser().getId().equals(SecurityUtils.currentUserId());
    }

    /**
     * Whether the current caller may see a player's private contact fields. True for an admin, the
     * profile owner, or an owner/manager of the player's franchise; false for spectators and unrelated
     * viewers. Self-contained from the target player (its franchise's leader user-ids), so it needs no
     * franchise-service dependency. Must run inside the read transaction (lazy associations).
     */
    private static boolean canViewPrivate(Player target) {
        Optional<UserPrincipal> principal = SecurityUtils.currentPrincipal();
        if (principal.isEmpty()) {
            return false;
        }
        if (SecurityUtils.isAdmin()) {
            return true;
        }
        UUID viewerId = principal.get().getUserId();
        if (target.getUser() != null && viewerId.equals(target.getUser().getId())) {
            return true;
        }
        Franchise franchise = target.getFranchise();
        if (franchise == null) {
            return false;
        }
        return leads(franchise.getOwnerPlayer(), viewerId)
                || leads(franchise.getManagerPlayer(), viewerId);
    }

    /** Whether the given leadership slot is held by the viewer (by user id). */
    private static boolean leads(Player slot, UUID viewerId) {
        return slot != null && slot.getUser() != null && viewerId.equals(slot.getUser().getId());
    }

    private static PlayerMatchView toMatchView(Match match, ResultRow row) {
        Integer rank = row != null ? row.getRank() : null;
        Integer total = row != null ? row.getTotal() : null;
        return new PlayerMatchView(
                match.getId().toString(),
                match.getSlug(),
                match.getGame().getName(),
                match.getScheduledAt(),
                match.getStatus().name(),
                rank,
                total);
    }

    private static PlayerSummary toSummary(Player player) {
        Franchise franchise = player.getFranchise();
        return new PlayerSummary(
                player.getId().toString(),
                player.getGamerTag(),
                player.getAvatarUrl(),
                player.getRegion(),
                player.getStatus().name(),
                player.getPoints(),
                franchise != null ? franchise.getId().toString() : null,
                franchise != null ? franchise.getName() : null);
    }

    private PlayerDetail toDetail(Player player) {
        Franchise franchise = player.getFranchise();
        PlayerDetail.FranchiseMini franchiseMini = franchise == null ? null
                : new PlayerDetail.FranchiseMini(
                        franchise.getId().toString(),
                        franchise.getName(),
                        franchise.getTag());

        List<PlayerDetail.ProficiencyView> proficiencies =
                playerGameProficiencyRepository.findByPlayerId(player.getId()).stream()
                        .map(PlayerService::toProficiencyView)
                        .toList();

        // Per-field privacy: a private contact field is nulled for viewers who may not see it.
        boolean privileged = canViewPrivate(player);
        String realName = privileged || player.isRealNamePublic() ? player.getRealName() : null;
        String phone = privileged || player.isPhonePublic() ? player.getPhone() : null;
        String contactEmail = privileged || player.isContactEmailPublic() ? player.getContactEmail() : null;
        // The account (login) email is never public — only a privileged viewer sees it. This is what
        // lets an admin or franchise leader see the email a player signed up with (blank otherwise).
        String accountEmail = privileged ? player.getUser().getEmail() : null;

        return new PlayerDetail(
                player.getId().toString(),
                player.getGamerTag(),
                player.getAvatarUrl(),
                player.getRegion(),
                player.getBio(),
                realName,
                phone,
                contactEmail,
                player.isRealNamePublic(),
                player.isPhonePublic(),
                player.isContactEmailPublic(),
                player.getStatus().name(),
                player.getPoints(),
                new PlayerDetail.UserMini(player.getUser().getName(), accountEmail),
                franchiseMini,
                proficiencies);
    }

    private static PlayerDetail.ProficiencyView toProficiencyView(PlayerGameProficiency prof) {
        return new PlayerDetail.ProficiencyView(
                prof.getGame().getId().toString(),
                prof.getGame().getName(),
                prof.getRating(),
                prof.getRankTier(),
                prof.getKd(),
                prof.getAccountLevel());
    }
}
