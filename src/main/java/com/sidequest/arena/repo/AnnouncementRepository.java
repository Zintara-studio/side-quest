package com.sidequest.arena.repo;

import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.RegistrationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AnnouncementRepository extends JpaRepository<Announcement, UUID> {

    List<Announcement> findAllByOrderByPublishedAtDesc();

    List<Announcement> findByCategoryOrderByPublishedAtDesc(AnnouncementCategory category);

    /** Open registration calls linked to a given match — used to close them when the match finishes. */
    List<Announcement> findByMatchIdAndRegistrationOpenTrue(UUID matchId);

    /** Open registration calls of a given mode — used to close franchise calls when a season starts. */
    List<Announcement> findByRegistrationOpenTrueAndRegistrationType(RegistrationType registrationType);
}
