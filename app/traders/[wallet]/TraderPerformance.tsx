
"use client";

import { useEffect, useMemo, useState } from "react";

type DailyPerformance = {
  trade_date: string;
  trade_count: number;
  realized_pnl: number;
  trading_volume: number;
};

type PerformanceSummary = {
  total_pnl: number;
  winning_days: number;
  losing_days: number;
  breakeven_days: number;
  win_rate: number;
  average_daily_pnl: number;
  best_day: DailyPerformance | null;
  worst_day: DailyPerformance | null;
  total_active_days: number;
};

type PerformanceResponse = {
  success: boolean;
  summary: PerformanceSummary;
  daily_performance: DailyPerformance[];
  error?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function shortDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function TraderPerformance({
  wallet,
}: {
  wallet: string;
}) {
  const [performance, setPerformance] =
    useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPerformance() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/trader-performance?wallet=${encodeURIComponent(wallet)}&days=365`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Unable to load performance data."
          );
        }

        if (!cancelled) {
          setPerformance(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load performance data."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (wallet) loadPerformance();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const dailyData = performance?.daily_performance || [];
  const summary = performance?.summary;

  const riskMetrics = useMemo(() => {
  if (!dailyData.length) return null;

  const sortedDays = [...dailyData].sort((a, b) =>
    a.trade_date.localeCompare(b.trade_date)
  );

  const wins = sortedDays.filter(day => day.realized_pnl > 0);
  const losses = sortedDays.filter(day => day.realized_pnl < 0);

  const grossProfit = wins.reduce(
    (sum, day) => sum + Number(day.realized_pnl || 0), 0
  );

  const grossLoss = Math.abs(
    losses.reduce(
      (sum, day) => sum + Number(day.realized_pnl || 0), 0
    )
  );

  const averageWinningDay =
    wins.length ? grossProfit / wins.length : 0;

  const averageLosingDay =
    losses.length ? grossLoss / losses.length : 0;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0 ? Infinity : 0;

  const riskReward =
    averageLosingDay > 0
      ? averageWinningDay / averageLosingDay
      : averageWinningDay > 0 ? Infinity : 0;

  let runningPnl = 0;
  let peakPnl = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const day of sortedDays) {
    runningPnl += Number(day.realized_pnl) || 0;
    peakPnl = Math.max(peakPnl, runningPnl);

    const drawdown = peakPnl - runningPnl;

    maxDrawdown = Math.max(maxDrawdown, drawdown);

    if (peakPnl > 0) {
      maxDrawdownPercent = Math.max(
        maxDrawdownPercent,
        (drawdown / peakPnl) * 100
      );
    }
  }

  const largestWinningDay = wins.length
    ? wins.reduce((best, day) =>
        day.realized_pnl > best.realized_pnl ? day : best
      )
    : null;

  const largestLosingDay = losses.length
    ? losses.reduce((worst, day) =>
        day.realized_pnl < worst.realized_pnl ? day : worst
      )
    : null;

  return {
    grossProfit,
    grossLoss,
    profitFactor,
    averageWinningDay,
    averageLosingDay,
    riskReward,
    maxDrawdown,
    maxDrawdownPercent,
    largestWinningDay,
    largestLosingDay,
  };
}, [dailyData]);

const consistencyScore = useMemo(() => {
  if (!dailyData.length || !summary) return null;

  const winningDays = dailyData.filter(
    (day) => day.realized_pnl > 0
  );

  const losingDays = dailyData.filter(
    (day) => day.realized_pnl < 0
  );

  // 1. Profitable days: maximum 40 points
  const winRateScore = Math.min(
    40,
    Math.max(0, summary.win_rate) * 0.4
  );

  // 2. Daily PnL smoothness: maximum 25 points
  const pnlValues = dailyData.map(
    (day) => Number(day.realized_pnl) || 0
  );

  const averageAbsolutePnl =
    pnlValues.reduce((sum, value) => sum + Math.abs(value), 0) /
    pnlValues.length;

  const averagePnl =
    pnlValues.reduce((sum, value) => sum + value, 0) /
    pnlValues.length;

  const variance =
    pnlValues.reduce(
      (sum, value) => sum + Math.pow(value - averagePnl, 2),
      0
    ) / pnlValues.length;

  const standardDeviation = Math.sqrt(variance);

  const smoothness =
    standardDeviation + averageAbsolutePnl > 0
      ? averageAbsolutePnl /
        (standardDeviation + averageAbsolutePnl)
      : 0;

  const smoothnessScore = smoothness * 25;

  // 3. Profit concentration: maximum 25 points
  const totalWinningPnl = winningDays.reduce(
    (sum, day) => sum + day.realized_pnl,
    0
  );

  const largestWinningDay = Math.max(
    0,
    ...winningDays.map((day) => day.realized_pnl)
  );

  const profitConcentration =
    totalWinningPnl > 0
      ? largestWinningDay / totalWinningPnl
      : 1;

  const concentrationScore =
    25 * (1 - Math.min(1, profitConcentration));

  // 4. Monthly activity: maximum 10 points
  const activeMonths = new Set(
    dailyData.map((day) => day.trade_date.slice(0, 7))
  ).size;

  const activityScore = Math.min(10, (activeMonths / 12) * 10);

  const total = Math.round(
    winRateScore +
    smoothnessScore +
    concentrationScore +
    activityScore
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    winRateScore,
    smoothnessScore,
    concentrationScore,
    activityScore,
    activeMonths,
    winningDays: winningDays.length,
    losingDays: losingDays.length,
    profitConcentration: profitConcentration * 100,
  };
}, [dailyData, summary]);
  const chartData = useMemo(() => {
    const maxValue = Math.max(
      0.01,
      ...dailyData.map((day) => Math.abs(day.realized_pnl))
    );

    return dailyData.map((day) => ({
      ...day,
      height: Math.max(
        3,
        (Math.abs(day.realized_pnl) / maxValue) * 100
      ),
    }));
  }, [dailyData]);


const cumulativeData = useMemo(() => {
  let runningTotal = 0;

  return [...dailyData]
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
    .map((day) => {
      runningTotal += Number(day.realized_pnl) || 0;

      return {
        trade_date: day.trade_date,
        cumulative_pnl: runningTotal,
      };
    });
}, [dailyData]);

const cumulativeChart = useMemo(() => {
  if (cumulativeData.length === 0) return null;

  const values = cumulativeData.map((day) => day.cumulative_pnl);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;

  const points = cumulativeData.map((day, index) => {
    const x =
      cumulativeData.length === 1
        ? 500
        : 30 + (index / (cumulativeData.length - 1)) * 940;

    const y = 20 + ((maxValue - day.cumulative_pnl) / range) * 180;

    return `${x},${y}`;
  });

  const zeroY = 20 + (maxValue / range) * 180;

  return {
    points: points.join(" "),
    zeroY,
    firstDate: cumulativeData[0].trade_date,
    lastDate: cumulativeData[cumulativeData.length - 1].trade_date,
    latestPnl: values[values.length - 1],
  };
}, [cumulativeData]);

  if (loading) {
    return (
      <div className="performance-state">
        <span className="loading-dot" />
        Loading performance breakdown…
        <style jsx>{`
          .performance-state {
            padding: 35px 15px;
            color: #8e9a8c;
            text-align: center;
            font-size: 13px;
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

  if (error || !performance || !summary) {
    return (
      <div className="performance-state">
        {error || "No performance data available."}
        <style jsx>{`
          .performance-state {
            padding: 35px 15px;
            color: #ff7777;
            text-align: center;
            font-size: 13px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <section className="performance">
      <div className="performance-heading">
        <div>
          <div className="eyebrow">TRADER ANALYTICS</div>
          <h2>Win / Loss Performance</h2>
          <p>Realized daily PnL over the last 365 days</p>
        </div>
        <span className="period">365 DAYS</span>
      </div>

      <div className="summary-grid">
        <article className="summary-card featured">
          <span>Total realized PnL</span>
          <strong className={summary.total_pnl >= 0 ? "positive" : "negative"}>
            {summary.total_pnl > 0 ? "+" : ""}
            {money(summary.total_pnl)}
          </strong>
          <small>Combined daily realized PnL</small>
        </article>

        <article className="summary-card">
          <span>Win rate</span>
          <strong>{summary.win_rate.toFixed(2)}%</strong>
          <small>Winning days excluding breakeven</small>
        </article>

        <article className="summary-card">
          <span>Winning days</span>
          <strong className="positive">{summary.winning_days}</strong>
          <small>Profitable trading days</small>
        </article>

        <article className="summary-card">
          <span>Losing days</span>
          <strong className="negative">{summary.losing_days}</strong>
          <small>Unprofitable trading days</small>
        </article>
      </div>
{consistencyScore && (
  <div className="consistency-panel">
    <div className="consistency-heading">
      <div>
        <div className="eyebrow">TRADER RATING</div>
        <h3>Trader Consistency Score</h3>
        <p>
          A 365-day assessment of profitability and trading consistency
        </p>
      </div>

      <div className="consistency-score">
        <strong>{consistencyScore.total}</strong>
        <span>/100</span>
      </div>
    </div>

    <div className="consistency-progress">
      <div
        className="consistency-progress-fill"
        style={{ width: `${consistencyScore.total}%` }}
      />
    </div>

    <div className="consistency-breakdown">
      {[
        {
          label: "Profitable days",
          score: consistencyScore.winRateScore,
          max: 40,
        },
        {
          label: "Daily PnL smoothness",
          score: consistencyScore.smoothnessScore,
          max: 25,
        },
        {
          label: "Profit distribution",
          score: consistencyScore.concentrationScore,
          max: 25,
        },
        {
          label: "Monthly activity",
          score: consistencyScore.activityScore,
          max: 10,
        },
      ].map((item) => (
        <div className="consistency-metric" key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>
              {item.score.toFixed(1)} / {item.max}
            </strong>
          </div>
          <div className="metric-track">
            <div
              className="metric-fill"
              style={{ width: `${(item.score / item.max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>

    <div className="consistency-insights">
      <div>
        <span>Profitable days</span>
        <strong>{consistencyScore.winningDays}</strong>
      </div>
      <div>
        <span>Active months</span>
        <strong>{consistencyScore.activeMonths}/12</strong>
      </div>
      <div>
        <span>Largest day share of profits</span>
        <strong>
          {consistencyScore.profitConcentration.toFixed(1)}%
        </strong>
      </div>
    </div>

    <p className="consistency-disclaimer">
      This is an experimental score based on recorded daily realized PnL.
      It is not a measure of risk-adjusted returns or future trading ability.
    </p>
  </div>
)}
      <div className="win-loss-panel">
        <div className="panel-heading">
          <div>
            <h3>Daily PnL distribution</h3>
            <p>Each bar represents one active trading day</p>
          </div>
          <div className="legend">
            <span><i className="green" /> Profit</span>
            <span><i className="red" /> Loss</span>
          </div>
        </div>

<div className="cumulative-panel">
  <div className="panel-heading">
    <div>
      <h3>Cumulative PnL</h3>
      <p>Running total of realized profit and loss over time</p>
    </div>
    <span className="cumulative-period">365 DAYS</span>
  </div>

  {cumulativeChart ? (
    <>
      <div className="cumulative-total">
        <span>Current cumulative PnL</span>
        <strong
          className={
            cumulativeChart.latestPnl >= 0
              ? "positive"
              : "negative"
          }
        >
          {cumulativeChart.latestPnl > 0 ? "+" : ""}
          {money(cumulativeChart.latestPnl)}
        </strong>
      </div>

      <div className="cumulative-chart">
        <svg
          viewBox="0 0 1000 230"
          preserveAspectRatio="none"
          role="img"
          aria-label="Cumulative realized PnL chart"
        >
          <line
            x1="30"
            x2="970"
            y1={cumulativeChart.zeroY}
            y2={cumulativeChart.zeroY}
            stroke="#657063"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />

          <polyline
            points={cumulativeChart.points}
            fill="none"
            stroke={
              cumulativeChart.latestPnl >= 0
                ? "#b8f34a"
                : "#ff7777"
            }
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="cumulative-axis">
        <span>{shortDate(cumulativeChart.firstDate)}</span>
        <span>Zero PnL reference</span>
        <span>{shortDate(cumulativeChart.lastDate)}</span>
      </div>
    </>
  ) : (
    <div className="empty">No cumulative PnL data available.</div>
  )}
</div>

        {chartData.length === 0 ? (
          <div className="empty">No daily PnL records available.</div>
        ) : (
          <>
            <div className="chart">
              {chartData.map((day) => (
                <div className="chart-column" key={day.trade_date}>
                  <div className="bar-area">
                    <div
                      className={`bar ${
                        day.realized_pnl > 0
                          ? "bar-positive"
                          : day.realized_pnl < 0
                          ? "bar-negative"
                          : "bar-zero"
                      }`}
                      style={{ height: `${day.height}%` }}
                      title={`${shortDate(day.trade_date)}: ${money(day.realized_pnl)}`}
                    />
                  </div>
                  <span className="bar-date">
                    {shortDate(day.trade_date)}
                  </span>
                </div>
              ))}
            </div>
            <div className="chart-note">
              <span>Highest absolute daily PnL determines bar scale</span>
              <span>{chartData.length} active days</span>
            </div>
          </>
        )}
      </div>
{riskMetrics && (
  <div className="risk-analysis-panel">
    <div className="panel-heading">
      <div>
        <h3>Profit Factor &amp; Risk Analysis</h3>
        <p>Risk and reward metrics from daily realized PnL</p>
      </div>
    </div>

    <div className="risk-metrics-grid">
      <article className="risk-metric-card">
        <span>Profit factor</span>
        <strong className={riskMetrics.profitFactor >= 1 ? "positive" : "negative"}>
          {Number.isFinite(riskMetrics.profitFactor)
            ? riskMetrics.profitFactor.toFixed(2)
            : riskMetrics.profitFactor === Infinity ? "∞" : "—"}
        </strong>
        <small>Gross profit ÷ gross loss</small>
      </article>

      <article className="risk-metric-card">
        <span>Average winning day</span>
        <strong className="positive">
          {money(riskMetrics.averageWinningDay)}
        </strong>
        <small>Average profit on winning days</small>
      </article>

      <article className="risk-metric-card">
        <span>Average losing day</span>
        <strong className="negative">
          {riskMetrics.grossLoss > 0
            ? `-${money(riskMetrics.averageLosingDay)}`
            : money(0)}
        </strong>
        <small>Average loss on losing days</small>
      </article>

      <article className="risk-metric-card">
        <span>Average win / loss</span>
        <strong>
          {Number.isFinite(riskMetrics.riskReward)
            ? `${riskMetrics.riskReward.toFixed(2)}×`
            : riskMetrics.riskReward === Infinity ? "∞" : "—"}
        </strong>
        <small>Average winning day vs losing day</small>
      </article>

      <article className="risk-metric-card drawdown-card">
        <span>Maximum drawdown</span>
        <strong className="negative">
          {money(riskMetrics.maxDrawdown)}
        </strong>
        <small>
          {riskMetrics.maxDrawdownPercent.toFixed(2)}% from a previous
          cumulative PnL peak
        </small>
      </article>
    </div>

    <div className="risk-extremes">
      <div>
        <span>Largest winning day</span>
        <strong className="positive">
          {riskMetrics.largestWinningDay
            ? `+${money(riskMetrics.largestWinningDay.realized_pnl)}`
            : "—"}
          {riskMetrics.largestWinningDay && (
            <small>{shortDate(riskMetrics.largestWinningDay.trade_date)}</small>
          )}
        </strong>
      </div>

      <div>
        <span>Largest losing day</span>
        <strong className="negative">
          {riskMetrics.largestLosingDay
            ? money(riskMetrics.largestLosingDay.realized_pnl)
            : "—"}
          {riskMetrics.largestLosingDay && (
            <small>{shortDate(riskMetrics.largestLosingDay.trade_date)}</small>
          )}
        </strong>
      </div>
    </div>

    <p className="risk-disclaimer">
      Calculated using daily realized PnL. Drawdown excludes unrealized
      PnL and intraday losses. These figures are not a complete measure
      of account-level risk.
    </p>
  </div>
)}
      <div className="best-worst-grid">
        <article className="highlight-card">
          <span className="highlight-label">BEST TRADING DAY</span>
          {summary.best_day ? (
            <>
              <strong className="positive">
                +{money(summary.best_day.realized_pnl)}
              </strong>
              <span>{shortDate(summary.best_day.trade_date)}</span>
              <small>
                {summary.best_day.trade_count} trades ·{" "}
                {money(summary.best_day.trading_volume)} volume
              </small>
            </>
          ) : (
            <span>No profitable day recorded</span>
          )}
        </article>

        <article className="highlight-card">
          <span className="highlight-label">WORST TRADING DAY</span>
          {summary.worst_day ? (
            <>
              <strong className="negative">
                {money(summary.worst_day.realized_pnl)}
              </strong>
              <span>{shortDate(summary.worst_day.trade_date)}</span>
              <small>
                {summary.worst_day.trade_count} trades ·{" "}
                {money(summary.worst_day.trading_volume)} volume
              </small>
            </>
          ) : (
            <span>No losing day recorded</span>
          )}
        </article>
      </div>

      <div className="additional-stats">
        <div>
          <span>Average PnL per active day</span>
          <strong className={summary.average_daily_pnl >= 0 ? "positive" : "negative"}>
            {money(summary.average_daily_pnl)}
          </strong>
        </div>
        <div>
          <span>Breakeven days</span>
          <strong>{summary.breakeven_days}</strong>
        </div>
        <div>
          <span>Total active days</span>
          <strong>{summary.total_active_days}</strong>
        </div>
      </div>

      <div className="daily-table-panel">
        <div className="panel-heading">
          <div>
            <h3>Daily performance history</h3>
            <p>Breakdown of realized PnL by trading date</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Trades</th>
                <th>Volume</th>
                <th>Realized PnL</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {[...dailyData].reverse().map((day) => (
                <tr key={day.trade_date}>
                  <td>{shortDate(day.trade_date)}</td>
                  <td>{day.trade_count.toLocaleString("en-US")}</td>
                  <td>{money(day.trading_volume)}</td>
                  <td className={day.realized_pnl >= 0 ? "positive" : "negative"}>
                    {day.realized_pnl > 0 ? "+" : ""}
                    {money(day.realized_pnl)}
                  </td>
                  <td>
                    <span
                      className={`result-pill ${
                        day.realized_pnl > 0
                          ? "profit-pill"
                          : day.realized_pnl < 0
                          ? "loss-pill"
                          : "even-pill"
                      }`}
                    >
                      {day.realized_pnl > 0
                        ? "Profit"
                        : day.realized_pnl < 0
                        ? "Loss"
                        : "Breakeven"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="disclaimer">
        Performance is calculated from recorded daily closed PnL. It does not
        represent unrealized profit or loss.
      </p>

      <style jsx>{`
        .performance {
          color: #f3f7f1;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .performance-heading,
        .panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }
        .eyebrow {
          color: #b8f34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }
        h2, h3, p {
          margin: 0;
        }
        .performance-heading h2 {
          font-size: 22px;
          letter-spacing: -0.6px;
        }
        .performance-heading p,
        .panel-heading p {
          color: #8e9a8c;
          font-size: 12px;
          margin-top: 6px;
        }
        .period {
          color: #b8f34a;
          background: rgba(184,243,74,.09);
          border: 1px solid rgba(184,243,74,.2);
          border-radius: 20px;
          padding: 7px 11px;
          font-size: 10px;
          white-space: nowrap;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .summary-card,
        .win-loss-panel,
        .highlight-card,
        .additional-stats,
        .daily-table-panel {
          background: #101410;
          border: 1px solid #252d25;
          border-radius: 13px;
        }
        .summary-card {
          min-width: 0;
          padding: 17px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .summary-card.featured {
          border-color: rgba(184,243,74,.35);
        }
        .summary-card > span,
        .additional-stats span {
          color: #8e9a8c;
          font-size: 11px;
        }
        .summary-card strong {
          font-size: clamp(18px, 2vw, 25px);
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }
        .summary-card small,
        .highlight-card small {
          color: #657063;
          font-size: 10px;
        }
        .positive { color: #b8f34a !important; }
        .negative { color: #ff7777 !important; }
        .win-loss-panel,
        .daily-table-panel {
          padding: 19px;
        }
        .panel-heading h3 {
          font-size: 14px;
        }
        .legend {
          display: flex;
          gap: 12px;
          color: #8e9a8c;
          font-size: 10px;
        }
        .legend span {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .legend i {
          width: 7px;
          height: 7px;
          border-radius: 2px;
        }
        .green { background: #b8f34a; }
        .red { background: #ff7777; }
        .chart {
          display: flex;
          align-items: flex-end;
          gap: 5px;
          height: 190px;
          overflow-x: auto;
          padding: 18px 3px 0;
          margin-top: 10px;
          border-bottom: 1px solid #303830;
        }
        .chart-column {
          flex: 1 0 15px;
          min-width: 15px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: center;
        }
        .bar-area {
          height: 145px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .bar {
          width: min(100%, 24px);
          min-height: 3px;
          border-radius: 4px 4px 1px 1px;
        }
        .bar-positive { background: #b8f34a; }
        .bar-negative { background: #ff7777; }
        .bar-zero { background: #657063; }
        .bar-date {
          color: #657063;
          font-size: 8px;
          white-space: nowrap;
          padding: 8px 0 7px;
        }
        .chart-note {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #657063;
          font-size: 10px;
          margin-top: 11px;
        }
        .best-worst-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .highlight-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .highlight-label {
          color: #8e9a8c;
          font-size: 10px;
          letter-spacing: 1px;
          font-weight: 700;
        }
        .highlight-card strong {
          font-size: 23px;
        }
        .highlight-card > span:not(.highlight-label) {
          color: #f3f7f1;
          font-size: 12px;
        }
        .additional-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 16px;
          gap: 12px;
        }
        .additional-stats div {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .additional-stats strong {
          font-size: 16px;
        }
        .table-scroll {
          width: 100%;
          overflow-x: auto;
          margin-top: 15px;
        }
        table {
          width: 100%;
          min-width: 570px;
          border-collapse: collapse;
          text-align: left;
          font-size: 11px;
        }
        th {
          color: #657063;
          font-size: 9px;
          letter-spacing: .7px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 12px 10px;
          border-bottom: 1px solid #252d25;
        }
        td {
          padding: 13px 10px;
          color: #d8dfd5;
          border-bottom: 1px solid #1c241c;
          white-space: nowrap;
        }
        tbody tr:last-child td { border-bottom: 0; }
        .result-pill {
          display: inline-block;
          border-radius: 20px;
          padding: 5px 8px;
          font-size: 9px;
        }
        .profit-pill {
          color: #b8f34a;
          background: rgba(184,243,74,.1);
        }
        .loss-pill {
          color: #ff7777;
          background: rgba(255,119,119,.1);
        }
        .even-pill {
          color: #a3ada0;
          background: rgba(163,173,160,.1);
        }
        .empty {
          padding: 30px 10px;
          text-align: center;
          color: #8e9a8c;
          font-size: 12px;
        }
        .disclaimer {
          color: #657063;
          font-size: 10px;
          line-height: 1.6;
        }
        @media (max-width: 760px) {
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .performance-heading {
            align-items: flex-start;
          }
          .performance-heading h2 { font-size: 19px; }
          .period { font-size: 9px; }
          .best-worst-grid { grid-template-columns: 1fr; }
          .additional-stats { grid-template-columns: 1fr; }
          .additional-stats div {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
          .win-loss-panel,
          .daily-table-panel { padding: 13px; }
          .chart-note { font-size: 9px; }
        }
          
.cumulative-panel {
  background: #101410;
  border: 1px solid #252d25;
  border-radius: 13px;
  padding: 19px;
}

.cumulative-period {
  color: #b8f34a;
  font-size: 10px;
  background: rgba(184, 243, 74, 0.09);
  border: 1px solid rgba(184, 243, 74, 0.2);
  border-radius: 20px;
  padding: 7px 11px;
  white-space: nowrap;
}

.cumulative-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
}

.cumulative-total span {
  color: #8e9a8c;
  font-size: 11px;
}

.cumulative-total strong {
  font-size: 22px;
}

.cumulative-chart {
  width: 100%;
  height: 220px;
  margin-top: 12px;
  overflow: hidden;
}

.cumulative-chart svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cumulative-axis {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #657063;
  font-size: 10px;
  margin-top: 8px;
}

@media (max-width: 520px) {
  .cumulative-panel {
    padding: 13px;
  }

  .cumulative-chart {
    height: 170px;
  }

  .cumulative-total strong {
    font-size: 18px;
  }

  .cumulative-axis {
    font-size: 8px;
  }
}
  .consistency-panel {
  background: #101410;
  border: 1px solid #252d25;
  border-radius: 13px;
  padding: 20px;
}

.consistency-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.consistency-heading h3 {
  font-size: 16px;
  margin-top: 5px;
}

.consistency-heading p {
  color: #8e9a8c;
  font-size: 11px;
  margin-top: 6px;
}

.consistency-score {
  display: flex;
  align-items: baseline;
  white-space: nowrap;
}

.consistency-score strong {
  color: #b8f34a;
  font-size: 38px;
  letter-spacing: -2px;
}

.consistency-score span {
  color: #657063;
  font-size: 13px;
}

.consistency-progress,
.metric-track {
  height: 8px;
  background: #252d25;
  border-radius: 20px;
  overflow: hidden;
}

.consistency-progress {
  margin-top: 20px;
}

.consistency-progress-fill,
.metric-fill {
  height: 100%;
  background: #b8f34a;
  border-radius: 20px;
  transition: width 0.3s ease;
}

.consistency-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 22px;
}

.consistency-metric > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.consistency-metric span {
  color: #aab4a6;
  font-size: 11px;
}

.consistency-metric strong {
  color: #f3f7f1;
  font-size: 11px;
  white-space: nowrap;
}

.metric-track {
  height: 5px;
}

.consistency-insights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  border-top: 1px solid #252d25;
  margin-top: 22px;
  padding-top: 18px;
}

.consistency-insights div {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.consistency-insights span {
  color: #8e9a8c;
  font-size: 10px;
}

.consistency-insights strong {
  color: #b8f34a;
  font-size: 16px;
}

.consistency-disclaimer {
  color: #657063;
  font-size: 10px;
  line-height: 1.6;
  margin-top: 18px;
}

@media (max-width: 520px) {
  .consistency-panel {
    padding: 14px;
  }

  .consistency-breakdown {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .consistency-insights {
    grid-template-columns: 1fr;
  }

  .consistency-insights div {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .consistency-score strong {
    font-size: 30px;
  }
}
  .risk-analysis-panel {
  background: #101410;
  border: 1px solid #252d25;
  border-radius: 13px;
  padding: 19px;
}

.risk-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 11px;
  margin-top: 17px;
}

.risk-metric-card {
  min-width: 0;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #151b15;
  border: 1px solid #252d25;
  border-radius: 10px;
}

.risk-metric-card > span,
.risk-extremes > div > span {
  color: #8e9a8c;
  font-size: 10px;
}

.risk-metric-card > strong {
  color: #f3f7f1;
  font-size: clamp(17px, 2vw, 23px);
  overflow-wrap: anywhere;
}

.risk-metric-card small {
  color: #657063;
  font-size: 9px;
  line-height: 1.5;
}

.risk-extremes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 13px;
}

.risk-extremes > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #151b15;
  border: 1px solid #252d25;
  border-radius: 10px;
}

.risk-extremes strong {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 13px;
  text-align: right;
}

.risk-extremes strong small {
  color: #657063;
  font-size: 9px;
  font-weight: 400;
}

.risk-disclaimer {
  color: #657063;
  font-size: 10px;
  line-height: 1.6;
  margin-top: 15px;
}

@media (max-width: 760px) {
  .risk-metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .risk-metrics-grid,
  .risk-extremes {
    grid-template-columns: 1fr;
  }
}

      `}</style>
    </section>
  );
}
