package com.sidequest.arena.repo;

import com.sidequest.arena.model.MediaAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Persistence for {@link MediaAsset} image blobs. */
public interface MediaAssetRepository extends JpaRepository<MediaAsset, UUID> {
}
