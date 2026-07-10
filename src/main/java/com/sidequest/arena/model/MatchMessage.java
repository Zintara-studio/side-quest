package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A message posted by an admin into a match's "room" while the fixture is live — the durable,
 * polled communication channel for the match's participants. Persisted (unlike the ephemeral realtime
 * WebSocket layer) so participants who join late still see the history. {@code createdAt} (from
 * {@link BaseEntity}) gives the ordering.
 */
@Entity
@Table(name = "match_messages", indexes = @Index(name = "idx_match_messages_match", columnList = "match_id"))
@Getter
@Setter
@NoArgsConstructor
public class MatchMessage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    /** The admin who posted the message. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(columnDefinition = "text", nullable = false)
    private String body;
}
