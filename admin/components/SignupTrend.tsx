"use client";

import clsx from "clsx";

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
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {max > 0 ? (
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Peak: {max}
          </span>
        ) : null}
      </header>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div>
          <div className="flex items-end gap-2">
            {entries.map((entry) => {
              const height =
                max === 0 ? 0 : Math.round((entry.value / max) * 100);
              return (
                <div key={entry.id} className="flex-1">
                  <div
                    className={clsx(
                      "relative flex h-40 items-end justify-center rounded-md bg-slate-100 transition",
                      entry.value > 0 && "hover:bg-slate-200"
                    )}
                    title={`${entry.label}: ${entry.value}`}
                  >
                    <div
                      className="w-3/4 rounded-t-md bg-indigo-500 transition-all duration-300 ease-out"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {entry.helper ?? entry.label}
                  </p>
                </div>
              );
            })}
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {entries.map((entry) => (
              <li
                key={`${entry.id}-label`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span>{entry.label}</span>
                <span className="font-semibold text-slate-900">
                  {entry.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
