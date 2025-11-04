"use client";

import { useMemo, useState } from "react";
import { passwordStrength } from "@/lib/password-strength";

export function PasswordField({
  id,
  value,
  onChange,
  placeholder = "********",
  autoComplete,
  error,
  label,
  showMeter,
  showToggle = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  label: string;
  showMeter?: boolean;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const { score, label: strengthLabel } = useMemo(
    () => passwordStrength(value),
    [value]
  );

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-(--color-deep-navy) ${
            error ? "border-red-400" : "border-gray-300"
          } ${showToggle ? "pr-10" : ""}`}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {showToggle && (
          <button
            type="button"
            className="absolute inset-y-0 right-2 my-auto inline-flex items-center justify-center rounded-md px-2 text-gray-600 hover:text-(--color-deep-navy)"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 3l18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M10.6 10.6a3 3 0 104.24 4.24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M9.88 5.08A9.77 9.77 0 0121 12s-3 6-9 6a9.77 9.77 0 01-5.12-1.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M3 12s3-6 9-6c.64 0 1.25.06 1.84.16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      {showMeter && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded bg-gray-200 overflow-hidden">
            <div
              className={[
                "h-full transition-all",
                score === 0
                  ? "w-1/12 bg-red-500"
                  : score === 1
                  ? "w-1/4 bg-red-500"
                  : score === 2
                  ? "w-2/4 bg-yellow-500"
                  : score === 3
                  ? "w-3/4 bg-green-500"
                  : "w-full bg-green-600",
              ].join(" ")}
            />
          </div>
          <div className="mt-1 text-xs text-gray-600">{strengthLabel}</div>
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}