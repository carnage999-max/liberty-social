"use client";

import { useState } from "react";

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
  const [hoveredIndex, setHoveredIndex] = useState(null as number | null);
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
            {entries.map((entry, index) => {
              // Calculate height as exact percentage of max value
              const heightPercent = max === 0 || entry.value === 0 
                ? 0 
                : (entry.value / max) * 100;
              
              // Convert to pixel height - use smaller container to prevent overflow
              // Container is 8rem (128px), use max 80px for bars to leave room for labels and prevent overlap
              const maxBarHeight = 80; // Maximum bar height in pixels
              const heightPx = entry.value === 0 
                ? 4 
                : Math.max(8, (heightPercent / 100) * maxBarHeight);
              
              const height = `${heightPx}px`;
              const isHovered = hoveredIndex === index;
              return (
                <div
                  key={entry.id}
                  className="trend-bars__item"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setHoveredIndex(isHovered ? null : index)}
                  style={{ cursor: "pointer" }}
                >
                  {isHovered && (
                    <div className="trend-tooltip">
                      <div className="trend-tooltip__content">
                        <div className="trend-tooltip__label">{entry.label}</div>
                        <div className="trend-tooltip__value">{entry.value} sign-ups</div>
                      </div>
                    </div>
                  )}
                  <div 
                    className="trend-bars__bar" 
                    style={{ 
                      height: height,
                      opacity: entry.value === 0 ? 0.3 : 1
                    }} 
                  />
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
