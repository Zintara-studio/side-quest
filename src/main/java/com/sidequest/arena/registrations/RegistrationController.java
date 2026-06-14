package com.sidequest.arena.registrations;

import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.registrations.dto.ApplyRequest;
import com.sidequest.arena.registrations.dto.RegistrationView;
import com.sidequest.arena.registrations.dto.ReviewRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * League registration endpoints: applying as a player or squad, plus the admin approval queue
 * (list / detail) and review actions (approve / reject).
 */
@RestController
@RequestMapping("/registrations")
public class RegistrationController {

    private final RegistrationService registrationService;

    public RegistrationController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    /** Apply to the league as a player or squad (authenticated). */
    @PostMapping
    public ResponseEntity<RegistrationView> apply(@Valid @RequestBody ApplyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registrationService.apply(request));
    }

    /** Admin approval queue, newest first, optionally filtered by status and type. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<RegistrationView> list(
            @RequestParam(required = false) RegistrationStatus status,
            @RequestParam(required = false) RegistrationType type,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor) {
        return registrationService.list(status, type, limit, cursor);
    }

    /** Full detail for a single registration (admin only). */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public RegistrationView get(@PathVariable String id) {
        return registrationService.get(id);
    }

    /** Approve a registration (admin only). */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public RegistrationView approve(@PathVariable String id,
                                    @RequestBody(required = false) ReviewRequest request) {
        return registrationService.approve(id, request);
    }

    /** Reject a registration with a required reason (admin only). */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public RegistrationView reject(@PathVariable String id,
                                   @RequestBody ReviewRequest request) {
        return registrationService.reject(id, request);
    }
}
