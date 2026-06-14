package com.sidequest.arena.admin;

import com.sidequest.arena.admin.dto.SettingsView;
import com.sidequest.arena.admin.dto.UpdateSettingsRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only league settings (season + scoring rules) read and partial update.
 */
@RestController
@RequestMapping("/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    /** Current league settings. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public SettingsView get() {
        return settingsService.get();
    }

    /** Apply a partial update to the league settings. */
    @PatchMapping
    @PreAuthorize("hasRole('ADMIN')")
    public SettingsView update(@Valid @RequestBody UpdateSettingsRequest request) {
        return settingsService.update(request);
    }
}
