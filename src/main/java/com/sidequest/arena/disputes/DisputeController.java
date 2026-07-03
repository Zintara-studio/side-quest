package com.sidequest.arena.disputes;

import com.sidequest.arena.admin.dto.DisputeView;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.disputes.dto.CreateDisputeRequest;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User-facing disputes API: any authenticated user can open a dispute (result challenge, account
 * appeal, or general issue) and list the disputes they have raised. Admin triage lives under
 * {@code /admin/disputes}.
 */
@RestController
@RequestMapping("/disputes")
public class DisputeController {

    private final DisputeService disputeService;
    private final UserRepository userRepository;

    public DisputeController(DisputeService disputeService, UserRepository userRepository) {
        this.disputeService = disputeService;
        this.userRepository = userRepository;
    }

    /** Open a new dispute as the current user. */
    @PostMapping
    public DisputeView raise(@Valid @RequestBody CreateDisputeRequest request) {
        return disputeService.raiseDispute(currentUser(), request.matchId(), request.reason(),
                request.category());
    }

    /** The current user's raised disputes, newest first. */
    @GetMapping("/mine")
    public List<DisputeView> mine() {
        return disputeService.myDisputes(currentUser());
    }

    // ---- helpers ----

    private User currentUser() {
        return userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.unauthorized("Authentication required"));
    }
}
