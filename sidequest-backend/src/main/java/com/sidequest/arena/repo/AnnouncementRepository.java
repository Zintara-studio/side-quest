package com.sidequest.arena.repo;

import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AnnouncementRepository extends JpaRepository<Announcement, UUID> {

    List<Announcement> findAllByOrderByPublishedAtDesc();

    List<Announcement> findByCategoryOrderByPublishedAtDesc(AnnouncementCategory category);
}
