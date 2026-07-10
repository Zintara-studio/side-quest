package com.sidequest.arena.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.sidequest.arena.common.ApiException;
import com.sidequest.arena.common.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;

/**
 * Verifies a Google Sign-In id_token server-side (signature, audience == our client id, issuer, expiry).
 * Configured entirely by env: with no client id set (dev without Google) verification is refused with a
 * clean "not configured" error, so the rest of the app runs and is testable without Google credentials.
 */
@Component
public class GoogleTokenVerifier {

    private final GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${sidequest.google.client-id:}") String clientId) {
        this.verifier = (clientId == null || clientId.isBlank()) ? null
                : new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                        .setAudience(Collections.singletonList(clientId))
                        .build();
    }

    /** Verify the id_token and return the trusted identity, or throw. */
    public GoogleIdentity verify(String idTokenString) {
        if (verifier == null) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Google sign-in is not configured.");
        }
        GoogleIdToken idToken;
        try {
            idToken = verifier.verify(idTokenString);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid Google token");
        }
        if (idToken == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Invalid Google token");
        }
        GoogleIdToken.Payload payload = idToken.getPayload();
        Object name = payload.get("name");
        return new GoogleIdentity(
                payload.getEmail(),
                name == null ? payload.getEmail() : name.toString(),
                Boolean.TRUE.equals(payload.getEmailVerified()),
                payload.getSubject());
    }

    public record GoogleIdentity(String email, String name, boolean emailVerified, String subject) {
    }
}
