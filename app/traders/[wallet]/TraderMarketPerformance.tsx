
"use client";

import { useEffect, useState } from "react";

type Market = {
  market: string;
  trade_count: number;
  trading_volume: number;
  realized_pnl: number;
  fees: number;
  net_pnl: number;
  winning_trades: number;
  losing_trades: number;
  breakeven_trades: number;
  pnl_recorded_fills: number;
  win_rate: number;
  fee_to_volume_percent: number;
};

type MarketResponse = {
  success: boolean;
  markets: Market[];
  total_fills_analyzed: number;
  partial_data: boolean;
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

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

export default function TraderMarketPerformance({
  wallet,
}: {
  wallet: string;
}) {
  const [data, setData] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMarkets() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/trader-market-performance?wallet=${encodeURIComponent(wallet)}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Unable to load market performance."
          );
        }

        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load market performance."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (wallet) loadMarkets();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (loading) {
    return (
      <div className="market-state">
        <span className="loading-dot" />
        Loading market performance…
        <style jsx>{`
          .market-state {
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
      <div className="market-state error">
        {error || "No market performance data available."}
        <style jsx>{`
          .market-state {
            padding: 30px 12px;
            text-align: center;
            font-size: 12px;
          }
          .error { color: #ff7777; }
        `}</style>
      </div>
    );
  }

  const markets = data.markets || [];

  const totalVolume = markets.reduce(
    (sum, market) => sum + market.trading_volume,
    0
  );

  const totalPnl = markets.reduce(
    (sum, market) => sum + market.realized_pnl,
    0
  );

  const totalFees = markets.reduce(
    (sum, market) => sum + market.fees,
    0
  );

  const totalNetPnl = totalPnl - totalFees;

  const totalTrades = markets.reduce(
    (sum, market) => sum + market.trade_count,
    0
  );

  const totalWins = markets.reduce(
    (sum, market) => sum + market.winning_trades,
    0
  );

  const totalLosses = markets.reduce(
    (sum, market) => sum + market.losing_trades,
    0
  );

  const totalBreakeven = markets.reduce(
    (sum, market) => sum + market.breakeven_trades,
    0
  );

  const totalRecordedPnlFills = markets.reduce(
    (sum, market) => sum + market.pnl_recorded_fills,
    0
  );

  const overallWinRate =
    totalWins + totalLosses > 0
      ? (totalWins / (totalWins + totalLosses)) * 100
      : 0;

  const bestMarket = markets.length
    ? markets.reduce((best, market) =>
        market.net_pnl > best.net_pnl ? market : best
      )
    : null;

  const worstMarket = markets.length
    ? markets.reduce((worst, market) =>
        market.net_pnl < worst.net_pnl ? market : worst
      )
    : null;

  const maxAbsPnl = Math.max(
    0.01,
    ...markets.map((market) => Math.abs(market.net_pnl))
  );

  return (
    <section className="market-performance">
      <div className="market-heading">
        <div>
          <div className="eyebrow">MARKET ANALYTICS</div>
          <h2>PnL by Market</h2>
          <p>Trading performance grouped by market</p>
        </div>

        <span className="market-count">
          {markets.length} MARKETS
        </span>
      </div>

      {data.partial_data && (
        <div className="partial-notice">
          Showing the first{" "}
          {data.total_fills_analyzed.toLocaleString("en-US")} fills.
          More historical fills exist, so these results may be incomplete.
        </div>
      )}

      {markets.length === 0 ? (
        <div className="market-empty">
          No market trading records available.
        </div>
      ) : (
        <>
          <div className="market-summary">
            <article>
              <span>Gross realized PnL</span>
              <strong className={totalPnl >= 0 ? "positive" : "negative"}>
                {signedMoney(totalPnl)}
              </strong>
            </article>

            <article>
              <span>Trading fees</span>
              <strong>{money(totalFees)}</strong>
            </article>

            <article>
              <span>Net PnL after fees</span>
              <strong className={totalNetPnl >= 0 ? "positive" : "negative"}>
                {signedMoney(totalNetPnl)}
              </strong>
            </article>

            <article>
              <span>Trading volume</span>
              <strong>{money(totalVolume)}</strong>
            </article>

            <article>
              <span>Total fills</span>
              <strong>{totalTrades.toLocaleString("en-US")}</strong>
            </article>
          </div>

          <div className="market-highlights">
            <article>
              <span>Best market after fees</span>
              <strong className={bestMarket && bestMarket.net_pnl >= 0 ? "positive" : "negative"}>
                {bestMarket?.market || "—"}
              </strong>
              <small>
                {bestMarket ? signedMoney(bestMarket.net_pnl) : "No data"}
              </small>
            </article>

            <article>
              <span>Worst market after fees</span>
              <strong className={worstMarket && worstMarket.net_pnl >= 0 ? "positive" : "negative"}>
                {worstMarket?.market || "—"}
              </strong>
              <small>
                {worstMarket ? signedMoney(worstMarket.net_pnl) : "No data"}
              </small>
            </article>
          </div>

          <div className="market-summary secondary-summary">
            <article>
              <span>Overall fill win rate</span>
              <strong>{overallWinRate.toFixed(1)}%</strong>
            </article>

            <article>
              <span>Winning fills</span>
              <strong className="positive">{totalWins}</strong>
            </article>

            <article>
              <span>Losing fills</span>
              <strong className="negative">{totalLosses}</strong>
            </article>

            <article>
              <span>Breakeven fills</span>
              <strong>{totalBreakeven}</strong>
            </article>

            <article>
              <span>Fills with recorded PnL</span>
              <strong>{totalRecordedPnlFills}</strong>
            </article>
          </div>

          <div className="market-chart-panel">
            <div className="panel-heading">
              <div>
                <h3>Net PnL by market</h3>
                <p>Profitability after recorded trading fees</p>
              </div>
            </div>

            <div className="market-bars">
              {markets.map((market) => (
                <div className="market-bar-row" key={market.market}>
                  <div className="market-bar-label">
                    <strong>{market.market}</strong>
                    <span className={market.net_pnl >= 0 ? "positive" : "negative"}>
                      {signedMoney(market.net_pnl)}
                    </span>
                  </div>

                  <div className="market-bar-track">
                    <div
                      className={
                        market.net_pnl >= 0
                          ? "market-bar profit"
                          : "market-bar loss"
                      }
                      style={{
                        width: `${
                          (Math.abs(market.net_pnl) / maxAbsPnl) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="market-table-panel">
            <div className="panel-heading">
              <div>
                <h3>Market performance breakdown</h3>
                <p>Markets ranked by net PnL after fees</p>
              </div>
            </div>

            <div className="market-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Fills</th>
                    <th>Volume</th>
                    <th>Gross PnL</th>
                    <th>Fees</th>
                    <th>Net PnL</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Win rate</th>
                  </tr>
                </thead>

                <tbody>
                  {markets.map((market) => (
                    <tr key={market.market}>
                      <td className="market-name">{market.market}</td>
                      <td>{market.trade_count.toLocaleString("en-US")}</td>
                      <td>{money(market.trading_volume)}</td>

                      <td className={market.realized_pnl >= 0 ? "positive" : "negative"}>
                        {signedMoney(market.realized_pnl)}
                      </td>

                      <td>{money(market.fees)}</td>

                      <td className={market.net_pnl >= 0 ? "positive" : "negative"}>
                        {signedMoney(market.net_pnl)}
                      </td>

                      <td className="positive">{market.winning_trades}</td>
                      <td className="negative">{market.losing_trades}</td>
                      <td>{market.win_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <p className="market-disclaimer">
        Net PnL is calculated as recorded realized PnL minus recorded fees.
        Volume is the sum of absolute price × size. Win rate is calculated
        from fills with recorded positive or negative closed PnL; breakeven
        and missing-PnL fills are excluded. Results may be partial when a
        wallet has more than 50,000 fills.
      </p>

      <style jsx>{`
        .market-performance {
          display: flex;
          flex-direction: column;
          gap: 17px;
          color: #f3f7f1;
        }

        .market-heading,
        .panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .eyebrow {
          color: #b8f34a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .market-heading h2 {
          font-size: 22px;
          letter-spacing: -0.6px;
          margin: 0;
        }

        .market-heading p,
        .panel-heading p {
          color: #8e9a8c;
          font-size: 12px;
          margin: 6px 0 0;
        }

        .market-count {
          color: #b8f34a;
          background: rgba(184,243,74,.09);
          border: 1px solid rgba(184,243,74,.2);
          border-radius: 20px;
          padding: 7px 11px;
          font-size: 10px;
          white-space: nowrap;
        }

        .market-summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 11px;
        }

        .market-summary article,
        .market-highlights article,
        .market-chart-panel,
        .market-table-panel {
          background: #101410;
          border: 1px solid #252d25;
          border-radius: 13px;
        }

        .market-summary article {
          min-width: 0;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .market-summary span,
        .market-highlights span {
          color: #8e9a8c;
          font-size: 10px;
        }

        .market-summary strong {
          font-size: clamp(16px, 2vw, 22px);
          overflow-wrap: anywhere;
        }

        .positive { color: #b8f34a !important; }
        .negative { color: #ff7777 !important; }

        .market-highlights {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .market-highlights article {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .market-highlights strong {
          font-size: 19px;
        }

        .market-highlights small {
          color: #8e9a8c;
          font-size: 11px;
        }

        .secondary-summary {
          background: transparent;
        }

        .market-chart-panel,
        .market-table-panel {
          padding: 18px;
        }

        .panel-heading h3 {
          font-size: 14px;
          margin: 0;
        }

        .market-bars {
          display: flex;
          flex-direction: column;
          gap: 17px;
          margin-top: 22px;
        }

        .market-bar-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 7px;
        }

        .market-bar-label strong {
          font-size: 11px;
        }

        .market-bar-label span {
          font-size: 11px;
          font-weight: 700;
        }

        .market-bar-track {
          width: 100%;
          height: 8px;
          background: #252d25;
          border-radius: 20px;
          overflow: hidden;
        }

        .market-bar {
          height: 100%;
          border-radius: 20px;
          min-width: 2px;
        }

        .market-bar.profit { background: #b8f34a; }
        .market-bar.loss { background: #ff7777; }

        .market-table-scroll {
          width: 100%;
          overflow-x: auto;
          margin-top: 14px;
        }

        table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
          font-size: 10px;
        }

        th {
          color: #657063;
          font-size: 9px;
          letter-spacing: .5px;
          text-transform: uppercase;
          padding: 12px 9px;
          border-bottom: 1px solid #252d25;
          white-space: nowrap;
        }

        td {
          color: #d8dfd5;
          padding: 13px 9px;
          border-bottom: 1px solid #1c241c;
          white-space: nowrap;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .market-name {
          color: #f3f7f1;
          font-weight: 700;
        }

        .market-empty {
          padding: 35px 12px;
          text-align: center;
          color: #8e9a8c;
          font-size: 12px;
          background: #101410;
          border: 1px solid #252d25;
          border-radius: 13px;
        }

        .partial-notice {
          padding: 11px 13px;
          border: 1px solid rgba(255, 190, 80, .3);
          background: rgba(255, 190, 80, .07);
          color: #e7c58d;
          border-radius: 9px;
          font-size: 11px;
          line-height: 1.5;
        }

        .market-disclaimer {
          color: #657063;
          font-size: 10px;
          line-height: 1.6;
          margin: 0;
        }

        @media (max-width: 1000px) {
          .market-summary {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .market-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .market-heading h2 {
            font-size: 19px;
          }

          .market-highlights {
            grid-template-columns: 1fr;
          }

          .market-chart-panel,
          .market-table-panel {
            padding: 13px;
          }
        }
      `}</style>
    </section>
  );
}
