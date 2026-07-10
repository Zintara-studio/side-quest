package com.sidequest.arena.config;

import com.sidequest.arena.model.Announcement;
import com.sidequest.arena.model.AnnouncementCategory;
import com.sidequest.arena.model.Auction;
import com.sidequest.arena.model.AuctionFranchise;
import com.sidequest.arena.model.AuctionLot;
import com.sidequest.arena.model.AuctionLotStatus;
import com.sidequest.arena.model.AuctionStatus;
import com.sidequest.arena.model.Dispute;
import com.sidequest.arena.model.DisputeCategory;
import com.sidequest.arena.model.DisputeStatus;
import com.sidequest.arena.model.Franchise;
import com.sidequest.arena.model.FranchiseInvite;
import com.sidequest.arena.model.FranchiseRole;
import com.sidequest.arena.model.Game;
import com.sidequest.arena.model.GameType;
import com.sidequest.arena.model.InviteStatus;
import com.sidequest.arena.model.LeagueSettings;
import com.sidequest.arena.model.Match;
import com.sidequest.arena.model.MatchLineup;
import com.sidequest.arena.model.MatchParticipant;
import com.sidequest.arena.model.MatchRound;
import com.sidequest.arena.model.MatchRoundPlayerResult;
import com.sidequest.arena.model.MatchRoundResult;
import com.sidequest.arena.model.MatchStatus;
import com.sidequest.arena.model.MatchType;
import com.sidequest.arena.model.Notification;
import com.sidequest.arena.model.NotificationType;
import com.sidequest.arena.model.Player;
import com.sidequest.arena.model.PlayerFranchiseHistory;
import com.sidequest.arena.model.PlayerGameProficiency;
import com.sidequest.arena.model.PlayerGameUsername;
import com.sidequest.arena.model.PlayerStatus;
import com.sidequest.arena.model.Registration;
import com.sidequest.arena.model.RegistrationStatus;
import com.sidequest.arena.model.RegistrationType;
import com.sidequest.arena.model.ResultRow;
import com.sidequest.arena.model.Role;
import com.sidequest.arena.model.Season;
import com.sidequest.arena.model.SeasonStanding;
import com.sidequest.arena.model.SeasonStatus;
import com.sidequest.arena.model.TeamInvite;
import com.sidequest.arena.model.User;
import com.sidequest.arena.repo.AnnouncementRepository;
import com.sidequest.arena.repo.AuctionFranchiseRepository;
import com.sidequest.arena.repo.AuctionLotRepository;
import com.sidequest.arena.repo.AuctionRepository;
import com.sidequest.arena.repo.DisputeRepository;
import com.sidequest.arena.repo.FranchiseInviteRepository;
import com.sidequest.arena.repo.FranchiseRepository;
import com.sidequest.arena.repo.GameRepository;
import com.sidequest.arena.repo.LeagueSettingsRepository;
import com.sidequest.arena.repo.MatchLineupRepository;
import com.sidequest.arena.repo.MatchParticipantRepository;
import com.sidequest.arena.repo.MatchRepository;
import com.sidequest.arena.repo.MatchRoundPlayerResultRepository;
import com.sidequest.arena.repo.MatchRoundRepository;
import com.sidequest.arena.repo.MatchRoundResultRepository;
import com.sidequest.arena.repo.NotificationRepository;
import com.sidequest.arena.repo.PlayerFranchiseHistoryRepository;
import com.sidequest.arena.repo.PlayerGameProficiencyRepository;
import com.sidequest.arena.repo.PlayerGameUsernameRepository;
import com.sidequest.arena.repo.PlayerRepository;
import com.sidequest.arena.repo.RegistrationRepository;
import com.sidequest.arena.repo.ResultRowRepository;
import com.sidequest.arena.repo.SeasonRepository;
import com.sidequest.arena.repo.SeasonStandingRepository;
import com.sidequest.arena.repo.TeamInviteRepository;
import com.sidequest.arena.repo.UserRepository;
import com.sidequest.arena.scoring.ScoringService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
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
@Profile("dev") // belt-and-braces: demo seed data (incl. known-password accounts) can never load outside dev
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
                               MatchLineupRepository lineups,
                               ResultRowRepository resultRows,
                               MatchRoundRepository matchRounds,
                               MatchRoundResultRepository matchRoundResults,
                               MatchRoundPlayerResultRepository matchRoundPlayerResults,
                               RegistrationRepository registrations,
                               TeamInviteRepository teamInvites,
                               FranchiseInviteRepository franchiseInvites,
                               AnnouncementRepository announcements,
                               AuctionRepository auctions,
                               AuctionFranchiseRepository auctionFranchises,
                               AuctionLotRepository auctionLots,
                               NotificationRepository notifs,
                               DisputeRepository disputes,
                               PlayerGameUsernameRepository usernames,
                               PlayerGameProficiencyRepository proficiencies,
                               LeagueSettingsRepository settings,
                               SeasonRepository seasons,
                               SeasonStandingRepository seasonStandings,
                               PlayerFranchiseHistoryRepository franchiseHistory,
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

            // ---- seasons (a finished S03 with frozen history + the active S04) ----
            Instant seedNow = Instant.now();
            seasons.save(season("S03", "Season 03 — Winter", SeasonStatus.FINISHED,
                    seedNow.minus(150, ChronoUnit.DAYS), seedNow.minus(40, ChronoUnit.DAYS)));
            seasons.save(season("S04", "Season 04 — Spring", SeasonStatus.ACTIVE,
                    seedNow.minus(30, ChronoUnit.DAYS), null));

            // ---- games ----
            // Genre (GameType) drives result-entry flow + default scoring: BATTLE_ROYALE/PARTY are
            // placement-driven; TACTICAL/SPORTS/FIGHTING score on the final result / kills alone.
            Game valorant = games.save(game("Valorant", "5v5 Tactical", GameType.TACTICAL, 96));
            Game bgmi = games.save(game("BGMI", "Battle Royale · Squads", GameType.BATTLE_ROYALE, 91));
            Game cs2 = games.save(game("CS2", "5v5 Tactical", GameType.TACTICAL, 84));
            Game smash = games.save(game("Smashkarts", "Free-for-all · 1v1", GameType.PARTY, 67));
            Game r6 = game("Rainbow Six", "5v5 Tactical", GameType.TACTICAL, 40);
            r6.setEnabled(false);
            games.save(r6);
            // Additional college titles.
            games.save(game("FIFA", "1v1 · Sports", GameType.SPORTS, 62));
            games.save(game("Free Fire", "Battle Royale · Squads", GameType.BATTLE_ROYALE, 78));
            games.save(game("Marvel Rivals", "6v6 Hero Shooter", GameType.TACTICAL, 70));
            games.save(game("COD", "Battle Royale · Mobile", GameType.BATTLE_ROYALE, 74));
            games.save(game("Brawlhalla", "Platform Fighter", GameType.FIGHTING, 45));

            // ---- admin + manager ----
            User adminUser = users.save(user("League Admin", "admin@sidequest.gg", "+919800000001",
                    Role.ADMIN, pw));
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
            Player vortex = player(users, players, "Vortex", "vortex@sidequest.gg", pw, rxg, PlayerStatus.VERIFIED);
            Player blaze = player(users, players, "Blaze", "blaze@sidequest.gg", pw, moti, PlayerStatus.VERIFIED);
            Player specter = player(users, players, "Specter", "specter@sidequest.gg", pw, night, PlayerStatus.VERIFIED);
            Player nova = player(users, players, "Nova", "nova@sidequest.gg", pw, titans, PlayerStatus.VERIFIED);
            Player rookie = player(users, players, "Rookie", "rookie@sidequest.gg", pw, null, PlayerStatus.PENDING);

            // ---- frozen S03 history (final standings, with real franchise ids) ----
            seasonStandings.save(seasonStanding("S03", night.getId().toString(), "Nightfall", "NGT", 1, 412));
            seasonStandings.save(seasonStanding("S03", rxg.getId().toString(), "RXG", "RXG", 2, 388));
            seasonStandings.save(seasonStanding("S03", titans.getId().toString(), "Apex Titans", "APX", 3, 351));
            seasonStandings.save(seasonStanding("S03", moti.getId().toString(), "Motichoor Esports", "MOTI", 4, 309));

            // ---- fuller rosters (≈4–5 players per franchise) ----
            Player ace = player(users, players, "Ace", "ace@sidequest.gg", pw, rxg, PlayerStatus.VERIFIED);
            Player kiran = player(users, players, "Kiran", "kiran@sidequest.gg", pw, rxg, PlayerStatus.VERIFIED);
            Player echo = player(users, players, "Echo", "echo@sidequest.gg", pw, moti, PlayerStatus.VERIFIED);
            Player riot = player(users, players, "Riot", "riot@sidequest.gg", pw, moti, PlayerStatus.VERIFIED);
            Player frost = player(users, players, "Frost", "frost@sidequest.gg", pw, moti, PlayerStatus.VERIFIED);
            Player zen = player(users, players, "Zen", "zen@sidequest.gg", pw, night, PlayerStatus.VERIFIED);
            Player kai = player(users, players, "Kai", "kai@sidequest.gg", pw, night, PlayerStatus.VERIFIED);
            Player onyx = player(users, players, "Onyx", "onyx@sidequest.gg", pw, titans, PlayerStatus.VERIFIED);
            Player sable = player(users, players, "Sable", "sable@sidequest.gg", pw, titans, PlayerStatus.VERIFIED);
            Player drift = player(users, players, "Drift", "drift@sidequest.gg", pw, null, PlayerStatus.PENDING);
            // A verified free agent (no franchise) — the target of the demo franchise MANAGER invite below.
            Player blitz = player(users, players, "Blitz", "blitz@sidequest.gg", pw, null, PlayerStatus.VERIFIED);

            // ---- auction free agents (unassigned; seed the Season 04 auction pool) ----
            Player ghost = player(users, players, "Ghost", "ghost@sidequest.gg", pw, null, PlayerStatus.VERIFIED);
            Player pulse = player(users, players, "Pulse", "pulse@sidequest.gg", pw, null, PlayerStatus.VERIFIED);
            Player volt = player(users, players, "Volt", "volt@sidequest.gg", pw, null, PlayerStatus.VERIFIED);
            Player rex = player(users, players, "Rex", "rex@sidequest.gg", pw, null, PlayerStatus.VERIFIED);
            Player hex = player(users, players, "Hex", "hex@sidequest.gg", pw, null, PlayerStatus.VERIFIED);

            // ---- franchise owners + managers (roster members, elevated user roles) ----
            // Each franchise gets an owner and a distinct manager drawn from its own roster; their
            // user accounts are raised to FRANCHISE_OWNER / FRANCHISE_MANAGER.
            assignOwnerManager(rxg, vortex, ace, franchises, users);
            assignOwnerManager(moti, echo, riot, franchises, users);
            assignOwnerManager(night, zen, kai, franchises, users);
            // Apex Titans has an owner but an OPEN manager seat — its owner invites free agent Blitz below,
            // so the owner-driven franchise-invite handshake has a live accept-able target for the demo.
            titans.setOwnerPlayer(onyx);
            franchises.save(titans);
            onyx.getUser().setRole(Role.FRANCHISE_OWNER);
            users.save(onyx.getUser());

            // ---- frozen S03 roster history (browsable past memberships for the finished season) ----
            franchiseHistory.save(pfh(raghavan, rxg, "S03", "OWNER"));
            franchiseHistory.save(pfh(vortex, rxg, "S03", "MANAGER"));
            franchiseHistory.save(pfh(ace, rxg, "S03", "PLAYER"));
            franchiseHistory.save(pfh(kiran, rxg, "S03", "PLAYER"));
            franchiseHistory.save(pfh(blaze, moti, "S03", "OWNER"));
            franchiseHistory.save(pfh(echo, moti, "S03", "MANAGER"));
            franchiseHistory.save(pfh(riot, moti, "S03", "PLAYER"));
            franchiseHistory.save(pfh(specter, night, "S03", "OWNER"));
            franchiseHistory.save(pfh(zen, night, "S03", "MANAGER"));
            franchiseHistory.save(pfh(kai, night, "S03", "PLAYER"));
            franchiseHistory.save(pfh(nova, titans, "S03", "OWNER"));
            franchiseHistory.save(pfh(onyx, titans, "S03", "MANAGER"));
            franchiseHistory.save(pfh(sable, titans, "S03", "PLAYER"));

            // ---- game handles + proficiency for Raghavan ----
            usernames.save(handle(raghavan, valorant, "RXG_Raghavan", true));
            usernames.save(handle(raghavan, bgmi, "RXGxRagha", true));
            usernames.save(handle(raghavan, cs2, "ragha_private", false));
            proficiencies.save(prof(raghavan, valorant, 92));
            proficiencies.save(prof(raghavan, bgmi, 88));

            // ---- handles + proficiency for other franchise leaders ----
            usernames.save(handle(blaze, valorant, "MOTI_Blaze", true));
            usernames.save(handle(blaze, cs2, "blaze_priv", false));
            usernames.save(handle(specter, bgmi, "NGT_Specter", true));
            usernames.save(handle(nova, cs2, "APX_Nova", true));
            proficiencies.save(prof(blaze, valorant, 89));
            proficiencies.save(prof(specter, valorant, 85));
            proficiencies.save(prof(specter, bgmi, 80));
            proficiencies.save(prof(nova, cs2, 83));

            // ---- scouting profiles for the auction free agents (public handles + self-rated skill) ----
            usernames.save(handle(ghost, valorant, "Ghost_Valo", true));
            usernames.save(handle(pulse, bgmi, "PulseBR", true));
            usernames.save(handle(volt, cs2, "VoltAim", true));
            proficiencies.save(prof(ghost, valorant, 78));
            proficiencies.save(prof(pulse, bgmi, 74));
            proficiencies.save(prof(volt, cs2, 81));

            // ---- matches ----
            Instant now = Instant.now();
            Match completed = matches.save(match(valorant, now.minus(2, ChronoUnit.DAYS),
                    MatchStatus.COMPLETED, "Arena A", "Bo3"));
            Match live = matches.save(match(bgmi, now, MatchStatus.LIVE, "Main Stage", "Bo1"));
            Match scheduled = matches.save(match(cs2, now.plus(1, ChronoUnit.DAYS),
                    MatchStatus.SCHEDULED, "Arena B", "Bo3"));
            // A future free-for-all fixture the open Valorant showmatch call points at. Scheduled well
            // beyond the 3h registration lock so the demo sign-up flow stays open.
            Match futureFfa = match(valorant, now.plus(7, ChronoUnit.DAYS),
                    MatchStatus.SCHEDULED, "Arena C", "Bo1");
            futureFfa.setMatchType(MatchType.FFA);
            futureFfa = matches.save(futureFfa);

            participants.save(participant(completed, rxg));
            participants.save(participant(completed, moti));
            participants.save(participant(completed, night));
            participants.save(participant(completed, titans));
            participants.save(participant(live, rxg));
            participants.save(participant(live, night));
            participants.save(participant(scheduled, moti));
            participants.save(participant(scheduled, titans));

            // ---- a fielded lineup for the upcoming (SCHEDULED) CS2 match: Motichoor field 4 of their
            //      roster; result entry / the players list then use this subset instead of the full roster ----
            lineups.save(lineup(scheduled, moti, blaze));
            lineups.save(lineup(scheduled, moti, echo));
            lineups.save(lineup(scheduled, moti, riot));
            lineups.save(lineup(scheduled, moti, frost));

            // ---- published results for the completed match ----
            resultRows.save(result(completed, rxg, 24, 15, 1));
            resultRows.save(result(completed, night, 18, 12, 2));
            resultRows.save(result(completed, moti, 15, 10, 3));
            resultRows.save(result(completed, titans, 9, 8, 4));
            completed.setResultsPublishedAt(now.minus(2, ChronoUnit.DAYS));
            matches.save(completed);

            // ---- more completed matches across titles for richer standings/history ----
            Match valoMd3 = matches.save(match(valorant, now.minus(6, ChronoUnit.DAYS),
                    MatchStatus.COMPLETED, "Arena A", "Bo3"));
            participants.save(participant(valoMd3, rxg));
            participants.save(participant(valoMd3, moti));
            participants.save(participant(valoMd3, night));
            participants.save(participant(valoMd3, titans));
            resultRows.save(result(valoMd3, moti, 28, 16, 1));
            resultRows.save(result(valoMd3, rxg, 22, 12, 2));
            resultRows.save(result(valoMd3, titans, 17, 10, 3));
            resultRows.save(result(valoMd3, night, 12, 8, 4));
            valoMd3.setResultsPublishedAt(now.minus(6, ChronoUnit.DAYS));
            matches.save(valoMd3);

            Match cs2Md2 = matches.save(match(cs2, now.minus(4, ChronoUnit.DAYS),
                    MatchStatus.COMPLETED, "Arena B", "Bo1"));
            participants.save(participant(cs2Md2, rxg));
            participants.save(participant(cs2Md2, night));
            participants.save(participant(cs2Md2, titans));
            participants.save(participant(cs2Md2, moti));
            resultRows.save(result(cs2Md2, night, 20, 14, 1));
            resultRows.save(result(cs2Md2, titans, 18, 12, 2));
            resultRows.save(result(cs2Md2, rxg, 15, 10, 3));
            resultRows.save(result(cs2Md2, moti, 11, 8, 4));
            cs2Md2.setResultsPublishedAt(now.minus(4, ChronoUnit.DAYS));
            matches.save(cs2Md2);

            // ---- a multi-round BGMI match (per-round, game-specific stat tables) ----
            Match bgmiMd2 = matches.save(match(bgmi, now.minus(5, ChronoUnit.DAYS),
                    MatchStatus.COMPLETED, "Main Stage", "3 rounds"));
            participants.save(participant(bgmiMd2, rxg));
            participants.save(participant(bgmiMd2, night));
            participants.save(participant(bgmiMd2, moti));
            participants.save(participant(bgmiMd2, titans));

            MatchRound r1 = matchRounds.save(round(bgmiMd2, 1, "Erangel", "TPP"));
            matchRoundResults.save(roundResult(r1, rxg, 1, 8, 1800, 15));
            matchRoundResults.save(roundResult(r1, night, 2, 6, 1500, 12));
            matchRoundResults.save(roundResult(r1, moti, 3, 5, 1200, 10));
            matchRoundResults.save(roundResult(r1, titans, 4, 3, 900, 8));
            MatchRound r2 = matchRounds.save(round(bgmiMd2, 2, "Miramar", "TPP"));
            matchRoundResults.save(roundResult(r2, night, 1, 9, 1850, 15));
            matchRoundResults.save(roundResult(r2, rxg, 2, 7, 1600, 12));
            matchRoundResults.save(roundResult(r2, titans, 3, 6, 1300, 10));
            matchRoundResults.save(roundResult(r2, moti, 4, 4, 1000, 8));
            MatchRound r3 = matchRounds.save(round(bgmiMd2, 3, "Sanhok", "TPP"));
            matchRoundResults.save(roundResult(r3, rxg, 1, 10, 1700, 15));
            matchRoundResults.save(roundResult(r3, moti, 2, 8, 1400, 12));
            matchRoundResults.save(roundResult(r3, night, 3, 5, 1100, 10));
            matchRoundResults.save(roundResult(r3, titans, 4, 4, 950, 8));
            // per-player breakdown for RXG (kills sum to the team's per-round kills: 8 / 7 / 10)
            matchRoundPlayerResults.save(playerResult(r1, rxg, raghavan, 3, 1800));
            matchRoundPlayerResults.save(playerResult(r1, rxg, vortex, 2, 1500));
            matchRoundPlayerResults.save(playerResult(r1, rxg, ace, 2, 1200));
            matchRoundPlayerResults.save(playerResult(r1, rxg, kiran, 1, 900));
            matchRoundPlayerResults.save(playerResult(r2, rxg, raghavan, 2, 1600));
            matchRoundPlayerResults.save(playerResult(r2, rxg, vortex, 2, 1400));
            matchRoundPlayerResults.save(playerResult(r2, rxg, ace, 2, 1100));
            matchRoundPlayerResults.save(playerResult(r2, rxg, kiran, 1, 800));
            matchRoundPlayerResults.save(playerResult(r3, rxg, raghavan, 4, 1700));
            matchRoundPlayerResults.save(playerResult(r3, rxg, vortex, 3, 1500));
            matchRoundPlayerResults.save(playerResult(r3, rxg, ace, 2, 1300));
            matchRoundPlayerResults.save(playerResult(r3, rxg, kiran, 1, 1000));
            // aggregated overall result rows (sum of kills + placement points)
            resultRows.save(result(bgmiMd2, rxg, 25, 42, 1));
            resultRows.save(result(bgmiMd2, night, 20, 37, 2));
            resultRows.save(result(bgmiMd2, moti, 17, 30, 3));
            resultRows.save(result(bgmiMd2, titans, 13, 26, 4));
            bgmiMd2.setResultsPublishedAt(now.minus(5, ChronoUnit.DAYS));
            matches.save(bgmiMd2);

            // ---- registrations ----
            Registration squadReg = new Registration();
            squadReg.setType(RegistrationType.SQUAD);
            squadReg.setSquadName("Phantom Five");
            squadReg.setPlayer(rookie);
            squadReg.setGames(new ArrayList<>(List.of("Valorant", "CS2")));
            squadReg.setContact("discord: phantom#0001");
            squadReg.setGame(valorant);
            squadReg.setTeamSize(5);
            squadReg.setStatus(RegistrationStatus.FORMING);
            Registration savedSquad = registrations.save(squadReg);

            // ---- squad invites (captain rookie builds the Phantom Five roster) ----
            teamInvites.save(teamInvite(savedSquad, vortex, rookie, InviteStatus.ACCEPTED));
            teamInvites.save(teamInvite(savedSquad, drift, rookie, InviteStatus.PENDING));
            teamInvites.save(teamInvite(savedSquad, echo, rookie, InviteStatus.REJECTED));

            // ---- a squad still FORMING (captain rookie assembling the roster, not yet submitted) ----
            Registration formingSquad = new Registration();
            formingSquad.setType(RegistrationType.SQUAD);
            formingSquad.setSquadName("Neon Wolves");
            formingSquad.setPlayer(rookie);
            formingSquad.setGames(new ArrayList<>(List.of("Valorant")));
            formingSquad.setContact("discord: neonwolves#0007");
            formingSquad.setGame(valorant);
            formingSquad.setTeamSize(5);
            formingSquad.setStatus(RegistrationStatus.FORMING);
            Registration savedForming = registrations.save(formingSquad);
            teamInvites.save(teamInvite(savedForming, drift, rookie, InviteStatus.ACCEPTED));
            teamInvites.save(teamInvite(savedForming, echo, rookie, InviteStatus.PENDING));

            Registration ffaReg = new Registration();
            ffaReg.setType(RegistrationType.PLAYER);
            ffaReg.setPlayer(rookie);
            ffaReg.setGames(new ArrayList<>(List.of("Smashkarts")));
            ffaReg.setContact("whatsapp: +91 98765 43210");
            ffaReg.setGame(smash);
            ffaReg.setStatus(RegistrationStatus.ACTIVE);
            registrations.save(ffaReg);

            // ---- a registered FFA solo entry tied to the future Valorant showmatch (game from match) ----
            Registration ffaMatchReg = new Registration();
            ffaMatchReg.setType(RegistrationType.PLAYER);
            ffaMatchReg.setPlayer(drift);
            ffaMatchReg.setGames(new ArrayList<>(List.of("Valorant")));
            ffaMatchReg.setContact("discord: drift#1234");
            ffaMatchReg.setMatch(futureFfa);
            ffaMatchReg.setGame(valorant);
            ffaMatchReg.setStatus(RegistrationStatus.ACTIVE);
            registrations.save(ffaMatchReg);

            // ---- a pending FRANCHISE proposal so the admin can approve it into a franchise ----
            Registration franchiseProposal = new Registration();
            franchiseProposal.setType(RegistrationType.FRANCHISE);
            franchiseProposal.setSquadName("Crimson Vanguard");
            franchiseProposal.setPlayer(rookie);
            franchiseProposal.setGames(new ArrayList<>(List.of("Valorant", "BGMI")));
            franchiseProposal.setContact("discord: vanguard#0007");
            franchiseProposal.setReason("Bootstrapping a new org for Season 04 — full roster ready.");
            franchiseProposal.setStatus(RegistrationStatus.PENDING);
            registrations.save(franchiseProposal);

            // ---- a pending owner-driven franchise invite: Apex Titans' owner (Onyx) invites free agent
            //      Blitz to become the franchise MANAGER (an empty seat, so acceptable mid-season). Makes
            //      /franchises/invites/mine (as Blitz) and Titans' pending-invites list non-empty. ----
            FranchiseInvite managerInvite = new FranchiseInvite();
            managerInvite.setFranchise(titans);
            managerInvite.setInvitedPlayer(blitz);
            managerInvite.setInvitedBy(onyx);
            managerInvite.setRole(FranchiseRole.MANAGER);
            managerInvite.setStatus(InviteStatus.PENDING);
            managerInvite.setMessage("We'd love to have you run the Apex Titans bench this season.");
            franchiseInvites.save(managerInvite);

            // ---- AUCTION-type registrations: free agents entering the Season 04 auction pool ----
            registrations.save(auctionRegistration(ghost, valorant,
                    List.of("Valorant", "CS2"), "discord: ghost#2201",
                    "Free-agent duelist, IGL-capable. Open to any franchise."));
            registrations.save(auctionRegistration(pulse, bgmi,
                    List.of("BGMI"), "whatsapp: +91 90000 11111",
                    "BGMI fragger with 3+ seasons of scrim experience."));
            registrations.save(auctionRegistration(volt, cs2,
                    List.of("CS2", "Valorant"), "discord: volt#0007",
                    "CS2 AWPer looking to get drafted for Season 04."));

            // ---- a DRAFT Season 04 player auction, pre-configured and ready for the admin to Start ----
            Auction s04Auction = auction("Season 04 Player Auction", SEASON, adminUser,
                    10, 30, 10, "10,50,100,200,500", 1000);
            auctions.save(s04Auction);
            // Three participating franchises, each with a purse (budget == balance) of 1000.
            auctionFranchises.save(auctionFranchise(s04Auction, rxg, 1000));
            auctionFranchises.save(auctionFranchise(s04Auction, moti, 1000));
            auctionFranchises.save(auctionFranchise(s04Auction, night, 1000));
            // A QUEUED lot pool: the three free-agent registrants plus two more detached players.
            int lotOrder = 0;
            for (Player prospect : List.of(ghost, pulse, volt, rex, hex)) {
                auctionLots.save(auctionLot(s04Auction, prospect, lotOrder++));
            }

            // ---- announcements ----
            announcements.save(announcement(AnnouncementCategory.RESULT,
                    "RXG storm Match Day 4", "RXG top the table after a dominant Valorant series.",
                    completed, now.minus(2, ChronoUnit.DAYS)));
            Announcement seasonReg = announcement(AnnouncementCategory.GENERAL,
                    "Season 04 registrations are live", "Franchise season and free-for-all flows are open.",
                    null, now.minus(5, ChronoUnit.DAYS));
            seasonReg.setRegistrationOpen(true);
            seasonReg.setRegistrationType(RegistrationType.PLAYER); // season = always solo
            announcements.save(seasonReg);

            Announcement bgmiReg = announcement(AnnouncementCategory.MATCH,
                    "Register for BGMI — Match Day 5", "Squad sign-ups are open for the BGMI lobby on 22 Aug.",
                    null, now.minus(3, ChronoUnit.HOURS));
            bgmiReg.setRegistrationOpen(true);
            bgmiReg.setGame(bgmi);
            bgmiReg.setRegistrationType(RegistrationType.SQUAD); // FFA team-based call
            announcements.save(bgmiReg);

            Announcement valoFfa = announcement(AnnouncementCategory.MATCH,
                    "Valorant Showmatch — solo sign-up", "Open free-for-all Valorant showmatch, register solo.",
                    futureFfa, now.minus(2, ChronoUnit.HOURS));
            valoFfa.setRegistrationOpen(true);
            valoFfa.setGame(valorant);
            valoFfa.setRegistrationType(RegistrationType.PLAYER); // FFA solo call
            announcements.save(valoFfa);

            // An AUCTION registration call: free agents sign up to enter the Season 04 auction pool.
            Announcement auctionCall = announcement(AnnouncementCategory.AUCTION,
                    "Season 04 Player Auction — enter the pool",
                    "Free agents: register for the Season 04 auction so franchises can draft you on auction night.",
                    null, now.minus(1, ChronoUnit.HOURS));
            auctionCall.setRegistrationOpen(true);
            auctionCall.setRegistrationType(RegistrationType.AUCTION); // player-pool auction call
            announcements.save(auctionCall);

            announcements.save(announcement(AnnouncementCategory.RECAP,
                    "Week 1 recap", "Highlights, upsets and the players to watch.",
                    null, now.minus(1, ChronoUnit.DAYS)));

            // ---- a long markdown-body announcement to showcase rich rendering ----
            announcements.save(announcement(AnnouncementCategory.RECAP,
                    "Season 04 Kickoff — Everything You Need to Know",
                    """
                    # Welcome to Season 04

                    Season 04 is officially **live**, and it's shaping up to be our biggest split yet.
                    Here's everything you need to get up to speed.

                    ![Season 04 banner](https://cdn.sidequest.gg/announcements/s04-banner.png)

                    ## What's new this season

                    - A revamped **franchise auction** — rosters are rebuilt from scratch every season.
                    - Per-match scoring weights, so organizers can tune kills vs. placement.
                    - A public **all-time standings** board that sums every season's points.

                    ## Key dates

                    1. **Auction night** — franchises draft their rosters.
                    2. **Match Day 1** — Valorant and CS2 open the split.
                    3. **Playoffs** — top four franchises fight for the title.

                    ## How to take part

                    Sign-ups are open from the [registrations page](/announcements). Solo players can
                    register for free-for-all showmatches, while squads can bid to form a franchise.

                    > "Every season is a fresh start. Earn your place." — League Admin

                    See you in the arena. **GLHF!**
                    """,
                    null, now.minus(6, ChronoUnit.DAYS)));

            // ---- a few in-app notifications for demo users ----
            notifs.save(notification(raghavan.getUser(), NotificationType.RESULT,
                    "Match result published", "RXG topped Match Day 4 — see the leaderboard.", "/match"));
            notifs.save(notification(raghavan.getUser(), NotificationType.ANNOUNCEMENT,
                    "Season 04 registrations are live", "Franchise season and free-for-all flows are open.",
                    "/announcements"));
            notifs.save(notification(rookie.getUser(), NotificationType.REGISTRATION,
                    "Registration received", "Your squad 'Phantom Five' is pending review.", "/notifications"));
            Notification welcome = notification(rookie.getUser(), NotificationType.GENERAL,
                    "Welcome to Side Quest", "Complete your profile to get noticed by franchises.", "/player");
            welcome.setRead(true);
            notifs.save(welcome);
            notifs.save(notification(blaze.getUser(), NotificationType.RESULT,
                    "You won Match Day 3", "Motichoor took the Valorant series — see the leaderboard.", "/match"));
            notifs.save(notification(specter.getUser(), NotificationType.RESULT,
                    "Nightfall win CS2 MD2", "Nightfall top the CS2 lobby.", "/match"));
            notifs.save(notification(nova.getUser(), NotificationType.ANNOUNCEMENT,
                    "Registrations open", "Season 04 and free-for-all sign-ups are live.", "/announcements"));

            // ---- an open result dispute for the admin control room (raised by a Motichoor player) ----
            Dispute dispute = new Dispute();
            dispute.setMatch(completed);
            dispute.setRaisedBy(blaze.getUser());
            dispute.setReason("Motichoor dispute final-circle kill credit — scoreboard screenshot mismatch.");
            dispute.setCategory(DisputeCategory.RESULT);
            dispute.setStatus(DisputeStatus.OPEN);
            disputes.save(dispute);

            // ---- a match-less appeal dispute (account status) so the appeals flow has data ----
            Dispute appeal = new Dispute();
            appeal.setRaisedBy(rookie.getUser());
            appeal.setReason("Requesting review of my pending verification — I've completed every profile step.");
            appeal.setCategory(DisputeCategory.APPEAL);
            appeal.setStatus(DisputeStatus.OPEN);
            disputes.save(appeal);

            // ---- compute standings from seeded results ----
            scoring.recomputeStandings();

            log.info("Seed complete: {} users, {} franchises, {} games, {} matches.",
                    users.count(), franchises.count(), games.count(), matches.count());
        };
    }

    // ---- small builders ----

    private static Season season(String code, String name, SeasonStatus status,
                                 Instant startedAt, Instant endedAt) {
        Season s = new Season();
        s.setCode(code);
        s.setName(name);
        s.setStatus(status);
        s.setStartedAt(startedAt);
        s.setEndedAt(endedAt);
        return s;
    }

    private static SeasonStanding seasonStanding(String code, String franchiseId, String name,
                                                 String tag, int rank, int points) {
        SeasonStanding s = new SeasonStanding();
        s.setSeasonCode(code);
        s.setFranchiseId(franchiseId);
        s.setFranchiseName(name);
        s.setFranchiseTag(tag);
        s.setRank(rank);
        s.setPoints(points);
        return s;
    }

    private static Game game(String name, String format, GameType gameType, int popularity) {
        Game g = new Game();
        g.setName(name);
        g.setFormat(format);
        g.setGameType(gameType);
        g.setPopularity(popularity);
        g.setEnabled(true);
        // Per-game scoring config: kills weighted 1, the genre's default placement ladder, and a
        // standings weight of 1.00× (party/casual titles seeded a little lighter to show the concept).
        g.setPointsPerKill(1);
        g.setPlacementPoints(gameType.defaultPlacementPoints());
        g.setStandingsWeight(gameType == GameType.PARTY ? 75 : 100);
        return g;
    }

    private static User user(String name, String email, String phone, Role role, String pwHash) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPhone(phone);
        u.setRole(role);
        u.setPasswordHash(pwHash);
        u.setEmailVerified(true); // demo accounts are pre-verified so they can sign in immediately
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

    /**
     * Make {@code owner} the franchise owner and {@code manager} its manager (both roster members),
     * persist the franchise, and raise their user accounts to the matching franchise roles.
     */
    private static void assignOwnerManager(Franchise f, Player owner, Player manager,
                                           FranchiseRepository franchises, UserRepository users) {
        f.setOwnerPlayer(owner);
        f.setManagerPlayer(manager);
        franchises.save(f);
        owner.getUser().setRole(Role.FRANCHISE_OWNER);
        users.save(owner.getUser());
        manager.getUser().setRole(Role.FRANCHISE_MANAGER);
        users.save(manager.getUser());
    }

    /** A frozen player-franchise membership record for a finished season. */
    private static PlayerFranchiseHistory pfh(Player p, Franchise f, String seasonCode, String role) {
        PlayerFranchiseHistory h = new PlayerFranchiseHistory();
        h.setPlayerId(p.getId());
        h.setPlayerGamerTag(p.getGamerTag());
        h.setFranchiseId(f.getId());
        h.setFranchiseName(f.getName());
        h.setFranchiseTag(f.getTag());
        h.setSeasonCode(seasonCode);
        h.setRole(role);
        h.setRecordedAt(Instant.now());
        return h;
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
        // Seed private-by-default contact fields so the per-field privacy matrix is testable out of the box.
        p.setRealName(name + " (real name)");
        p.setContactEmail(email);
        p.setPhone("+91 90000 0" + String.format("%04d", Math.abs(name.hashCode()) % 10000));
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
        // Non-placement genres (tactical/sports/fighting) are scored by score alone — no ladder.
        if (game != null && game.getGameType() != null && !game.getGameType().usesPlacement()) {
            m.setPlacementPoints("");
        }
        return m;
    }

    private static MatchParticipant participant(Match m, Franchise f) {
        MatchParticipant mp = new MatchParticipant();
        mp.setMatch(m);
        mp.setFranchise(f);
        return mp;
    }

    private static MatchLineup lineup(Match m, Franchise f, Player p) {
        MatchLineup ml = new MatchLineup();
        ml.setMatch(m);
        ml.setFranchise(f);
        ml.setPlayer(p);
        return ml;
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

    private static MatchRound round(Match m, int number, String map, String mode) {
        MatchRound r = new MatchRound();
        r.setMatch(m);
        r.setRoundNumber(number);
        r.setMapName(map);
        r.setMode(mode);
        return r;
    }

    private static MatchRoundResult roundResult(MatchRound round, Franchise f, int rank, int kills,
                                                int survivalSeconds, int placePts) {
        MatchRoundResult rr = new MatchRoundResult();
        rr.setMatchRound(round);
        rr.setFranchise(f);
        rr.setRank(rank);
        rr.setKills(kills);
        rr.setSurvivalSeconds(survivalSeconds);
        rr.setPlacePts(placePts);
        return rr;
    }

    private static MatchRoundPlayerResult playerResult(MatchRound round, Franchise f, Player p,
                                                       int kills, int survivalSeconds) {
        MatchRoundPlayerResult pr = new MatchRoundPlayerResult();
        pr.setMatchRound(round);
        pr.setFranchise(f);
        pr.setPlayer(p);
        pr.setKills(kills);
        pr.setSurvivalSeconds(survivalSeconds);
        return pr;
    }

    private static TeamInvite teamInvite(Registration registration, Player invited, Player captain,
                                         InviteStatus status) {
        TeamInvite t = new TeamInvite();
        t.setRegistration(registration);
        t.setInvitedPlayer(invited);
        t.setInvitedBy(captain);
        t.setStatus(status);
        return t;
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

    private static Notification notification(User user, NotificationType type, String title,
                                             String body, String linkUrl) {
        Notification n = new Notification();
        n.setUser(user);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLinkUrl(linkUrl);
        return n;
    }

    /** An ACTIVE AUCTION-type registration for a free agent entering the auction pool. */
    private static Registration auctionRegistration(Player player, Game game, List<String> games,
                                                    String contact, String note) {
        Registration r = new Registration();
        r.setType(RegistrationType.AUCTION);
        r.setPlayer(player);
        r.setGames(new ArrayList<>(games));
        r.setContact(contact);
        r.setGame(game);
        r.setReason(note);
        r.setStatus(RegistrationStatus.ACTIVE);
        return r;
    }

    private static Auction auction(String title, String seasonId, User createdBy, long basePrice,
                                   int bidTimerSeconds, int antiSnipeSeconds, String raiseIncrements,
                                   long defaultBudget) {
        Auction a = new Auction();
        a.setTitle(title);
        a.setSeasonId(seasonId);
        a.setStatus(AuctionStatus.DRAFT);
        a.setBasePrice(basePrice);
        a.setBidTimerSeconds(bidTimerSeconds);
        a.setAntiSnipeSeconds(antiSnipeSeconds);
        a.setRaiseIncrements(raiseIncrements);
        a.setDefaultBudget(defaultBudget);
        a.setCreatedBy(createdBy);
        return a;
    }

    /** A participating franchise's purse: {@code balance} starts equal to {@code budget}. */
    private static AuctionFranchise auctionFranchise(Auction auction, Franchise franchise, long budget) {
        AuctionFranchise af = new AuctionFranchise();
        af.setAuction(auction);
        af.setFranchise(franchise);
        af.setBudget(budget);
        af.setBalance(budget);
        return af;
    }

    private static AuctionLot auctionLot(Auction auction, Player player, int lotOrder) {
        AuctionLot lot = new AuctionLot();
        lot.setAuction(auction);
        lot.setPlayer(player);
        lot.setStatus(AuctionLotStatus.QUEUED);
        lot.setCurrentBid(0);
        lot.setLotOrder(lotOrder);
        return lot;
    }
}
