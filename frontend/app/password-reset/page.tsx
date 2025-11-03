"use client";

import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { API_BASE, isApiError } from "@/lib/api";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const resetSchema = z.object({
  email: z.string().email(),
});

export default function PasswordReset() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = resetSchema.safeParse({ email });
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setError(firstError.message);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/password-reset/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (isApiError(data)) {
          throw data;
        }
        throw new Error("Failed to request password reset");
      }

      setSubmitted(true);
      toast.show("If an account exists with this email, you will receive reset instructions shortly");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || err.nonFieldErrors?.join(" ") || "Failed to request password reset");
      } else {
        setError("Failed to request password reset. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-white py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              If an account exists with the email {email}, you will receive instructions to reset your password.
            </p>
            <div className="mt-5">
              <Link
                href="/auth"
                className="text-sm font-medium text-(--color-primary) hover:opacity-80"
              >
                Return to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Reset your password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-(--color-primary) focus:border-(--color-primary) sm:text-sm"
              placeholder="Email address"
            />
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
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-linear-to-r from-(--color-primary) to-(--color-secondary) hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-primary)"
            >
              {loading ? <Spinner /> : "Send reset instructions"}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/auth"
              className="text-sm font-medium text-(--color-primary) hover:opacity-80"
            >
              Return to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}