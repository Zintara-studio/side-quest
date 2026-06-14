package com.sidequest.arena.common;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

/**
 * Helper for opaque offset-based cursor pagination. The cursor encodes the next offset.
 * Simple and stable for the league dataset; can be swapped for keyset pagination later.
 */
public final class Cursors {

    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    private Cursors() {
    }

    public static int clampLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    public static int decodeOffset(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (decoded.startsWith("o:")) {
                return Math.max(0, Integer.parseInt(decoded.substring(2)));
            }
            return 0;
        } catch (RuntimeException ex) {
            throw ApiException.badRequest("Invalid cursor");
        }
    }

    private static String encodeOffset(int offset) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("o:" + offset).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Build a page from an in-memory list, applying the cursor offset and limit, and computing
     * the next cursor when more items remain.
     */
    public static <T> PageResponse<T> paginate(List<T> all, String cursor, Integer limit) {
        int lim = clampLimit(limit);
        int offset = decodeOffset(cursor);
        int from = Math.min(offset, all.size());
        int to = Math.min(from + lim, all.size());
        List<T> slice = all.subList(from, to);
        String next = to < all.size() ? encodeOffset(to) : null;
        return PageResponse.of(List.copyOf(slice), next, lim);
    }
}
