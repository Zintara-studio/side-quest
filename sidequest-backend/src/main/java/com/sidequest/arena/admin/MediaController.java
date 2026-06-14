package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.AvatarRequest;
import com.sidequest.arena.admin.dto.AvatarResponse;
import com.sidequest.arena.admin.dto.SignRequest;
import com.sidequest.arena.admin.dto.SignResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Media endpoints: obtaining a (simulated) presigned upload URL and attaching an uploaded avatar
 * to a player. Both require authentication.
 */
@RestController
@RequestMapping("/uploads")
public class MediaController {

    private final MediaService mediaService;

    public MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    /** Get a simulated presigned upload URL for a file. */
    @PostMapping("/sign")
    public SignResponse sign(@Valid @RequestBody SignRequest request) {
        return mediaService.sign(request);
    }

    /** Attach an avatar URL to a player (owner or admin only). */
    @PostMapping("/avatar")
    public AvatarResponse avatar(@Valid @RequestBody AvatarRequest request) {
        return mediaService.setAvatar(request);
    }
}
