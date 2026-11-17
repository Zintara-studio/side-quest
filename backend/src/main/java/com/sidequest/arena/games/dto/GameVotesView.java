package com.sidequest.arena.games.dto;

import java.util.List;

/**
 * The current caller's game upvotes, so the vote UI can pre-select the games they already like.
 *
 * @param votedGameIds ids of the games the caller has upvoted
 */
public record GameVotesView(List<String> votedGameIds) {
}
