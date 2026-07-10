package com.sidequest.arena.repo;

import com.sidequest.arena.model.OtpCode;
import com.sidequest.arena.model.OtpPurpose;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface OtpCodeRepository extends JpaRepository<OtpCode, UUID> {

    /** Row-locks the latest live code so the check-and-increment of {@code attempts} serializes across requests. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<OtpCode> findTopByEmailIgnoreCaseAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
            String email, OtpPurpose purpose);

    /** How many codes were issued for (email, purpose) since a cutoff — backs the resend throttle. */
    long countByEmailIgnoreCaseAndPurposeAndCreatedAtAfter(String email, OtpPurpose purpose, Instant since);

    /** Invalidate any still-outstanding codes when a new one is issued or one is consumed. */
    @Modifying
    @Query("update OtpCode o set o.consumed = true "
            + "where o.email = :email and o.purpose = :purpose and o.consumed = false")
    int consumeOutstanding(@Param("email") String email, @Param("purpose") OtpPurpose purpose);

    @Modifying
    @Query("delete from OtpCode o where o.expiresAt < :cutoff")
    int deleteByExpiresAtBefore(@Param("cutoff") Instant cutoff);
}
