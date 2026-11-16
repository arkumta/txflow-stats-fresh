
import Link from "next/link";
import PnlLeaderboard from "../components/PnlLeaderboard";

export default function LeaderboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#fff",
        padding: "32px 20px 60px",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "#a3e635",
            textDecoration: "none",
            fontSize: "13px",
          }}
        >
          ← Back to Dashboard
        </Link>

        <header style={{ marginTop: "28px", marginBottom: "24px" }}>
          <p
            style={{
              color: "#a3e635",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            TXFLOW STATS
          </p>

          <h1
            style={{
              fontSize: "36px",
              fontWeight: 700,
              margin: "8px 0",
            }}
          >
            Trader Leaderboard
          </h1>

          <p
            style={{
              color: "#888",
              fontSize: "14px",
              maxWidth: "650px",
              lineHeight: 1.6,
            }}
          >
            Explore trader rankings based on recorded realized PnL,
            trading fees and activity.
          </p>
        </header>

        <PnlLeaderboard />
      </div>
    </main>
  );
}
