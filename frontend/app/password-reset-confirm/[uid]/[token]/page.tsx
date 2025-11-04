"use client";

import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { API_BASE, isApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/forms/PasswordField";
import { z } from "zod";

const resetConfirmSchema = z.object({
  password: z.string().min(8),
  confirm: z.string(),
}).refine(data => data.password === data.confirm, {
  message: "Passwords don't match",
  path: ["confirm"]
});

export default function PasswordResetConfirm({
  params,
}: {
  params: { uid: string; token: string };
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = resetConfirmSchema.safeParse({ password, confirm });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setError(firstError.message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/password-reset/confirm/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: params.uid,
          token: params.token,
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (isApiError(data)) {
          throw data;
        }
        throw new Error("Failed to reset password");
      }

      toast.show("Password successfully reset");
      router.push("/auth");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || err.nonFieldErrors?.join(" ") || "Failed to reset password");
      } else {
        setError("Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white py-16 px-4 sm:py-24 sm:px-6 lg:px-8 mt-6">
      <div className="mx-auto max-w-md">
        <h2 className="text-3xl font-extrabold text-gray-900">Reset your password</h2>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm space-y-4 text-black">
            <div className="space-y-4 text-black">
              <PasswordField
                id="password"
                label="New Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                showMeter
                error={error ?? undefined}
              />
              <PasswordField
                id="confirm-password"
                label="Confirm Password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-deep-navy)"
            >
              {loading ? <Spinner /> : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}