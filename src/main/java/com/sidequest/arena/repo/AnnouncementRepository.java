package com.sidequest.arena.repo;

import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.RegistrationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AnnouncementRepository extends JpaRepository<Announcement, UUID> {

    List<Announcement> findAllByOrderByPublishedAtDesc();

    List<Announcement> findByCategoryOrderByPublishedAtDesc(AnnouncementCategory category);

    /** Unlink any announcements tied to a match (before the match is deleted; the FK is nullable). */
    @Modifying
    @Query("update Announcement a set a.match = null where a.match.id = :matchId")
    void detachMatch(@Param("matchId") UUID matchId);

    /** Open registration calls linked to a given match — used to close them when the match finishes. */
    List<Announcement> findByMatchIdAndRegistrationOpenTrue(UUID matchId);

    /** Open registration calls of a given mode — used to close franchise calls when a season starts. */
    List<Announcement> findByRegistrationOpenTrueAndRegistrationType(RegistrationType registrationType);
}
