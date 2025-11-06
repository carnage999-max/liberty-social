"use client";
import type { ReactNode } from "react";

type MetricCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: "default" | "success" | "warning";
};

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "",
  success: "metric-card--success",
  warning: "metric-card--warning",
};

export function MetricCard({
  title,
  value,
  subtitle,
  tone = "default",
}: MetricCardProps) {
  const toneClass = toneClasses[tone] ? ` ${toneClasses[tone]}` : "";
  return (
    <article className={`metric-card${toneClass}`}>
      <p className="metric-card__eyebrow">{title}</p>
      <p className="metric-card__value">{value}</p>
      {subtitle ? <p className="metric-card__subtitle">{subtitle}</p> : null}
    </article>
  );
}
