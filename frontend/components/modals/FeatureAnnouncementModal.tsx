"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type FeatureAnnouncement = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  guide: {
    steps: Array<{
      title: string;
      description: string;
      icon?: React.ReactNode;
    }>;
  };
  actionLink: string;
  actionText: string;
  badge?: string; // e.g., "New", "Beta"
};

interface FeatureAnnouncementModalProps {
  announcement: FeatureAnnouncement;
  isOpen: boolean;
  onClose: () => void;
  onDismiss: () => void; // Called when user dismisses (marks as seen)
}

export default function FeatureAnnouncementModal({
  announcement,
  isOpen,
  onClose,
  onDismiss,
}: FeatureAnnouncementModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleDismiss();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleDismiss = () => {
    onDismiss();
    onClose();
  };

  const handleAction = () => {
    router.push(announcement.actionLink);
    handleDismiss();
  };

  if (!isOpen) return null;

  const totalSteps = announcement.guide.steps.length;
  const showSteps = totalSteps > 0;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="w-full max-w-2xl my-auto rounded-[20px] border-2 p-6 sm:p-8 max-h-[90vh] flex flex-col bg-white shadow-2xl"
          style={{
            borderColor: "var(--color-gold)",
            boxShadow: "0 25px 80px rgba(0, 0, 0, 0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-6 shrink-0">
            <div className="flex items-start gap-4 flex-1">
              {/* Icon */}
              <div
                className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: "var(--color-gold)",
                  color: "var(--color-deep-navy)",
                }}
              >
                <div className="w-8 h-8">{announcement.icon}</div>
              </div>

              {/* Title and Badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{announcement.title}</h2>
                  {announcement.badge && (
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: "var(--color-gold)",
                        color: "var(--color-deep-navy)",
                      }}
                    >
                      {announcement.badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{announcement.description}</p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-gray-100 shrink-0"
              aria-label="Close modal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Guide Steps */}
          {showSteps && (
            <div className="flex-1 overflow-y-auto mb-6 pr-2 -mr-2">
              <div className="space-y-4">
                {announcement.guide.steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex gap-4 p-4 rounded-xl transition ${
                      index === currentStep
                        ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-2"
                        : index < currentStep
                        ? "bg-gray-50 border border-gray-200"
                        : "bg-white border border-gray-200"
                    }`}
                    style={
                      index === currentStep
                        ? {
                            borderColor: "var(--color-gold)",
                            boxShadow: "0 4px 12px rgba(251, 191, 36, 0.2)",
                          }
                        : {}
                    }
                  >
                    {/* Step number/icon */}
                    <div className="flex-shrink-0">
                      {step.icon ? (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            backgroundColor:
                              index === currentStep
                                ? "var(--color-gold)"
                                : index < currentStep
                                ? "#10b981"
                                : "#e5e7eb",
                            color:
                              index === currentStep || index < currentStep
                                ? "var(--color-deep-navy)"
                                : "#6b7280",
                          }}
                        >
                          <div className="w-5 h-5">{step.icon}</div>
                        </div>
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                            index === currentStep
                              ? "text-white"
                              : index < currentStep
                              ? "bg-green-500 text-white"
                              : "bg-gray-300 text-gray-600"
                          }`}
                          style={
                            index === currentStep
                              ? {
                                  backgroundColor: "var(--color-deep-navy)",
                                }
                              : {}
                          }
                        >
                          {index + 1}
                        </div>
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-semibold mb-1 ${
                          index === currentStep
                            ? "text-gray-900"
                            : index < currentStep
                            ? "text-gray-700"
                            : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p
                        className={`text-sm leading-relaxed ${
                          index === currentStep
                            ? "text-gray-700"
                            : index < currentStep
                            ? "text-gray-600"
                            : "text-gray-400"
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step navigation */}
              {totalSteps > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex gap-2">
                    {Array.from({ length: totalSteps }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentStep(index)}
                        className={`w-2 h-2 rounded-full transition ${
                          index === currentStep
                            ? "w-8"
                            : index < currentStep
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                        style={
                          index === currentStep
                            ? {
                                backgroundColor: "var(--color-gold)",
                              }
                            : {}
                        }
                        aria-label={`Go to step ${index + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1))}
                    disabled={currentStep === totalSteps - 1}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200 shrink-0">
            <button
              onClick={handleDismiss}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Maybe Later
            </button>

            <button
              onClick={handleAction}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
              style={{
                background: "linear-gradient(135deg, var(--color-gold) 0%, #f59e0b 100%)",
              }}
            >
              {announcement.actionText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

