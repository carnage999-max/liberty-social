"use client";
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

type ToastVariant = "success" | "error";
type ToastMsg = {
  id: string;
  message: ReactNode;
  variant: ToastVariant;
};

const ToastContext = createContext<
  { show: (msg: ReactNode, variant?: ToastVariant, duration?: number) => void } | null
>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counterRef = useRef(0);

  const show = useCallback(
    (message: ReactNode, variant: ToastVariant = "success", duration = 3500) => {
      const id = `${Date.now()}-${++counterRef.current}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 space-y-3 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xl w-full mx-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm animate-fade-in shadow-metallic border border-transparent`}
          >
            {/* Variant accent / icon */}
            <div className={`shrink-0 mt-0.5 rounded-full p-2 ${
              t.variant === "error" ? "bg-red-600 text-white" : "bg-(--color-gold) text-(--color-deep-navy)"
            }`}>
              {t.variant === "error" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-4.75a.75.75 0 10-1.5 0v1.5a.75.75 0 001.5 0v-1.5zM10 6.5a.875.875 0 00-.875.875v3.75c0 .483.392.875.875.875s.875-.392.875-.875V7.375A.875.875 0 0010 6.5z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.03-10.47a.75.75 0 10-1.06-1.06L9 9.44 8.03 8.47a.75.75 0 10-1.06 1.06L8.94 11.5a.75.75 0 001.06 0l3-3z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Message container */}
            <div className={`flex-1 rounded-lg py-1 px-2 ${
              t.variant === "error"
                ? "bg-red-600/10 text-white border-red-600/20"
                : "bg-white/95 text-(--color-deep-navy) border-[rgba(0,0,0,0.06)]"
            }`}>
              <div className="text-sm">
                {t.message}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
