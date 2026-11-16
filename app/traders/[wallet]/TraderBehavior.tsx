
"use client";

import { useEffect, useState } from "react";

type ActivityBucket = {
  hour?: number;
  day?: string;
  trade_count: number;
  trading_volume: number;
};

type Market = {
  market: string;
  trade_count: number;
  trading_volume: number;
};

type Side = {
  side: string;
  trade_count: number;
};

type BehaviorData = {
  success: boolean;
  total_fills_analyzed: number;
  partial_data: boolean;
  valid_time_fills: number;
  summary: {
    total_volume: number;
    total_size: number;
    average_size: number;
    average_trade_volume: number;
    largest_size: number;
    largest_trade_volume: number;
    busiest_hour: ActivityBucket;
    busiest_day: ActivityBucket;
  };
  hourly_activity: ActivityBucket[];
  weekday_activity: ActivityBucket[];
  market_breakdown: Market[];
  side_breakdown: Side[];
  error?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(value || 0);
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function TraderBehavior({
  wallet,
}: {
  wallet: string;
}) {
  const [data, setData] = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBehavior() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/trader-behavior?wallet=${encodeURIComponent(wallet)}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load trading behavior.");
        }

        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load trading behavior."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (wallet) loadBehavior();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (loading) {
    return (
      <div className="behavior-state">
        <span className="loading-dot" />
        Loading trading behavior…
        <style jsx>{`
          .behavior-state {
            padding: 30px 12px;
            text-align: center;
            color: #8e9a8c;
            font-size: 12px;
          }
          .loading-dot {
            display: inline-block;
            width: 7px;
            height: 7px;
            margin-right: 9px;
            border-radius: 50%;
            background: #b8f34a;
            animation: pulse 1s infinite alternate;
          }
          @keyframes pulse {
            to { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="behavior-state error">
        {error || "No trading behavior data available."}
        <style jsx>{`
          .behavior-state {
            padding: 30px 12px;
            text-align: center;
            font-size: 12px;
          }
          .error { color: #ff7777; }
        `}</style>
      </div>
    );
  }

  const summary = data.summary;
  const maxHourCount = Math.max(
    1,
    ...data.hourly_activity.map((item) => item.trade_count)
  );

  const maxDayCount = Math.max(
    1,
    ...data.weekday_activity.map((item) => item.trade_count)
  );

  const maxMarketVolume = Math.max(
    1,
    ...data.market_breakdown.map((item) => item.trading_volume)
  );

  return (
    <section className="behavior">
      <div className="behavior-heading">
        <div>
          <div className="eyebrow">TRADING BEHAVIOR</div>
          <h2>Trading Behavior Analysis</h2>
          <p>Trade size, activity patterns and market preferences</p>
        </div>
        <span className="count-badge">
          {data.total_fills_analyzed.toLocaleString("en-US")} FILLS
        </span>
      </div>

      {data.partial_data && (
        <div className="partial-notice">
          Analysis is based on the first{" "}
          {data.total_fills_analyzed.toLocaleString("en-US")} fills.
          More historical fills exist, so results may be incomplete.
        </div>
      )}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Total trading volume</span>
          <strong>{money(summary.total_volume)}</strong>
        </article>

        <article className="stat-card">
          <span>Average trade size</span>
          <strong>{number(summary.average_size)}</strong>
        </article>

        <article className="stat-card">
          <span>Largest trade size</span>
          <strong>{number(summary.largest_size)}</strong>
        </article>

        <article className="stat-card">
          <span>Average trade value</span>
          <strong>{money(summary.average_trade_volume)}</strong>
        </article>

        <article className="stat-card">
          <span>Largest trade value</span>
          <strong>{money(summary.largest_trade_volume)}</strong>
        </article>
      </div>

      <div className="insight-grid">
        <article className="insight-card">
          <span>Busiest hour (UTC)</span>
          <strong>
            {summary.busiest_hour
              ? hourLabel(summary.busiest_hour.hour ?? 0)
              : "—"}
          </strong>
          <small>
            {summary.busiest_hour?.trade_count ?? 0} fills recorded
          </small>
        </article>

        <article className="insight-card">
          <span>Busiest weekday (UTC)</span>
          <strong>{summary.busiest_day?.day || "—"}</strong>
          <small>
            {summary.busiest_day?.trade_count ?? 0} fills recorded
          </small>
        </article>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Trading activity by hour</h3>
            <p>Number of fills recorded in each UTC hour</p>
          </div>
        </div>

        <div className="hour-chart">
          {data.hourly_activity.map((item) => (
            <div className="hour-column" key={item.hour}>
              <div className="hour-value">
                {item.trade_count > 0 ? item.trade_count : ""}
              </div>
              <div className="hour-bar-area">
                <div
                  className="hour-bar"
                  style={{
                    height: `${(item.trade_count / maxHourCount) * 100}%`,
                  }}
                  title={`${hourLabel(item.hour ?? 0)} UTC: ${item.trade_count} fills`}
                />
              </div>
              <span className="hour-label">
                {(item.hour ?? 0) % 4 === 0
                  ? String(item.hour).padStart(2, "0")
                  : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="chart-axis-note">Time of day (UTC)</div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Trading activity by weekday</h3>
            <p>How frequently this trader trades on each weekday</p>
          </div>
        </div>

        <div className="weekday-list">
          {data.weekday_activity.map((item) => (
            <div className="weekday-row" key={item.day}>
              <span className="weekday-name">{item.day}</span>
              <div className="weekday-track">
                <div
                  className="weekday-bar"
                  style={{
                    width: `${(item.trade_count / maxDayCount) * 100}%`,
                  }}
                />
              </div>
              <strong>{item.trade_count}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Trading volume by market</h3>
            <p>Markets ranked by calculated price × size volume</p>
          </div>
        </div>

        {data.market_breakdown.length === 0 ? (
          <p className="empty">No market data available.</p>
        ) : (
          <div className="market-list">
            {data.market_breakdown.map((market) => (
              <div className="market-row" key={market.market}>
                <div className="market-row-top">
                  <strong>{market.market}</strong>
                  <span>{money(market.trading_volume)}</span>
                </div>
                <div className="market-track">
                  <div
                    className="market-bar"
                    style={{
                      width: `${
                        (market.trading_volume / maxMarketVolume) * 100
                      }%`,
                    }}
                  />
                </div>
                <small>
                  {market.trade_count.toLocaleString("en-US")} fills
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Recorded side values</h3>
            <p>
              Raw values from the exchange data; not interpreted as long or
              short positions
            </p>
          </div>
        </div>

        <div className="side-list">
          {data.side_breakdown.map((item) => (
            <div className="side-row" key={item.side}>
              <span>{item.side}</span>
              <strong>{item.trade_count.toLocaleString("en-US")}</strong>
            </div>
          ))}
        </div>
      </div>

      <p className="disclaimer">
        Trade size is the absolute recorded fill size. Trade value is
        calculated as absolute price × size. Activity hours and weekdays use
        UTC. This analysis counts individual fills, not completed positions.
        Side values are displayed exactly as stored and are not classified
        as long or short.
      </p>

      <style jsx>{`
        .behavior {
          display: flex;
          flex-direction: column;
          gap: 17px;
          color: #f3f7f1;
        }

        .behavior-heading,
        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #b8f34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .behavior-heading h2 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.6px;
        }

        .behavior-heading p,
        .panel-heading p {
          margin: 6px 0 0;
          color: #8e9a8c;
          font-size: 12px;
          line-height: 1.5;
        }

        .count-badge {
          flex: 0 0 auto;
          padding: 7px 10px;
          border: 1px solid rgba(184,243,74,.2);
          border-radius: 20px;
          background: rgba(184,243,74,.09);
          color: #b8f34a;
          font-size: 10px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 11px;
        }

        .stat-card,
        .insight-card,
        .panel {
          min-width: 0;
          border: 1px solid #252d25;
          border-radius: 13px;
          background: #101410;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 15px;
        }

        .stat-card span,
        .insight-card span {
          color: #8e9a8c;
          font-size: 10px;
        }

        .stat-card strong {
          color: #b8f34a;
          font-size: clamp(16px, 2vw, 21px);
          overflow-wrap: anywhere;
        }

        .insight-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .insight-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
        }

        .insight-card strong {
          font-size: 20px;
        }

        .insight-card small {
          color: #8e9a8c;
          font-size: 11px;
        }

        .panel {
          padding: 18px;
        }

        .panel-heading h3 {
          margin: 0;
          font-size: 14px;
        }

        .hour-chart {
          display: grid;
          grid-template-columns: repeat(24, minmax(0, 1fr));
          gap: 5px;
          height: 175px;
          margin-top: 22px;
        }

        .hour-column {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
        }

        .hour-value {
          height: 17px;
          color: #8e9a8c;
          font-size: 8px;
        }

        .hour-bar-area {
          display: flex;
          flex: 1;
          width: 100%;
          align-items: flex-end;
          overflow: hidden;
          border-radius: 4px 4px 0 0;
          background: #1c241c;
        }

        .hour-bar {
          width: 100%;
          min-height: 0;
          border-radius: 4px 4px 0 0;
          background: #b8f34a;
        }

        .hour-label {
          height: 16px;
          margin-top: 5px;
          color: #657063;
          font-size: 8px;
        }

        .chart-axis-note {
          margin-top: 7px;
          color: #657063;
          font-size: 9px;
          text-align: center;
        }

        .weekday-list,
        .market-list,
        .side-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-top: 20px;
        }

        .weekday-row {
          display: grid;
          grid-template-columns: 85px minmax(0, 1fr) 35px;
          align-items: center;
          gap: 12px;
        }

        .weekday-name {
          color: #d8dfd5;
          font-size: 11px;
        }

        .weekday-track,
        .market-track {
          height: 8px;
          overflow: hidden;
          border-radius: 20px;
          background: #252d25;
        }

        .weekday-bar,
        .market-bar {
          height: 100%;
          border-radius: 20px;
          background: #b8f34a;
        }

        .weekday-row strong {
          color: #b8f34a;
          font-size: 11px;
          text-align: right;
        }

        .market-row {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .market-row-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 11px;
        }

        .market-row-top span {
          color: #b8f34a;
          font-weight: 700;
        }

        .market-row small {
          color: #657063;
          font-size: 10px;
        }

        .side-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #252d25;
          color: #d8dfd5;
          font-size: 12px;
        }

        .side-row:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }

        .side-row strong {
          color: #b8f34a;
        }

        .empty {
          margin-top: 18px;
          color: #8e9a8c;
          font-size: 12px;
        }

        .partial-notice {
          padding: 11px 13px;
          border: 1px solid rgba(255,190,80,.3);
          border-radius: 9px;
          background: rgba(255,190,80,.07);
          color: #e7c58d;
          font-size: 11px;
          line-height: 1.5;
        }

        .disclaimer {
          margin: 0;
          color: #657063;
          font-size: 10px;
          line-height: 1.6;
        }

        @media (max-width: 1000px) {
          .stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .insight-grid {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 13px;
          }

          .hour-chart {
            gap: 3px;
          }

          .weekday-row {
            grid-template-columns: 72px minmax(0, 1fr) 28px;
            gap: 8px;
          }
        }

        @media (max-width: 400px) {
          .behavior-heading h2 {
            font-size: 19px;
          }

          .count-badge {
            font-size: 8px;
            padding: 6px 7px;
          }

          .stat-card {
            padding: 12px;
          }
        }
      `}</style>
    </section>
  );
}
