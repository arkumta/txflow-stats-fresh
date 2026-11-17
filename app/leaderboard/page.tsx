
import Link from "next/link";
import PnlLeaderboard from "../components/PnlLeaderboard";

export default function LeaderboardPage() {
  return (
    <main className="leaderboard-page">
      <div className="leaderboard-shell">
        <Link
          href="/"
          className="leaderboard-back-link"
        >
          ← Back to Dashboard
        </Link>

        <header className="leaderboard-header">
          <p className="leaderboard-eyebrow">
            TXFLOW STATS
          </p>

          <h1>
            Trader Leaderboard
          </h1>

          <p className="leaderboard-description">
            Explore trader rankings based on recorded realized PnL,
            trading fees and activity.
          </p>
        </header>

        <PnlLeaderboard />
      </div>
    </main>
  );
}
