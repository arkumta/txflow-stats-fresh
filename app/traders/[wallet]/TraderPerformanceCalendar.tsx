
"use client";

import { useMemo, useState } from "react";

type Activity = {
  activity_date: string;
  trade_count: number;
  trading_volume: number;
};

type Props = {
  data: Activity[];
};

const COLORS = {
  panel: "#101410",
  border: "#252d25",
  text: "#f3f7f1",
  muted: "#8e9a8c",
  lime: "#b8f34a",
};

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFullDate(value: string) {
  return parseDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TraderPerformanceCalendar({ data }: Props) {
  const activityMap = useMemo(() => {
    const map = new Map<string, Activity>();

    data.forEach((item) => {
      map.set(item.activity_date.slice(0, 10), {
        ...item,
        trade_count: Number(item.trade_count) || 0,
        trading_volume: Number(item.trading_volume) || 0,
      });
    });

    return map;
  }, [data]);

  const dates = useMemo(
    () => data.map((item) => item.activity_date.slice(0, 10)).sort(),
    [data]
  );

  const latestDate = dates.length ? parseDate(dates[dates.length - 1]) : new Date();
  const earliestDate = dates.length ? parseDate(dates[0]) : latestDate;

  const [visibleMonth, setVisibleMonth] = useState(
    new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
  );

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  );

  const monthEnd = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  );

  const calendarStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  calendarStart.setDate(monthStart.getDate() - mondayOffset);

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });

  const monthEntries = data.filter((item) => {
    const date = parseDate(item.activity_date);
    return (
      date.getFullYear() === visibleMonth.getFullYear() &&
      date.getMonth() === visibleMonth.getMonth()
    );
  });

  const monthTrades = monthEntries.reduce(
    (sum, item) => sum + Number(item.trade_count || 0),
    0
  );

  const monthVolume = monthEntries.reduce(
    (sum, item) => sum + Number(item.trading_volume || 0),
    0
  );

  const activeDays = monthEntries.filter(
    (item) => Number(item.trade_count) > 0
  ).length;

  const selectedActivity = selectedDate
    ? activityMap.get(selectedDate)
    : undefined;

  const maxTrades = Math.max(
    1,
    ...data.map((item) => Number(item.trade_count) || 0)
  );

  function getIntensity(trades: number) {
    if (!trades) return 0;
    const ratio = trades / maxTrades;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  function changeMonth(direction: number) {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + direction,
        1
      )
    );
    setSelectedDate(null);
  }

  const previousMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() - 1,
    1
  );

  const nextMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    1
  );

  const canGoBack =
    previousMonth.getFullYear() > earliestDate.getFullYear() ||
    (previousMonth.getFullYear() === earliestDate.getFullYear() &&
      previousMonth.getMonth() >= earliestDate.getMonth());

  const canGoForward =
    nextMonth.getFullYear() < latestDate.getFullYear() ||
    (nextMonth.getFullYear() === latestDate.getFullYear() &&
      nextMonth.getMonth() <= latestDate.getMonth());

  return (
    <section className="performance-calendar">
      <div className="calendar-header">
        <div>
          <div className="calendar-kicker">DAILY PERFORMANCE</div>
          <h2>Trading calendar</h2>
          <p>Explore daily trading activity and volume.</p>
        </div>

        <div className="calendar-navigation">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            ←
          </button>

          <span>
            {visibleMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={!canGoForward}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="calendar-summary">
        <div>
          <span>ACTIVE DAYS</span>
          <strong>{activeDays}</strong>
        </div>
        <div>
          <span>TOTAL TRADES</span>
          <strong>{monthTrades.toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>TRADING VOLUME</span>
          <strong>{formatVolume(monthVolume)}</strong>
        </div>
      </div>

      <div className="calendar-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((date) => {
          const key = dateKey(date);
          const activity = activityMap.get(key);
          const trades = Number(activity?.trade_count || 0);
          const inMonth = date.getMonth() === visibleMonth.getMonth();
          const inRange = key >= dates[0] && key <= dates[dates.length - 1];
          const intensity = getIntensity(trades);
          const selected = selectedDate === key;

          return (
            <button
              key={key}
              type="button"
              disabled={!inMonth || !inRange}
              onClick={() => setSelectedDate(key)}
              className={[
                "calendar-day",
                `intensity-${intensity}`,
                !inMonth ? "outside-month" : "",
                !inRange ? "outside-range" : "",
                selected ? "selected-day" : "",
              ].join(" ")}
              title={
                activity
                  ? `${formatFullDate(key)} · ${trades} trades · ${formatVolume(
                      Number(activity.trading_volume || 0)
                    )} volume`
                  : formatFullDate(key)
              }
            >
              <span>{date.getDate()}</span>
              {trades > 0 && <i />}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span>Less activity</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className={`intensity-${level}`} />
        ))}
        <span>More activity</span>
      </div>

      {selectedDate && (
        <div className="selected-day-panel">
          <div>
            <span className="selected-label">SELECTED DAY</span>
            <strong>{formatFullDate(selectedDate)}</strong>
          </div>

          {selectedActivity ? (
            <div className="selected-metrics">
              <div>
                <span>Trades</span>
                <strong>
                  {Number(selectedActivity.trade_count).toLocaleString("en-US")}
                </strong>
              </div>
              <div>
                <span>Volume</span>
                <strong>
                  {formatVolume(Number(selectedActivity.trading_volume))}
                </strong>
              </div>
            </div>
          ) : (
            <p>No recorded trading activity for this day.</p>
          )}
        </div>
      )}

      <style jsx>{`
        .performance-calendar {
          color: ${COLORS.text};
          width: 100%;
        }

        .calendar-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 22px;
        }

        .calendar-kicker {
          color: ${COLORS.lime};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .calendar-header h2 {
          margin: 7px 0 0;
          font-size: 21px;
          letter-spacing: -0.5px;
        }

        .calendar-header p {
          margin: 7px 0 0;
          color: ${COLORS.muted};
          font-size: 12px;
        }

        .calendar-navigation {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .calendar-navigation span {
          min-width: 125px;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
        }

        .calendar-navigation button {
          width: 31px;
          height: 31px;
          border: 1px solid ${COLORS.border};
          border-radius: 8px;
          background: #171d15;
          color: ${COLORS.lime};
          cursor: pointer;
        }

        .calendar-navigation button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .calendar-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 22px;
        }

        .calendar-summary > div {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 13px;
          border: 1px solid ${COLORS.border};
          border-radius: 9px;
          background: #0c100c;
        }

        .calendar-summary span,
        .selected-label {
          color: ${COLORS.muted};
          font-size: 9px;
          letter-spacing: 1px;
        }

        .calendar-summary strong {
          color: ${COLORS.lime};
          font-size: clamp(15px, 2vw, 21px);
          overflow-wrap: anywhere;
        }

        .calendar-weekdays,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 7px;
        }

        .calendar-weekdays {
          margin-bottom: 8px;
        }

        .calendar-weekdays span {
          color: ${COLORS.muted};
          font-size: 10px;
          text-align: center;
        }

        .calendar-day {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 1.15;
          min-width: 0;
          border: 1px solid #283127;
          border-radius: 7px;
          background: #151b14;
          color: #dce5d5;
          font-size: 11px;
          cursor: pointer;
          transition: border-color 0.15s, transform 0.15s;
        }

        .calendar-day:not(:disabled):hover {
          border-color: ${COLORS.lime};
          transform: translateY(-1px);
        }

        .calendar-day:disabled {
          cursor: default;
        }

        .calendar-day.outside-month,
        .calendar-day.outside-range {
          opacity: 0.18;
        }

        .calendar-day i,
        .calendar-legend i {
          width: 5px;
          height: 5px;
          position: absolute;
          bottom: 5px;
          border-radius: 50%;
          background: ${COLORS.lime};
        }

        .calendar-day.intensity-0 {
          background: #111611;
        }

        .calendar-day.intensity-1,
        .calendar-legend .intensity-1 {
          background: rgba(184, 243, 74, 0.14);
        }

        .calendar-day.intensity-2,
        .calendar-legend .intensity-2 {
          background: rgba(184, 243, 74, 0.30);
        }

        .calendar-day.intensity-3,
        .calendar-legend .intensity-3 {
          background: rgba(184, 243, 74, 0.52);
          color: #fff;
        }

        .calendar-day.intensity-4,
        .calendar-legend .intensity-4 {
          background: rgba(184, 243, 74, 0.82);
          color: #10150b;
        }

        .calendar-day.intensity-0 i {
          display: none;
        }

        .calendar-day.selected-day {
          outline: 2px solid ${COLORS.lime};
          outline-offset: 1px;
        }

        .calendar-legend {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          margin-top: 16px;
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .calendar-legend i {
          position: static;
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .calendar-legend .intensity-0 {
          background: #111611;
          border: 1px solid #283127;
        }

        .selected-day-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: 18px;
          padding: 15px;
          border: 1px solid ${COLORS.border};
          border-radius: 10px;
          background: #0c100c;
        }

        .selected-day-panel > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .selected-day-panel strong {
          font-size: 12px;
        }

        .selected-day-panel p {
          margin: 0;
          color: ${COLORS.muted};
          font-size: 11px;
        }

        .selected-metrics {
          display: flex;
          gap: 24px;
        }

        .selected-metrics > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .selected-metrics span {
          color: ${COLORS.muted};
          font-size: 10px;
        }

        .selected-metrics strong {
          color: ${COLORS.lime};
        }

        @media (max-width: 520px) {
          .calendar-weekdays,
          .calendar-grid {
            gap: 4px;
          }

          .calendar-day {
            border-radius: 5px;
            font-size: 10px;
          }

          .calendar-summary {
            gap: 6px;
          }

          .calendar-summary > div {
            padding: 10px 8px;
          }

          .calendar-summary span {
            font-size: 8px;
          }

          .calendar-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .calendar-navigation {
            align-self: flex-end;
          }
        }
      `}</style>
    </section>
  );
}
