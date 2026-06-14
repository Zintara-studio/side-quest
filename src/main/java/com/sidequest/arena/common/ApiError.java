package com.sidequest.arena.common;

import java.time.Instant;
import java.util.Map;

/**
 * Standard error envelope: {@code { code, message, details }} (plus a timestamp & path for ops).
 */
public record ApiError(
        String code,
        String message,
        Map<String, Object> details,
        String path,
        Instant timestamp
) {
    public static ApiError of(ErrorCode code, String message, Map<String, Object> details, String path) {
        return new ApiError(code.name(), message, details, path, Instant.now());
    }
}
