package com.sidequest.arena.matches.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Admin request to enter (or re-publish) the result table for a match. Replaces any existing rows.
 *
 * @param rows one line per participating franchise (at least one required)
 */
public record EnterResultsRequest(
        @NotEmpty @Valid List<ResultEntry> rows
) {
}
