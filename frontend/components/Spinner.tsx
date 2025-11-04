"use client";

export default function Spinner({
  size = 56,
  speed = "0.8s",
}: {
  size?: number;
  speed?: string;
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "40vh" }}
      role="status"
      aria-label="Loading"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-[4px] border-transparent animate-spin-gradient"
          style={{
            borderTopColor: "var(--color-deep-navy)",
            borderRightColor: "var(--color-rich-red-top)",
            borderRadius: "50%",
            animationDuration: speed,
            boxShadow:
              "0 0 12px rgba(11,61,145,0.25), 0 0 18px rgba(255,77,79,0.18)",
          }}
        />
        {/* Subtle center glow */}
        <div
          className="absolute rounded-full bg-gradient-to-br from-[var(--color-deep-navy)]/10 to-[var(--color-rich-red-top)]/10 blur-md"
          style={{
            width: size * 0.6,
            height: size * 0.6,
          }}
        />
      </div>
    </div>
  );
}
