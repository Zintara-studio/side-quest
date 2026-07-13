package com.sidequest.arena.players;

import java.util.regex.Pattern;

import com.sidequest.arena.common.ApiException;

/**
 * Rules for the public username (a player's {@code gamerTag}). The username is claimed once and is
 * immutable, so it is validated the same way everywhere it can be set — email signup and the Google
 * onboarding step. Uniqueness is enforced case-insensitively elsewhere (so {@code sammy} and
 * {@code Sammy} collide); this type only validates the shape.
 */
public final class UsernameRules {

    /** Bounds chosen to fit UI columns and avatars without truncation, while allowing real handles. */
    public static final int MIN = 3;
    public static final int MAX = 20;

    // Letters, digits, and a small set of separators. Deliberately excludes spaces (the user's rule)
    // and anything that would need URL-encoding in the pretty /player/<tag> path.
    private static final Pattern PATTERN = Pattern.compile("^[A-Za-z0-9_.-]{" + MIN + "," + MAX + "}$");

    private UsernameRules() {
    }

    /**
     * Validates the shape of a candidate username.
     *
     * @return {@code null} when valid, otherwise a human-readable reason the client can show inline.
     */
    public static String validate(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Pick a username.";
        }
        String s = raw.trim();
        if (s.contains(" ")) {
            return "Username can't contain spaces.";
        }
        if (s.length() < MIN) {
            return "Username must be at least " + MIN + " characters.";
        }
        if (s.length() > MAX) {
            return "Username must be at most " + MAX + " characters.";
        }
        if (!PATTERN.matcher(s).matches()) {
            return "Use only letters, numbers, and . _ -";
        }
        return null;
    }

    /** Validates and returns the trimmed username, or throws a 400 with the reason. */
    public static String require(String raw) {
        String reason = validate(raw);
        if (reason != null) {
            throw ApiException.badRequest(reason);
        }
        return raw.trim();
    }
}
