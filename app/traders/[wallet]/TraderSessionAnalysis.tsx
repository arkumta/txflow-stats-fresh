
"use client";

import { useEffect, useState } from "react";

type Session = {
  session: string;
  start_hour_utc: number;
  end_hour_utc: number;
  trade_count: number;
  trading_volume: number;
  gross_realized_pnl: number;
  realized_pnl_fill_count: number;
  fees: number;
  fee_fill_count: number;
};

type SessionResponse = {
  success: boolean;
  error?: string;
  total_fills_analyzed: number;
  partial_data: boolean;
  valid_time_fills: number;
  session_analysis: {
    timezone: string;
    windows_overlap: boolean;
    busiest_session: string | null;
    sessions: Session[];
  };
};

type Props = {
  wallet: string;
};

const COLORS: Record<string, string> = {
  Asian: "#8ba8ff",
  European: "#b8f34a",
  US: "#c49aff",
};

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function TraderSessionAnalysis({ wallet }: Props) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/trader-behavior?wallet=${encodeURIComponent(wallet)}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load session analysis."
          );
        }

        if (!cancelled) {
          setData(result as SessionResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load session analysis."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (wallet) load();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (loading) {
    return <div className="session-state">Loading trading sessions…</div>;
  }

  if (error) {
    return <div className="session-state session-error">{error}</div>;
  }

  const sessions = data?.session_analysis?.sessions ?? [];

  if (!sessions.length) {
    return (
      <div className="session-state">
        No session activity is available for this wallet.
      </div>
    );
  }

  const maxVolume = Math.max(
    ...sessions.map((session) => session.trading_volume),
    1
  );

  const busiestSession = data?.session_analysis?.busiest_session;

  return (
    <div className="session-analysis">
      <div className="session-intro">
        <div>
          <span className="session-label">ACTIVITY BY UTC SESSION</span>
          <h3>When does this trader trade?</h3>
          <p>
            Trading activity grouped by approximate Asian, European and US
            market hours.
          </p>
        </div>

        {busiestSession && (
          <div className="busiest-badge">
            <span>Most active</span>
            <strong>{busiestSession}</strong>
          </div>
        )}
      </div>

      <div className="session-grid">
        {sessions.map((session) => {
          const color = COLORS[session.session] || "#b8f34a";

          return (
            <article className="session-card" key={session.session}>
              <div className="session-card-top">
                <span
                  className="session-dot"
                  style={{ background: color }}
                />
                <span className="session-name">{session.session}</span>
              </div>

              <div className="session-hours">
                {formatHour(session.start_hour_utc)} –{" "}
                {formatHour(session.end_hour_utc)} UTC
              </div>

              <div className="session-trades">
                {session.trade_count.toLocaleString("en-US")}
              </div>
              <div className="session-caption">Recorded fills</div>

              <div className="session-divider" />

              <div className="session-metric">
                <span>Trading volume</span>
                <strong>{formatUSD(session.trading_volume)}</strong>
              </div>

              <div className="session-metric">
                <span>Gross realized PnL</span>
                <strong
                  className={
                    session.gross_realized_pnl >= 0
                      ? "session-positive"
                      : "session-negative"
                  }
                >
                  {formatUSD(session.gross_realized_pnl)}
                </strong>
              </div>

              <div className="session-metric">
                <span>Recorded fees</span>
                <strong>{formatUSD(session.fees)}</strong>
              </div>

              <div className="session-footnote">
                PnL: {session.realized_pnl_fill_count.toLocaleString("en-US")}{" "}
                fills · Fees: {session.fee_fill_count.toLocaleString("en-US")}{" "}
                fills
              </div>
            </article>
          );
        })}
      </div>

      <div className="session-chart-card">
        <div className="session-chart-heading">
          <div>
            <h4>Volume by session</h4>
            <p>Calculated from recorded price × size</p>
          </div>
        </div>

        <div className="session-bars">
          {sessions.map((session) => {
            const percentage = Math.max(
              (session.trading_volume / maxVolume) * 100,
              session.trading_volume > 0 ? 1 : 0
            );

            return (
              <div className="session-bar-row" key={session.session}>
                <span className="session-bar-label">{session.session}</span>

                <div className="session-bar-track">
                  <div
                    className="session-bar-fill"
                    style={{
                      width: `${percentage}%`,
                      background: COLORS[session.session] || "#b8f34a",
                    }}
                  />
                </div>

                <strong>{formatUSD(session.trading_volume)}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className="session-notice">
        <strong>How to read this analysis</strong>
        <p>
          All times are UTC. The session windows overlap: Asian 00:00–08:00,
          European 07:00–16:00 and US 13:00–22:00. Fills during overlapping
          hours are counted in each applicable session, so session totals are
          not additive.
        </p>
        <p>
          Gross realized PnL is the sum of recorded closed PnL values. Fees are
          displayed separately and are not subtracted from PnL. This is not
          an audited net-profit calculation.
        </p>
        {data?.partial_data && (
          <p className="session-warning">
            This analysis is based on the first{" "}
            {data.total_fills_analyzed.toLocaleString("en-US")} fills because
            the API row limit was reached. Results may be incomplete.
          </p>
        )}
        {data && data.valid_time_fills < data.total_fills_analyzed && (
          <p>
            {(
              data.total_fills_analyzed - data.valid_time_fills
            ).toLocaleString("en-US")}{" "}
            fills did not have a valid timestamp and were excluded from
            session analysis.
          </p>
        )}
      </div>

      <style jsx>{`
        .session-analysis {
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #f3f7f1;
        }

        .session-intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
        }

        .session-label {
          color: #b8f34a;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .session-intro h3 {
          margin: 8px 0 6px;
          font-size: 19px;
        }

        .session-intro p,
        .session-chart-heading p {
          margin: 0;
          color: #8e9a8c;
          font-size: 12px;
          line-height: 1.6;
        }

        .busiest-badge {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 0 0 auto;
          padding: 10px 13px;
          border: 1px solid rgba(184, 243, 74, 0.25);
          border-radius: 9px;
          background: rgba(184, 243, 74, 0.07);
        }

        .busiest-badge span {
          color: #8e9a8c;
          font-size: 9px;
        }

        .busiest-badge strong {
          color: #b8f34a;
          font-size: 13px;
        }

        .session-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .session-card {
          min-width: 0;
          padding: 17px;
          border: 1px solid #252d25;
          border-radius: 11px;
          background: #0c100c;
        }

        .session-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .session-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .session-name {
          font-size: 13px;
          font-weight: 750;
        }

        .session-hours {
          margin-top: 7px;
          color: #657063;
          font-size: 10px;
        }

        .session-trades {
          margin-top: 19px;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .session-caption {
          margin-top: 3px;
          color: #8e9a8c;
          font-size: 10px;
        }

        .session-divider {
          height: 1px;
          margin: 15px 0;
          background: #252d25;
        }

        .session-metric {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 12px;
        }

        .session-metric span {
          color: #8e9a8c;
          font-size: 10px;
        }

        .session-metric strong {
          font-size: 13px;
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;
        }

        .session-positive {
          color: #b8f34a;
        }

        .session-negative {
          color: #ff7777;
        }

        .session-footnote {
          margin-top: 15px;
          color: #657063;
          font-size: 9px;
          line-height: 1.6;
        }

        .session-chart-card {
          padding: 19px;
          border: 1px solid #252d25;
          border-radius: 11px;
          background: #0c100c;
        }

        .session-chart-heading h4 {
          margin: 0 0 5px;
          font-size: 13px;
        }

        .session-bars {
          display: flex;
          flex-direction: column;
          gap: 17px;
          margin-top: 22px;
        }

        .session-bar-row {
          display: grid;
          grid-template-columns: 78px minmax(40px, 1fr) 105px;
          align-items: center;
          gap: 12px;
        }

        .session-bar-label {
          color: #cbd4c7;
          font-size: 11px;
        }

        .session-bar-track {
          height: 9px;
          overflow: hidden;
          border-radius: 99px;
          background: #202720;
        }

        .session-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.3s ease;
        }

        .session-bar-row strong {
          color: #e7eee3;
          font-size: 11px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .session-notice {
          padding: 14px 16px;
          border: 1px solid #252d25;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.015);
        }

        .session-notice strong {
          color: #b8f34a;
          font-size: 11px;
        }

        .session-notice p {
          margin: 7px 0 0;
          color: #8e9a8c;
          font-size: 10px;
          line-height: 1.7;
        }

        .session-notice .session-warning {
          color: #ffc477;
        }

        .session-state {
          padding: 25px 18px;
          color: #8e9a8c;
          font-size: 12px;
        }

        .session-error {
          color: #ff7777;
        }

        @media (max-width: 850px) {
          .session-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .session-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .session-bar-row {
            grid-template-columns: 65px minmax(30px, 1fr) 85px;
            gap: 8px;
          }

          .session-bar-row strong {
            font-size: 10px;
          }

          .session-chart-card {
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}
