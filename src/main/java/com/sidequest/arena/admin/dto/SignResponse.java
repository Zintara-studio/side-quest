package com.sidequest.arena.admin.dto;

/**
 * Response for {@code POST /uploads/sign} — a simulated presigned upload.
 *
 * @param uploadUrl         the URL the client PUTs the bytes to
 * @param fileUrl           the public URL the object will be served from
 * @param key               the storage key the object is stored under
 * @param expiresInSeconds  how long the presigned URL is valid for
 */
public record SignResponse(
        String uploadUrl,
        String fileUrl,
        String key,
        long expiresInSeconds
) {
}
