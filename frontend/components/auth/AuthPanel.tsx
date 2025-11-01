"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { loginSchema, registerSchema } from "@/lib/validators";
import { passwordStrength } from "@/lib/password-strength";
import { useToast } from "../Toast";
import Spinner from "../Spinner";
import { isApiError } from "@/lib/api";

type Mode = "login" | "register";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app/feed";
  const toast = useToast();
  const onSuccess = useCallback(() => {
    toast.show(mode === "register" ? "Welcome to Liberty Social!" : "Welcome back!");
    router.push(next);
  }, [router, next, mode, toast]);
  const handleError = useCallback(
    (message: string | null) => {
      setGlobalError(message);
      if (message) {
        toast.show(message, "error");
      }
    },
    [toast]
  );

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* Toggle tabs */}
      <div className="mx-auto mb-6 flex w-full max-w-md rounded-xl bg-white/70 shadow-sm overflow-hidden">
        <button
          onClick={() => {
            setMode("login");
            setGlobalError(null);
          }}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
            mode === "login"
              ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white"
              : "text-[var(--color-primary)]"
          }`}
        >
          Log in
        </button>
        <button
          onClick={() => {
            setMode("register");
            setGlobalError(null);
          }}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
            mode === "register"
              ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white"
              : "text-[var(--color-primary)]"
          }`}
        >
          Sign up
        </button>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 md:gap-8 md:grid-cols-2">
        {/* Form card */}
        <div className="rounded-[16px] bg-white/85 backdrop-blur-sm shadow-md p-4 xs:p-5 sm:p-6 md:p-7 lg:p-8 overflow-hidden">
          {mode === "login" ? (
            <LoginForm onError={handleError} onSuccess={onSuccess} />
          ) : (
            <RegisterForm onError={handleError} onSuccess={onSuccess} />
          )}

          {/* Socials */}
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">
              Or continue with
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <SocialBtn label="Google" full>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5h-1.6V20H24v8h11.3C33.5 31.9 29.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.7 6.1 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10 0 18.4-7.1 19.8-16.5.1-.5.2-1 .2-1.5v-5.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.5 16.3 18.9 14 24 14c3 0 5.7 1.1 7.8 2.9l5.7-5.7C33.7 6.1 29.1 4 24 4 15.5 4 8.1 8.9 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5 0 9.6-1.9 13-5.1l-6-4.9C29.1 36 26.7 37 24 37c-5 0-9.3-3.4-10.9-8.1l-6.7 5.2C8.2 39.2 15.5 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.9-5 7-9.3 7-5 0-9.3-3.4-10.9-8.1l-6.7 5.2C8.2 39.2 15.5 44 24 44c10 0 18.4-7.1 19.8-16.5.1-.5.2-1 .2-1.5v-5.5z"
                  />
                </svg>
              </SocialBtn>

              <SocialBtn label="Apple" full>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M33.3 25.3c.1-3.2 1.7-5.6 4.4-7.3-1.7-2.4-4.2-3.7-7.3-3.9-3.1-.2-6.2 1.8-7.4 1.8-1.3 0-4.3-1.7-6.7-1.7-3.4.1-6.5 2-8.1 5.1-3.5 6.2-.9 15.3 2.5 20.3 1.7 2.4 3.7 5.1 6.3 5 2.5-.1 3.5-1.6 6.5-1.6 3 0 3.9 1.6 6.6 1.5 2.7 0 4.4-2.4 6.1-4.8 1.9-2.8 2.7-5.6 2.7-5.7-.1-.1-5.1-2-5.1-8.7z"
                    fill="currentColor"
                  />
                  <path
                    d="M29.5 9.4c1.4-1.7 2.3-4 2-6.4-2.2.2-4.3 1.4-5.7 3.1-1.2 1.4-2.3 3.8-2 6.1 2.3.2 4.4-1.1 5.7-2.8z"
                    fill="currentColor"
                  />
                </svg>
              </SocialBtn>
            </div>
          </div>

          {globalError && (
            <p className="mt-4 text-sm text-red-600">{globalError}</p>
          )}
        </div>

        {/* Brand / copy side */}
        <div className="rounded-[16px] bg-white/60 backdrop-blur-sm shadow-sm p-4 xs:p-5 sm:p-6 md:p-7 lg:p-8">
          <h3 className="text-2xl font-extrabold mb-2">
            Welcome to Liberty Social
          </h3>
          <p className="text-gray-700">
            One place to connect freely and share boldly. Create your account to
            join communities, follow conversations, and make your voice heard.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-700">
            <li>• Fast onboarding with email or username</li>
            <li>• Privacy-first design</li>
            <li>• Community spaces that celebrate people, not just posts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Social button ---------------- */
