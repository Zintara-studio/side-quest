import { Hero } from "@/components/landing/hero";
import { GamesStrip } from "@/components/landing/games-strip";
import { FeaturedTournaments } from "@/components/landing/featured-tournaments";
import { LiveMatches } from "@/components/landing/live-matches";
import { TopPlayers } from "@/components/landing/top-players";
import { FranchiseRankings } from "@/components/landing/franchise-rankings";
import { AuctionBanner } from "@/components/landing/auction-banner";
import { StatsCounters } from "@/components/landing/stats-counters";
import { Sponsors } from "@/components/landing/sponsors";
import { CTA } from "@/components/landing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Sponsors />
      <StatsCounters />
      <GamesStrip />
      <FeaturedTournaments />
      <AuctionBanner />
      <LiveMatches />
      <TopPlayers />
      <FranchiseRankings />
      <CTA />
    </>
  );
}
