package com.sidequest.arena.email;

/** Transport for transactional email. The implementation chooses SMTP or a dev console fallback. */
public interface EmailSender {

    void send(String to, String subject, String body);
}
