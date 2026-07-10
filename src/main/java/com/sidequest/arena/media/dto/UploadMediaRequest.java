package com.sidequest.arena.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for {@code POST /media}. The image is sent inline as base64 — either a data URL
 * ({@code data:image/png;base64,....}) or bare base64 — so the JSON client needs no multipart support.
 * {@code data} is length-capped as defence-in-depth (the raw body is also bounded by a request filter).
 *
 * @param data base64 image payload (data URL prefix optional), required, ≤ ~360KB (covers a 256KB banner)
 * @param kind what the image is for: {@code avatar} / {@code logo} / {@code banner} (drives the size cap)
 */
public record UploadMediaRequest(
        @NotBlank @Size(max = 360_000) String data,
        String kind
) {
}
