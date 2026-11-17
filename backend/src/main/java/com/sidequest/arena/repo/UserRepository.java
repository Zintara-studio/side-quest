package com.sidequest.arena.repo;

import com.sidequest.arena.model.AdminLevel;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByPhone(String phone);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRole(Role role);

    /** All admins of a given tier (e.g. every SUPER_ADMIN) — used for the singleton-main-admin guard. */
    List<User> findByAdminLevel(AdminLevel adminLevel);

    /** Every admin (any tier above NONE) — the staff roster + admin management list. */
    List<User> findByAdminLevelNotOrderByNameAsc(AdminLevel adminLevel);

    boolean existsByAdminLevel(AdminLevel adminLevel);
}
