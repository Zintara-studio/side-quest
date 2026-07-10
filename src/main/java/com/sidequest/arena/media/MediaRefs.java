package com.sidequest.arena.media;

import com.sidequest.arena.common.ApiException;

import java.util.regex.Pattern;

/**
 * Validates image-reference fields (player avatar, franchise logo/banner). These must point at an
 * image uploaded through {@code POST /media} (a relative {@code /media/{uuid}} url), never an arbitrary
 * external URL or a {@code data:} URI — otherwise a user could turn their public profile/franchise into
 * a tracking beacon (every viewer's browser would fetch the attacker's host) or embed multi-MB payloads.
 */
public final class MediaRefs {

    private static final Pattern MEDIA_REF = Pattern.compile(
            "/media/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private MediaRefs() {
    }

    /**
     * Normalize an incoming image reference.
     *
     * @return {@code null} when {@code value} is null (caller should leave the field unchanged); an empty
     *         string when blank (caller should clear the field); otherwise the trimmed {@code /media/{id}}
     *         reference. Throws {@link ApiException#badRequest} for any other value.
     */
    public static String normalize(String value, String field) {
        if (value == null) {
            return null;
        }
        String v = value.trim();
        if (v.isEmpty()) {
            return "";
        }
        if (!MEDIA_REF.matcher(v).matches()) {
            throw ApiException.badRequest(field + " must reference an uploaded image (/media/{id}).");
        }
        return v;
    }
}
