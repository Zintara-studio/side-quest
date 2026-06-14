package com.sidequest.arena.admin.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for {@code POST /uploads/sign}.
 *
 * @param filename    the original file name (required)
 * @param contentType the MIME type of the upload (required)
 * @param kind        the logical bucket ("avatar" | "poster"); defaults to "misc" when omitted
 */
public record SignRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        String kind
) {
}
