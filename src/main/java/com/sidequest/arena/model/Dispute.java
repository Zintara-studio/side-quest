package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A challenge raised for admin attention, triaged in the admin control room. Classic result
 * disputes reference a {@link Match}; account-status appeals and general issues have no match, so
 * the match reference is optional and the {@link #category} distinguishes them.
 */
@Entity
@Table(name = "disputes")
@Getter
@Setter
@NoArgsConstructor
public class Dispute extends BaseEntity {

    /** The disputed match, for RESULT disputes. Null for APPEAL / GENERAL disputes. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id")
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "raised_by")
    private User raisedBy;

    @Column(columnDefinition = "text", nullable = false)
    private String reason;

    /** What the dispute is about; defaults to a match result dispute. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DisputeCategory category = DisputeCategory.RESULT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DisputeStatus status = DisputeStatus.OPEN;

    @Column(columnDefinition = "text")
    private String resolution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
