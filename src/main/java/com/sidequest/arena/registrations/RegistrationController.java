package com.sidequest.arena.registrations;

import com.sidequest.arena.common.PageResponse;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.registrations.dto.ApplyRequest;
import com.sidequest.arena.registrations.dto.InviteRequest;
import com.sidequest.arena.registrations.dto.InviteView;
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

import java.util.List;

/**
 * League registration endpoints: applying as a player or squad, the player's own registrations and
 * squad-invite flow, plus the admin approval queue (list / detail) and review actions (approve /
 * reject).
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

    /** The current player's own registrations, each with its squad roster (authenticated). */
    @GetMapping("/mine")
    public List<RegistrationView> mine() {
        return registrationService.mine();
    }

    /** Squad invitations addressed to the current player (authenticated). */
    @GetMapping("/invites/mine")
    public List<InviteView> myInvites() {
        return registrationService.myInvites();
    }

    /** Captain invites a teammate to a squad registration (authenticated; captain-only in service). */
    @PostMapping("/{id}/invite")
    public RegistrationView invite(@PathVariable String id, @Valid @RequestBody InviteRequest request) {
        return registrationService.invite(id, request);
    }

    /** The invited player accepts a squad invite (authenticated; invitee-only in service). */
    @PostMapping("/invites/{inviteId}/accept")
    public InviteView acceptInvite(@PathVariable String inviteId) {
        return registrationService.respondToInvite(inviteId, true);
    }

    /** The invited player declines a squad invite (authenticated; invitee-only in service). */
    @PostMapping("/invites/{inviteId}/reject")
    public InviteView rejectInvite(@PathVariable String inviteId) {
        return registrationService.respondToInvite(inviteId, false);
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

    /** Discard a registration or franchise proposal (admin only); reason optional. */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public RegistrationView reject(@PathVariable String id,
                                   @RequestBody(required = false) ReviewRequest request) {
        return registrationService.reject(id, request);
    }
}
