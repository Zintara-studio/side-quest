package com.sidequest.arena.repo;

import com.sidequest.arena.model.Franchise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FranchiseRepository extends JpaRepository<Franchise, UUID> {

    List<Franchise> findAllByOrderByPointsDescNameAsc();

    // Uniqueness is league-wide and ignores active/discarded (a discarded franchise's name/tag stays
    // reserved). The *AndIdNot variants let a rename exclude the franchise itself.
    java.util.Optional<Franchise> findByTagIgnoreCase(String tag);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByTagIgnoreCase(String tag);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    boolean existsByTagIgnoreCaseAndIdNot(String tag, UUID id);
}
