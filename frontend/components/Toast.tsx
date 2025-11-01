"use client";
import { createContext, useContext, useState, useCallback } from "react";

type ToastVariant = "success" | "error";
type ToastMsg = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<
  { show: (msg: string, variant?: ToastVariant) => void } | null
>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3500
    );
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-[12px] px-5 py-3 text-sm text-white shadow-lg animate-fade-in ${
              t.variant === "error"
                ? "bg-red-500"
                : "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]"
            }`}
          >
            {t.message}
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
