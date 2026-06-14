package com.sidequest.arena.common;

import java.util.List;

/**
 * Cursor-pagination envelope for list endpoints (per architecture doc: {@code ?limit&cursor}).
 *
 * @param items      the page of items
 * @param nextCursor opaque cursor for the next page, or {@code null} if this is the last page
 * @param limit      the page size that was applied
 */
public record PageResponse<T>(List<T> items, String nextCursor, int limit) {

    public static <T> PageResponse<T> of(List<T> items, String nextCursor, int limit) {
        return new PageResponse<>(items, nextCursor, limit);
    }
}
