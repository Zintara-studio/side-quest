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
        Object givenName = payload.get("given_name");
        Object picture = payload.get("picture");
        return new GoogleIdentity(
                payload.getEmail(),
                name == null ? payload.getEmail() : name.toString(),
                givenName == null ? null : givenName.toString(),
                picture == null ? null : picture.toString(),
                Boolean.TRUE.equals(payload.getEmailVerified()),
                payload.getSubject());
    }

    /**
     * The trusted claims we consume. {@code name}/{@code givenName}/{@code picture} are used to
     * pre-fill the onboarding form for a first-time Google user; {@code picture} is an external
     * googleusercontent URL (rendered as-is, never stored through the media pipeline). Note the
     * id_token does NOT carry a phone number, so phone cannot be pre-filled from Google.
     */
    public record GoogleIdentity(String email, String name, String givenName, String picture,
                                 boolean emailVerified, String subject) {
    }
}
