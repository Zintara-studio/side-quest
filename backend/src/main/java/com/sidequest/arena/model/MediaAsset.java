package com.sidequest.arena.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * A small image (avatar / franchise logo / banner) stored inline in the database as bytes and served
 * back at {@code GET /media/{id}}. Kept intentionally tiny (see the per-kind size caps enforced in the
 * upload service) so DB-blob storage stays cheap and no external object store is required.
 *
 * <p>The bytes are a plain {@code byte[]} with an explicit column length (not {@code @Lob}) so the
 * mapping is portable: {@code VARBINARY} on H2 and {@code bytea} on PostgreSQL, avoiding the large-object
 * (oid) handling that {@code @Lob byte[]} triggers on Postgres.
 */
@Entity
@Table(name = "media_assets")
@Getter
@Setter
@NoArgsConstructor
public class MediaAsset extends BaseEntity {

    /** Raw image bytes. Length comfortably exceeds the largest per-kind cap (256KB banners). */
    @Column(name = "data", nullable = false, length = 300_000)
    private byte[] data;

    /** Sniffed MIME type (image/png, image/jpeg, image/webp, image/gif). */
    @Column(name = "content_type", nullable = false, length = 64)
    private String contentType;

    /** Decoded byte length, denormalised for cheap listing/auditing. */
    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    /** What the asset is for: avatar / logo / banner. Free-form, used only for size policy + auditing. */
    @Column(name = "kind", length = 32)
    private String kind;

    /** The user who uploaded the asset, for auditing. */
    @Column(name = "uploaded_by")
    private UUID uploadedBy;
}
