package com.sidequest.arena.media;

import com.sidequest.arena.media.dto.UploadMediaRequest;
import com.sidequest.arena.media.dto.UploadMediaResponse;
import com.sidequest.arena.model.MediaAsset;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

/**
 * Image storage endpoints. {@code POST /media} accepts a small base64 image (authenticated) and
 * returns its serving url; {@code GET /media/{id}} streams the stored bytes (public, immutably cached
 * — the id is content-addressable, so a stored asset never changes).
 */
@RestController
@RequestMapping("/media")
public class MediaController {

    private final MediaService mediaService;

    public MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    /** Store a base64 image and return its id + serving url (authenticated). */
    @PostMapping
    public UploadMediaResponse upload(@Valid @RequestBody UploadMediaRequest request) {
        return mediaService.upload(request);
    }

    /** Serve the stored image bytes with a long immutable cache (public). */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable String id) {
        MediaAsset asset = mediaService.load(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .eTag("\"" + asset.getId() + "\"")
                .body(asset.getData());
    }
}
