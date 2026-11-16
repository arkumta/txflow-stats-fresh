
"use client";

import { useEffect, useState } from "react";

type DisciplineData = {
  active_days: number;
  average_fills_per_active_day: number;
  daily_fill_standard_deviation: number;
  daily_fill_coefficient_variation: number;
  daily_frequency_description: string;
  average_time_between_fills_minutes: number;
  median_time_between_fills_minutes: number;
  longest_inactivity_minutes: number;
  longest_inactivity_hours: number;
  longest_winning_streak: number;
  longest_losing_streak: number;
  post_outcome_analysis: {
    next_fill_after_win_count: number;
    next_fill_after_loss_count: number;
    average_next_fill_volume_after_win: number;
    average_next_fill_volume_after_loss: number;
    next_fill_volume_change_after_loss_percent: number | null;
    average_minutes_to_next_fill_after_win: number;
    average_minutes_to_next_fill_after_loss: number;
  };
};

type Props = {
  wallet: string;
};

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";

  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }

  const hours = minutes / 60;

  if (hours < 48) {
    return `${hours.toFixed(1)} hrs`;
  }

  return `${(hours / 24).toFixed(1)} days`;
}

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatNumber(value: number, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="discipline-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

export default function TraderDiscipline({ wallet }: Props) {
  const [data, setData] = useState<DisciplineData | null>(null);
  const [totalFills, setTotalFills] = useState(0);
  const [partial, setPartial] = useState(false);
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
            result.error || "Unable to load discipline analysis."
          );
        }

        if (!cancelled) {
          setData(result.discipline_analysis ?? null);
          setTotalFills(result.total_fills_analyzed ?? 0);
          setPartial(Boolean(result.partial_data));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load discipline analysis."
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
    return <div className="discipline-state">Analyzing trading discipline…</div>;
  }

  if (error) {
    return <div className="discipline-state discipline-error">{error}</div>;
  }

  if (!data) {
    return (
      <div className="discipline-state">
        No discipline analysis is available.
      </div>
    );
  }

  const post = data.post_outcome_analysis;
  const change = post.next_fill_volume_change_after_loss_percent;

  const hasPostOutcomeSamples =
    post.next_fill_after_win_count > 0 &&
    post.next_fill_after_loss_count > 0;

  return (
    <div className="discipline-analysis">
      <div className="discipline-intro">
        <div>
          <span className="discipline-kicker">BEHAVIORAL ANALYTICS</span>
          <h3>Trading Discipline</h3>
          <p>
            Understand trading frequency, time gaps, position sizing patterns
            and activity following realized wins and losses.
          </p>
        </div>
        <div className="discipline-sample">
          <strong>{totalFills.toLocaleString("en-US")}</strong>
          <span>Fills analyzed</span>
        </div>
      </div>

      <div className="discipline-section-title">
        <h4>1. Trading frequency</h4>
        <p>How regularly does this wallet trade?</p>
      </div>

      <div className="discipline-grid">
        <Metric
          label="Active trading days"
          value={data.active_days.toLocaleString("en-US")}
          detail="UTC calendar days with recorded fills"
        />
        <Metric
          label="Average fills per active day"
          value={formatNumber(data.average_fills_per_active_day)}
          detail="Average on days with activity"
        />
        <Metric
          label="Daily frequency variation"
          value={formatNumber(data.daily_fill_coefficient_variation)}
          detail={data.daily_frequency_description}
        />
        <Metric
          label="Daily fill standard deviation"
          value={formatNumber(data.daily_fill_standard_deviation)}
          detail="Variation around average daily fills"
        />
      </div>

      <div className="discipline-section-title">
        <h4>2. Time between trades</h4>
        <p>Intervals between consecutive timestamped fills</p>
      </div>

      <div className="discipline-grid">
        <Metric
          label="Average interval"
          value={formatDuration(data.average_time_between_fills_minutes)}
          detail="Mean time between fills"
        />
        <Metric
          label="Median interval"
          value={formatDuration(data.median_time_between_fills_minutes)}
          detail="Middle interval, less affected by outliers"
        />
        <Metric
          label="Longest inactive gap"
          value={formatDuration(data.longest_inactivity_minutes)}
          detail={`${formatNumber(data.longest_inactivity_hours)} hours`}
        />
      </div>

      <div className="discipline-section-title">
        <h4>3. Winning and losing sequences</h4>
        <p>Consecutive fills with recorded positive or negative closed PnL</p>
      </div>

      <div className="discipline-grid discipline-grid-two">
        <Metric
          label="Longest winning sequence"
          value={`${data.longest_winning_streak} fills`}
          detail="Consecutive fills with positive closed PnL"
        />
        <Metric
          label="Longest losing sequence"
          value={`${data.longest_losing_streak} fills`}
          detail="Consecutive fills with negative closed PnL"
        />
      </div>

      <div className="discipline-section-title">
        <h4>4. Behavior after wins and losses</h4>
        <p>
          Compares the next chronological fill after a fill with recorded
          realized PnL.
        </p>
      </div>

      <div className="outcome-grid">
        <article className="outcome-card">
          <div className="outcome-heading">
            <span className="outcome-indicator win-indicator" />
            <strong>After winning fills</strong>
          </div>

          <div className="outcome-number">
            {post.next_fill_after_win_count.toLocaleString("en-US")}
          </div>
          <span className="outcome-caption">Observed next fills</span>

          <div className="outcome-detail">
            <span>Average next fill value</span>
            <strong>
              {formatUSD(post.average_next_fill_volume_after_win)}
            </strong>
          </div>

          <div className="outcome-detail">
            <span>Time to next fill</span>
            <strong>
              {formatDuration(post.average_minutes_to_next_fill_after_win)}
            </strong>
          </div>
        </article>

        <article className="outcome-card">
          <div className="outcome-heading">
            <span className="outcome-indicator loss-indicator" />
            <strong>After losing fills</strong>
          </div>

          <div className="outcome-number">
            {post.next_fill_after_loss_count.toLocaleString("en-US")}
          </div>
          <span className="outcome-caption">Observed next fills</span>

          <div className="outcome-detail">
            <span>Average next fill value</span>
            <strong>
              {formatUSD(post.average_next_fill_volume_after_loss)}
            </strong>
          </div>

          <div className="outcome-detail">
            <span>Time to next fill</span>
            <strong>
              {formatDuration(post.average_minutes_to_next_fill_after_loss)}
            </strong>
          </div>
        </article>
      </div>

      <div className="discipline-comparison">
        <span>Next fill value after a loss vs. after a win</span>

        {hasPostOutcomeSamples && change !== null ? (
          <strong className={change > 0 ? "change-up" : change < 0 ? "change-down" : ""}>
            {change > 0 ? "+" : ""}
            {formatNumber(change)}%
          </strong>
        ) : (
          <strong>Insufficient data</strong>
        )}

        <p>
          {hasPostOutcomeSamples && change !== null
            ? change > 0
              ? "The average next fill value was higher after losing fills in this sample."
              : change < 0
                ? "The average next fill value was lower after losing fills in this sample."
                : "The average next fill value was the same after wins and losses in this sample."
            : "More recorded winning and losing fills with subsequent trades are needed for this comparison."}
        </p>
      </div>

      <div className="discipline-notice">
        <strong>Methodology and limitations</strong>
        <ul>
          <li>
            A fill is an execution record, not necessarily a complete position
            or a separate trading decision.
          </li>
          <li>
            Frequency variation is the coefficient of variation of daily fill
            counts on active UTC days. It is descriptive, not a rating.
          </li>
          <li>
            Winning and losing sequences count consecutive fills with non-null
            closed PnL. Fills with null PnL break a sequence.
          </li>
          <li>
            Post-win and post-loss comparisons use the next chronological
            timestamped fill. They show association, not causation or emotional
            state.
          </li>
          <li>
            Fill value is calculated as absolute price × size. It is not
            necessarily the trader's position size or risk exposure.
          </li>
          <li>
            The longest inactive gap is measured only between fills included
            in this API response, not before the first or after the last fill.
          </li>
        </ul>

        {partial && (
          <p className="discipline-warning">
            The API reached its 50,000-fill limit. These statistics may be
            incomplete.
          </p>
        )}
      </div>

      <style jsx>{`
        .discipline-analysis {
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: #f3f7f1;
        }

        .discipline-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
        }

        .discipline-kicker {
          color: #b8f34a;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .discipline-intro h3 {
          margin: 8px 0 6px;
          font-size: 19px;
        }

        .discipline-intro p,
        .discipline-section-title p {
          margin: 0;
          color: #8e9a8c;
          font-size: 12px;
          line-height: 1.6;
        }

        .discipline-sample {
          display: flex;
          flex-direction: column;
          flex: 0 0 auto;
          gap: 4px;
          padding: 10px 13px;
          border: 1px solid #252d25;
          border-radius: 9px;
          background: #0c100c;
        }

        .discipline-sample strong {
          color: #b8f34a;
          font-size: 17px;
        }

        .discipline-sample span {
          color: #8e9a8c;
          font-size: 9px;
        }

        .discipline-section-title {
          margin-top: 4px;
        }

        .discipline-section-title h4 {
          margin: 0 0 5px;
          font-size: 13px;
        }

        .discipline-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .discipline-grid-two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .discipline-metric {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          border: 1px solid #252d25;
          border-radius: 10px;
          background: #0c100c;
        }

        .discipline-metric > span {
          color: #8e9a8c;
          font-size: 10px;
          line-height: 1.5;
        }

        .discipline-metric strong {
          color: #f3f7f1;
          font-size: clamp(17px, 2vw, 22px);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .discipline-metric small {
          color: #657063;
          font-size: 9px;
          line-height: 1.5;
        }

        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .outcome-card {
          padding: 17px;
          border: 1px solid #252d25;
          border-radius: 11px;
          background: #0c100c;
        }

        .outcome-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .outcome-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .win-indicator {
          background: #b8f34a;
        }

        .loss-indicator {
          background: #ff7777;
        }

        .outcome-number {
          margin-top: 19px;
          font-size: 27px;
          font-weight: 800;
        }

        .outcome-caption {
          color: #657063;
          font-size: 10px;
        }

        .outcome-detail {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid #252d25;
        }

        .outcome-detail span {
          color: #8e9a8c;
          font-size: 10px;
        }

        .outcome-detail strong {
          font-size: 12px;
          text-align: right;
        }

        .discipline-comparison {
          padding: 17px;
          border: 1px solid #303b2b;
          border-radius: 10px;
          background: rgba(184, 243, 74, 0.035);
        }

        .discipline-comparison > span {
          display: block;
          color: #8e9a8c;
          font-size: 11px;
        }

        .discipline-comparison > strong {
          display: block;
          margin-top: 8px;
          color: #e8eee4;
          font-size: 24px;
        }

        .discipline-comparison .change-up {
          color: #ff9292;
        }

        .discipline-comparison .change-down {
          color: #b8f34a;
        }

        .discipline-comparison p {
          margin: 7px 0 0;
          color: #8e9a8c;
          font-size: 11px;
          line-height: 1.6;
        }

        .discipline-notice {
          padding: 15px 17px;
          border: 1px solid #252d25;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.015);
        }

        .discipline-notice > strong {
          color: #b8f34a;
          font-size: 11px;
        }

        .discipline-notice ul {
          margin: 10px 0 0;
          padding-left: 17px;
          color: #8e9a8c;
          font-size: 10px;
          line-height: 1.8;
        }

        .discipline-notice li + li {
          margin-top: 4px;
        }

        .discipline-notice .discipline-warning {
          margin: 10px 0 0;
          color: #ffc477;
          font-size: 10px;
          line-height: 1.6;
        }

        .discipline-state {
          padding: 25px 18px;
          color: #8e9a8c;
          font-size: 12px;
        }

        .discipline-error {
          color: #ff7777;
        }

        @media (max-width: 850px) {
          .discipline-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .discipline-intro {
            align-items: flex-start;
            flex-direction: column;
          }

          .outcome-grid {
            grid-template-columns: 1fr;
          }

          .discipline-grid {
            grid-template-columns: 1fr 1fr;
          }

          .discipline-metric {
            padding: 13px;
          }
        }
      `}</style>
    </div>
  );
}
