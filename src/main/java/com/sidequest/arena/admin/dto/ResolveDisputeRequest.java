package com.sidequest.arena.admin.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for {@code POST /admin/disputes/{id}/resolve}.
 *
 * @param resolution the resolution note (required)
 * @param dismiss    when {@code TRUE} the dispute is dismissed rather than resolved
 */
public record ResolveDisputeRequest(
        @NotBlank String resolution,
        Boolean dismiss
) {
}