function SocialBtn({
  children,
  label,
  full,
}: {
  children: ReactNode;
  label: string;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={[
        "inline-flex items-center justify-center gap-2",
        "rounded-[10px] bg-white text-[var(--color-primary)]",
        "px-4 py-2 shadow-sm hover:opacity-90 transition",
        full ? "w-full sm:w-auto" : "",
      ].join(" ")}
    >
      {children}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

/* ---------------- Shared field helpers ---------------- */
function Field({
  label,
  error,
  children,
  id,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  id?: string;
}) {
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <div>{children}</div>
      {error && (
        <p id={describedBy} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  label,
  showMeter,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  error?: string;
  label: string;
  showMeter?: boolean;
}) {
  const [show, setShow] = useState(false);
  const { score, label: strengthLabel } = useMemo(
    () => passwordStrength(value),
    [value]
  );

  return (
    <Field id={id} label={label} error={error}>
      <div className="relative">
        <input
          id={id}
          className={`w-full rounded-[10px] border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
            error ? "border-red-400" : "border-gray-300"
          }`}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-2 my-auto inline-flex items-center justify-center rounded-md px-2 text-gray-600 hover:text-[var(--color-primary)]"
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
    </Field>
  );
}

/* ---------------- Forms with deferred validation ---------------- */
function LoginForm({
  onError,
  onSuccess,
}: {
  onError: (m: string | null) => void;
  onSuccess: () => void;
}) {
  const { login, loading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const blurValidate = (field: "identifier" | "password") => {
    setTouched((t) => ({ ...t, [field]: true }));
    const parsed = loginSchema.safeParse({ identifier, password });
    if (parsed.success) {
      setErrors((e) => ({ ...e, [field]: "" }));
    } else {
      const issue = parsed.error.issues.find((i) => i.path[0] === field);
      setErrors((e) => ({ ...e, [field]: issue?.message || "" }));
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onError(null);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (m[i.path[0] as string] = i.message));
      setErrors(m);
      setTouched({ identifier: true, password: true });
      return;
    }
    try {
      await login({ username: identifier.trim(), password });
      onSuccess();
    } catch (err: unknown) {
      if (isApiError(err)) {
        const apiFieldErrors = err.fieldErrors ?? {};
        const mappedErrors: Record<string, string> = {};
        for (const [key, messages] of Object.entries(apiFieldErrors)) {
          const message = messages.join(" ");
          if (["username", "email"].includes(key)) mappedErrors.identifier = message;
          if (key === "password") mappedErrors.password = message;
        }
        if (Object.keys(mappedErrors).length) {
          setErrors((prev) => ({ ...prev, ...mappedErrors }));
          setTouched((prev) => {
            const next = { ...prev };
            for (const field of Object.keys(mappedErrors)) {
              next[field] = true;
            }
            return next;
          });
        }
        onError(err.message || err.nonFieldErrors?.join(" ") || "Login failed. Please try again.");
      } else {
        onError("Login failed. Please try again.");
      }
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        id="login-identifier"
        label="Username / Email / Phone"
        error={touched.identifier ? errors.identifier : ""}
      >
        <input
          id="login-identifier"
          className={`w-full rounded-[10px] border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
            touched.identifier && errors.identifier
              ? "border-red-400"
              : "border-gray-300"
          }`}
          placeholder="alice / alice@example.com / +123456789"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => blurValidate("identifier")}
          autoComplete="username"
          inputMode="email"
          aria-invalid={!!(touched.identifier && errors.identifier)}
          aria-describedby={
            touched.identifier && errors.identifier
              ? "login-identifier-error"
              : undefined
          }
        />
      </Field>

      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="********"
        autoComplete="current-password"
        error={touched.password ? errors.password : ""}
      />
      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[12px] px-4 py-3 text-white font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition shadow-metallic disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}

function RegisterForm({
  onError,
  onSuccess,
}: {
  onError: (m: string | null) => void;
  onSuccess: () => void;
}) {
  const { register, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const blurValidate = (field: keyof typeof touched) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const parsed = registerSchema.safeParse({
      username,
      email,
      phone: phone || undefined,
      first_name: first || undefined,
      last_name: last || undefined,
      password,
      confirm,
    });
    if (parsed.success) {
      setErrors((e) => ({ ...e, [field]: "" }));
    } else {
      const issue = parsed.error.issues.find((i) => i.path[0] === field);
      setErrors((e) => ({ ...e, [field]: issue?.message || "" }));
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onError(null);
    const parsed = registerSchema.safeParse({
      username,
      email,
      phone: phone || undefined,
      first_name: first || undefined,
      last_name: last || undefined,
      password,
      confirm,
    });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (m[i.path[0] as string] = i.message));
      setErrors(m);
      setTouched({
        username: true,
        email: true,
        phone: !!m.phone,
        first_name: !!m.first_name,
        last_name: !!m.last_name,
        password: true,
        confirm: true,
      });
      return;
    }
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        first_name: first.trim(),
        last_name: last.trim(),
        phone_number: phone.trim() || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      if (isApiError(err)) {
        const mappedErrors: Record<string, string> = {};
        const apiFieldErrors = err.fieldErrors ?? {};
        for (const [key, messages] of Object.entries(apiFieldErrors)) {
          const message = messages.join(" ");
          if (key === "phone_number") mappedErrors.phone = message;
          if (key === "first_name") mappedErrors.first_name = message;
          if (key === "last_name") mappedErrors.last_name = message;
          if (["username", "email", "password"].includes(key))
            mappedErrors[key] = message;
        }
        if (Object.keys(mappedErrors).length) {
          setErrors((prev) => ({ ...prev, ...mappedErrors }));
          setTouched((prev) => {
            const next = { ...prev };
            for (const field of Object.keys(mappedErrors)) {
              next[field] = true;
            }
            return next;
          });
        }
        onError(
          err.message ||
            err.nonFieldErrors?.join(" ") ||
            "Registration failed. Please try again."
        );
      } else {
        onError("Registration failed. Please try again.");
      }
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          id="reg-username"
          label="Username *"
          error={touched.username ? errors.username : ""}
        >
          <input
            id="reg-username"
            className={`w-full rounded-[10px] border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
              touched.username && errors.username
                ? "border-red-400"
                : "border-gray-300"
            }`}
            placeholder="alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => blurValidate("username")}
            autoComplete="username"
          />
        </Field>
        <Field
          id="reg-email"
          label="Email *"
          error={touched.email ? errors.email : ""}
        >
          <input
            id="reg-email"
            className={`w-full rounded-[10px] border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
              touched.email && errors.email
                ? "border-red-400"
                : "border-gray-300"
            }`}
            type="email"
            placeholder="alice@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => blurValidate("email")}
            autoComplete="email"
            inputMode="email"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          id="reg-first"
          label="First name"
          error={touched.first_name ? errors.first_name : ""}
        >
          <input
            id="reg-first"
            className="w-full rounded-[10px] border border-gray-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            placeholder="Alice"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            onBlur={() => blurValidate("first_name")}
            autoComplete="given-name"
          />
        </Field>
        <Field
          id="reg-last"
          label="Last name"
          error={touched.last_name ? errors.last_name : ""}
        >
          <input
            id="reg-last"
            className="w-full rounded-[10px] border border-gray-300 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            placeholder="Example"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            onBlur={() => blurValidate("last_name")}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field
        id="reg-phone"
        label="Phone (optional)"
        error={touched.phone ? errors.phone : ""}
      >
        <input
          id="reg-phone"
          className={`w-full rounded-[10px] border bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
            touched.phone && errors.phone ? "border-red-400" : "border-gray-300"
          }`}
          placeholder="+123456789"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => blurValidate("phone")}
          autoComplete="tel"
          inputMode="tel"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PasswordField
          id="reg-password"
          label="Password *"
          value={password}
          onChange={setPassword}
          placeholder="********"
          autoComplete="new-password"
          error={touched.password ? errors.password : ""}
          showMeter
        />
        <PasswordField
          id="reg-confirm"
          label="Confirm password *"
          value={confirm}
          onChange={setConfirm}
          placeholder="********"
          autoComplete="new-password"
          error={touched.confirm ? errors.confirm : ""}
        />
      </div>

      {/* Optional hint tied to strength */}
      {password && (
        <p className="text-xs text-gray-600 -mt-2">
          Tip: use at least 12+ chars mixing letters, numbers, and symbols for a
          stronger password.
        </p>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[12px] px-4 py-3 text-white font-semibold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition shadow-metallic disabled:opacity-60"
        >
          {loading ? <Spinner /> : "Create account"}
        </button>
      </div>
    </form>
  );
}
