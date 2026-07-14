package com.sidequest.arena.games.dto;

import java.util.List;

/**
 * The caller's full upvote selection. PUT semantics: this replaces their entire vote set — games not
 * listed are un-voted, games listed are voted (idempotent; duplicates and unknown ids are ignored).
 *
 * @param gameIds ids of every game the caller currently upvotes
 */
public record SaveVotesRequest(List<String> gameIds) {
}
