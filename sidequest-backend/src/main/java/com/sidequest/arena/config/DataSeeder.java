package com.sidequest.arena.config;

import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.AnnouncementRepository;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.scoring.ScoringService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Seeds a realistic demo league (Season 04) so the API is useful out of the box. Enabled by
 * {@code sidequest.seed.enabled} (on for the dev profile, off for postgres). Idempotent: it does
 * nothing if any users already exist.
 *
 * <p>Demo credentials — password for every account is {@code password}:
 * <ul>
 *   <li>admin@sidequest.gg — ADMIN</li>
 *   <li>manager@sidequest.gg — FRANCHISE_MANAGER</li>
 *   <li>raghavan@sidequest.gg (and other players) — PLAYER</li>
 * </ul>
 */
@Configuration
@ConditionalOnProperty(name = "sidequest.seed.enabled", havingValue = "true")
public class DataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String SEASON = "S04";

    @Bean
    ApplicationRunner seedData(UserRepository users,
                               PlayerRepository players,
                               FranchiseRepository franchises,
                               GameRepository games,
                               MatchRepository matches,
                               MatchParticipantRepository participants,
                               ResultRowRepository resultRows,
                               RegistrationRepository registrations,
                               AnnouncementRepository announcements,
                               DisputeRepository disputes,
                               PlayerGameUsernameRepository usernames,
                               PlayerGameProficiencyRepository proficiencies,
                               LeagueSettingsRepository settings,
                               ScoringService scoring,
                               PasswordEncoder encoder) {
        return args -> {
            if (users.count() > 0) {
                log.info("Seed skipped — data already present ({} users).", users.count());
                return;
            }
            log.info("Seeding Side Quest demo league (Season 04)...");
            String pw = encoder.encode("password");

            // ---- league settings ----
            if (settings.findById(LeagueSettings.SINGLETON_ID).isEmpty()) {
                settings.save(new LeagueSettings());
            }

            // ---- games ----
            Game valorant = games.save(game("Valorant", "5v5 Tactical", 96));
            Game bgmi = games.save(game("BGMI", "Battle Royale · Squads", 91));
            Game cs2 = games.save(game("CS2", "5v5 Tactical", 84));
            Game smash = games.save(game("Smashkarts", "Free-for-all · 1v1", 67));
            Game r6 = game("Rainbow Six", "5v5 Tactical", 40);
            r6.setEnabled(false);
            r6.setRegOpen(false);
            games.save(r6);

            // ---- admin + manager ----
            users.save(user("League Admin", "admin@sidequest.gg", "+919800000001", Role.ADMIN, pw));
            users.save(user("Franchise Manager", "manager@sidequest.gg", "+919800000002",
                    Role.FRANCHISE_MANAGER, pw));

            // ---- franchises ----
            Franchise rxg = franchises.save(franchise("RXG", "RXG"));
            Franchise moti = franchises.save(franchise("Motichoor Esports", "MOTI"));
            Franchise night = franchises.save(franchise("Nightfall", "NGT"));
            Franchise titans = franchises.save(franchise("Apex Titans", "APX"));

            // ---- players ----
            Player raghavan = player(users, players, "Raghavan", "raghavan@sidequest.gg",
                    pw, rxg, PlayerStatus.VERIFIED);
            rxg.setIglPlayer(raghavan);
            franchises.save(rxg);
            Player vortex = player(users, players, "Vortex", "vortex@sidequest.gg", pw, rxg, PlayerStatus.VERIFIED);
            Player blaze = player(users, players, "Blaze", "blaze@sidequest.gg", pw, moti, PlayerStatus.VERIFIED);
            moti.setIglPlayer(blaze);
            franchises.save(moti);
            Player specter = player(users, players, "Specter", "specter@sidequest.gg", pw, night, PlayerStatus.VERIFIED);
            night.setIglPlayer(specter);
            franchises.save(night);
            Player nova = player(users, players, "Nova", "nova@sidequest.gg", pw, titans, PlayerStatus.VERIFIED);
            titans.setIglPlayer(nova);
            franchises.save(titans);
            Player rookie = player(users, players, "Rookie", "rookie@sidequest.gg", pw, null, PlayerStatus.PENDING);

            // ---- game handles + proficiency for Raghavan ----
            usernames.save(handle(raghavan, valorant, "RXG_Raghavan", true));
            usernames.save(handle(raghavan, bgmi, "RXGxRagha", true));
            usernames.save(handle(raghavan, cs2, "ragha_private", false));
            proficiencies.save(prof(raghavan, valorant, 92));
            proficiencies.save(prof(raghavan, bgmi, 88));

            // ---- matches ----
            Instant now = Instant.now();
            Match completed = matches.save(match(valorant, now.minus(2, ChronoUnit.DAYS),
                    MatchStatus.COMPLETED, "Arena A", "Bo3"));
            Match live = matches.save(match(bgmi, now, MatchStatus.LIVE, "Main Stage", "Bo1"));
            Match scheduled = matches.save(match(cs2, now.plus(1, ChronoUnit.DAYS),
                    MatchStatus.SCHEDULED, "Arena B", "Bo3"));

            participants.save(participant(completed, rxg));
            participants.save(participant(completed, moti));
            participants.save(participant(completed, night));
            participants.save(participant(completed, titans));
            participants.save(participant(live, rxg));
            participants.save(participant(live, night));
            participants.save(participant(scheduled, moti));
            participants.save(participant(scheduled, titans));

            // ---- published results for the completed match ----
            resultRows.save(result(completed, rxg, 24, 15, 1));
            resultRows.save(result(completed, night, 18, 12, 2));
            resultRows.save(result(completed, moti, 15, 10, 3));
            resultRows.save(result(completed, titans, 9, 8, 4));
            completed.setResultsPublishedAt(now.minus(2, ChronoUnit.DAYS));
            matches.save(completed);

            // ---- registrations ----
            Registration squadReg = new Registration();
            squadReg.setType(RegistrationType.SQUAD);
            squadReg.setSquadName("Phantom Five");
            squadReg.setPlayer(rookie);
            squadReg.setGames(new ArrayList<>(List.of("Valorant", "CS2")));
            squadReg.setContact("discord: phantom#0001");
            squadReg.setStatus(RegistrationStatus.PENDING);
            registrations.save(squadReg);

            Registration ffaReg = new Registration();
            ffaReg.setType(RegistrationType.PLAYER);
            ffaReg.setPlayer(rookie);
            ffaReg.setGames(new ArrayList<>(List.of("Smashkarts")));
            ffaReg.setContact("whatsapp: +91 98765 43210");
            ffaReg.setStatus(RegistrationStatus.PENDING);
            registrations.save(ffaReg);

            // ---- announcements ----
            announcements.save(announcement(AnnouncementCategory.RESULT,
                    "RXG storm Match Day 4", "RXG top the table after a dominant Valorant series.",
                    completed, now.minus(2, ChronoUnit.DAYS)));
            announcements.save(announcement(AnnouncementCategory.GENERAL,
                    "Season 04 registrations are live", "Franchise season and free-for-all flows are open.",
                    null, now.minus(5, ChronoUnit.DAYS)));
            announcements.save(announcement(AnnouncementCategory.RECAP,
                    "Week 1 recap", "Highlights, upsets and the players to watch.",
                    null, now.minus(1, ChronoUnit.DAYS)));

            // ---- an open result dispute for the admin control room ----
            Dispute dispute = new Dispute();
            dispute.setMatch(completed);
            dispute.setReason("Motichoor dispute final-circle kill credit — scoreboard screenshot mismatch.");
            dispute.setStatus(DisputeStatus.OPEN);
            disputes.save(dispute);

            // ---- compute standings from seeded results ----
            scoring.recomputeStandings();

            log.info("Seed complete: {} users, {} franchises, {} games, {} matches.",
                    users.count(), franchises.count(), games.count(), matches.count());
        };
    }

    // ---- small builders ----

    private static Game game(String name, String format, int popularity) {
        Game g = new Game();
        g.setName(name);
        g.setFormat(format);
        g.setPopularity(popularity);
        g.setEnabled(true);
        g.setRegOpen(true);
        return g;
    }

    private static User user(String name, String email, String phone, Role role, String pwHash) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPhone(phone);
        u.setRole(role);
        u.setPasswordHash(pwHash);
        return u;
    }

    private static Franchise franchise(String name, String tag) {
        Franchise f = new Franchise();
        f.setName(name);
        f.setTag(tag);
        f.setSeasonId(SEASON);
        f.setActive(true);
        return f;
    }

    private static Player player(UserRepository users, PlayerRepository players, String name,
                                 String email, String pwHash, Franchise franchise, PlayerStatus status) {
        User u = users.save(user(name, email, null, Role.PLAYER, pwHash));
        Player p = new Player();
        p.setUser(u);
        p.setGamerTag(name);
        p.setFranchise(franchise);
        p.setStatus(status);
        p.setRegion("IN");
        return players.save(p);
    }

    private static PlayerGameUsername handle(Player p, Game g, String handle, boolean isPublic) {
        PlayerGameUsername h = new PlayerGameUsername();
        h.setPlayer(p);
        h.setGame(g);
        h.setHandle(handle);
        h.setPublic(isPublic);
        return h;
    }

    private static PlayerGameProficiency prof(Player p, Game g, int rating) {
        PlayerGameProficiency pr = new PlayerGameProficiency();
        pr.setPlayer(p);
        pr.setGame(g);
        pr.setRating(rating);
        return pr;
    }

    private static Match match(Game game, Instant when, MatchStatus status, String arena, String format) {
        Match m = new Match();
        m.setGame(game);
        m.setScheduledAt(when);
        m.setStatus(status);
        m.setSeasonId(SEASON);
        m.setArena(arena);
        m.setFormat(format);
        return m;
    }

    private static MatchParticipant participant(Match m, Franchise f) {
        MatchParticipant mp = new MatchParticipant();
        mp.setMatch(m);
        mp.setFranchise(f);
        return mp;
    }

    private static ResultRow result(Match m, Franchise f, int kills, int placePts, int rank) {
        ResultRow r = new ResultRow();
        r.setMatch(m);
        r.setFranchise(f);
        r.setKills(kills);
        r.setPlacePts(placePts);
        r.setTotal(kills + placePts);
        r.setRank(rank);
        return r;
    }

    private static Announcement announcement(AnnouncementCategory cat, String title, String body,
                                             Match match, Instant publishedAt) {
        Announcement a = new Announcement();
        a.setCategory(cat);
        a.setTitle(title);
        a.setBody(body);
        a.setMatch(match);
        a.setPublishedAt(publishedAt);
        return a;
    }
}
