package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.AvatarRequest;
import com.sidequest.arena.admin.dto.AvatarResponse;
import com.sidequest.arena.admin.dto.SignRequest;
import com.sidequest.arena.admin.dto.SignResponse;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Media handling: simulated presigned uploads and attaching an uploaded avatar to a player.
 */
@Service
public class MediaService {

    /** How long a simulated presigned URL is valid for. */
    private static final long EXPIRES_IN_SECONDS = 900L;

    private final PlayerRepository playerRepository;
    private final String baseUrl;

    public MediaService(PlayerRepository playerRepository,
                        @Value("${sidequest.uploads.base-url}") String baseUrl) {
        this.playerRepository = playerRepository;
        this.baseUrl = baseUrl;
    }

    /**
     * Build a simulated presigned upload (no external storage call). The object key namespaces by
     * {@code kind} and carries a random UUID to avoid collisions.
     */
    @Transactional(readOnly = true)
    public SignResponse sign(SignRequest request) {
        // Require an authenticated principal.
        SecurityUtils.requirePrincipal();

        String kind = (request.kind() == null || request.kind().isBlank())
                ? "misc"
                : request.kind();

        String key = kind + "/" + UUID.randomUUID() + "-" + request.filename();
        String token = Long.toHexString(UUID.randomUUID().getMostSignificantBits());
        String uploadUrl = baseUrl + "/put/" + key + "?signature=" + token;
        String fileUrl = baseUrl + "/" + key;

        return new SignResponse(uploadUrl, fileUrl, key, EXPIRES_IN_SECONDS);
    }

    /**
     * Attach an avatar URL to a player. Targets the given player (404 if missing) or the current
     * user's player when no id is provided. Only the owning user or an admin may change it.
     */
    @Transactional
    public AvatarResponse setAvatar(AvatarRequest request) {
        UUID currentUserId = SecurityUtils.currentUserId();

        Player player;
        if (request.playerId() != null && !request.playerId().isBlank()) {
            UUID playerId = parseId(request.playerId());
            player = playerRepository.findById(playerId)
                    .orElseThrow(() -> ApiException.notFound("Player", request.playerId()));
        } else {
            player = playerRepository.findByUserId(currentUserId)
                    .orElseThrow(() -> ApiException.badRequest(
                            "No player profile for the current user"));
        }

        boolean owner = player.getUser().getId().equals(currentUserId);
        if (!owner && !SecurityUtils.isAdmin()) {
            throw ApiException.forbidden("You may only change your own avatar");
        }

        player.setAvatarUrl(request.avatarUrl());
        Player saved = playerRepository.save(player);

        return new AvatarResponse(saved.getId().toString(), saved.getAvatarUrl());
    }

    /** Parse a String id to UUID; treat unparseable ids as not found. */
    private static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Player", id);
        }
    }
}
