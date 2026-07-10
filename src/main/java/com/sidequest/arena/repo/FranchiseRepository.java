package com.sidequest.arena.repo;

import com.sidequest.arena.model.Franchise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FranchiseRepository extends JpaRepository<Franchise, UUID> {

    List<Franchise> findAllByOrderByPointsDescNameAsc();
}
