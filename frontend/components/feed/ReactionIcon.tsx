import type { ReactionType } from "@/lib/types";

interface ReactionIconProps {
  type: ReactionType;
  size?: number;
  className?: string;
  filled?: boolean;
}

export function ReactionIcon({ type, size = 18, className = "", filled = false }: ReactionIconProps) {
  const baseClasses = className;
  
  switch (type) {
    case "like":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClasses}
          aria-hidden="true"
        >
          <path d="M7 10v12M7 10l-4-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    
    case "love":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClasses}
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    
    case "haha":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClasses}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="15" cy="9" r="1" />
        </svg>
      );
    
    case "sad":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClasses}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="15" cy="9" r="1" />
        </svg>
      );
    
    case "angry":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={baseClasses}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
          <path d="M9 8.5c-.5 1-1.5 1-2 0M15 8.5c.5 1 1.5 1 2 0" />
        </svg>
      );
    
    default:
      return null;
  }
}

