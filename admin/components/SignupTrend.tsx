"use client";

type TrendEntry = {
  id: string;
  label: string;
  value: number;
  helper?: string;
};

type SignupTrendProps = {
  title: string;
  entries: TrendEntry[];
  emptyMessage?: string;
};

export function SignupTrend({
  title,
  entries,
  emptyMessage = "No data available for this period.",
}: SignupTrendProps) {
  const max = entries.reduce((acc, entry) => Math.max(acc, entry.value), 0);

  return (
    <section className="trend-card">
      <header className="trend-card__header">
        <h2 className="trend-card__title">{title}</h2>
        {max > 0 ? <span className="trend-card__legend">Peak: {max}</span> : null}
      </header>

      {entries.length === 0 ? (
        <p className="trend-placeholder">{emptyMessage}</p>
      ) : (
        <>
          <div className="trend-bars">
            {entries.map((entry) => {
              const height =
                max === 0 ? "0%" : `${Math.round((entry.value / max) * 100)}%`;
              return (
                <div
                  key={entry.id}
                  className="trend-bars__item"
                  title={`${entry.label}: ${entry.value}`}
                >
                  <div className="trend-bars__bar" style={{ height }} />
                  <span className="trend-label">{entry.helper ?? entry.label}</span>
                </div>
              );
            })}
          </div>

          <div className="trend-table">
            {entries.map((entry) => (
              <div key={`${entry.id}-row`} className="trend-row">
                <span>{entry.label}</span>
                <span className="trend-row__value">{entry.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
