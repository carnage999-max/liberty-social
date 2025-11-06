"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: "default" | "success" | "warning";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
}: MetricCardProps) {
  return (
    <article
      className={clsx(
        "rounded-2xl border px-6 py-5 shadow-sm transition hover:shadow-md",
        toneClasses[tone]
      )}
    >
      <p className="text-sm font-medium uppercase tracking-wide opacity-70">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {subtitle ? (
        <p className="mt-2 text-sm font-normal opacity-80">{subtitle}</p>
      ) : null}
    </article>
  );
}
