package com.sidequest.arena.media;

import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.media.dto.UploadMediaRequest;
import com.sidequest.arena.media.dto.UploadMediaResponse;
import com.sidequest.arena.model.MediaAsset;
import com.sidequest.arena.repo.MediaAssetRepository;
import com.sidequest.arena.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.UUID;

/**
 * Real image storage: validates a small base64 image (size cap + magic-byte type sniff) and persists
 * it as a {@link MediaAsset} DB blob, then serves the bytes back by id. Replaces the previous simulated
 * presigned-upload flow — no external object store is involved.
 */
@Service
public class MediaService {

    /** Per-kind decoded-size caps. Avatars are the tightest (the user asked for ~32KB). */
    private static final int MAX_AVATAR_BYTES = 32 * 1024;
    private static final int MAX_LOGO_BYTES = 64 * 1024;
    private static final int MAX_BANNER_BYTES = 256 * 1024;
    private static final int MAX_DEFAULT_BYTES = 64 * 1024;

    private final MediaAssetRepository mediaAssetRepository;

    public MediaService(MediaAssetRepository mediaAssetRepository) {
        this.mediaAssetRepository = mediaAssetRepository;
    }

    /**
     * Validate + store a base64 image, returning its id and serving url. Requires an authenticated
     * caller (attribution). Rejects payloads that are too large or are not a recognised image type.
     */
    @Transactional
    public UploadMediaResponse upload(UploadMediaRequest request) {
        UUID uploader = SecurityUtils.currentUserId();
        String kind = normalizeKind(request.kind());
        int maxBytes = maxBytesFor(kind);

        // Bound the raw payload length BEFORE any trim/strip copy, so an interior-whitespace padded
        // string can't slip past the decoded-size guard below (defence-in-depth with the request filter).
        String data = request.data() == null ? "" : request.data();
        if (data.length() > (long) maxBytes / 3 * 4 + 1024) {
            throw tooLarge(maxBytes);
        }
        String raw = data.trim();
        if (raw.isEmpty()) {
            throw ApiException.badRequest("No image data was provided.");
        }
        // Accept a data URL ("data:image/png;base64,AAAA…") or bare base64.
        String base64 = raw;
        if (raw.regionMatches(true, 0, "data:", 0, 5)) {
            int comma = raw.indexOf(',');
            if (comma < 0) {
                throw ApiException.badRequest("Malformed image data URL.");
            }
            base64 = raw.substring(comma + 1);
        }
        base64 = base64.replaceAll("\\s", "");

        // Cheap upper bound before allocating the decoded array (base64 is ~4/3 of the byte length).
        long approxBytes = base64.length() / 4L * 3L;
        if (approxBytes > maxBytes) {
            throw tooLarge(maxBytes);
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("The image data is not valid base64.");
        }
        if (bytes.length == 0) {
            throw ApiException.badRequest("No image data was provided.");
        }
        if (bytes.length > maxBytes) {
            throw tooLarge(maxBytes);
        }

        String contentType = sniff(bytes);
        if (contentType == null) {
            throw ApiException.badRequest("Unsupported image type — use PNG, JPEG, WEBP or GIF.");
        }

        MediaAsset asset = new MediaAsset();
        asset.setData(bytes);
        asset.setContentType(contentType);
        asset.setSizeBytes(bytes.length);
        asset.setKind(kind);
        asset.setUploadedBy(uploader);
        MediaAsset saved = mediaAssetRepository.save(asset);

        return new UploadMediaResponse(saved.getId().toString(), "/media/" + saved.getId());
    }

    /** Load an asset for serving; 404 for an unknown or unparseable id. */
    @Transactional(readOnly = true)
    public MediaAsset load(String id) {
        UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Media", id);
        }
        return mediaAssetRepository.findById(uuid)
                .orElseThrow(() -> ApiException.notFound("Media", id));
    }

    // ---- helpers ----

    private static String normalizeKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return "misc";
        }
        return switch (kind.trim().toLowerCase()) {
            case "avatar", "logo", "banner" -> kind.trim().toLowerCase();
            default -> "misc";
        };
    }

    private static int maxBytesFor(String kind) {
        return switch (kind) {
            case "avatar" -> MAX_AVATAR_BYTES;
            case "logo" -> MAX_LOGO_BYTES;
            case "banner" -> MAX_BANNER_BYTES;
            default -> MAX_DEFAULT_BYTES;
        };
    }

    private static ApiException tooLarge(int maxBytes) {
        return ApiException.badRequest("Image is too large — the maximum is " + (maxBytes / 1024) + "KB.");
    }

    /** Detect the image type from its magic bytes; null if it is not a supported image. */
    private static String sniff(byte[] b) {
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') {
            return "image/gif";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
