package com.sidequest.arena.media.dto;

/**
 * Response for {@code POST /media}: the stored asset's id and the relative URL to serve it from.
 * Callers persist {@code url} into the relevant string column (player avatar / franchise logo|banner).
 *
 * @param id  the {@link com.sidequest.arena.model.MediaAsset} id
 * @param url relative serving url, e.g. {@code /media/{id}}
 */
public record UploadMediaResponse(
        String id,
        String url
) {
}
