"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError("Invalid or missing reset link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to reset password."
        );
      }

      setMessage(
        "Password changed successfully. Redirecting to login..."
      );

      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "20px",
        background: "#080d18",
      }}
    >
      <div
        style={{
          width: "min(440px, 100%)",
          padding: "30px",
          border: "1px solid #29344d",
          borderRadius: "20px",
          background: "#10172a",
        }}
      >
        <h1
          style={{
            marginTop: 0,
          }}
        >
          Reset Password
        </h1>

        <p
          className="muted"
          style={{
            marginBottom: "24px",
          }}
        >
          Create a new password for your admin account.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <label className="login-form">
            <span>New Password</span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="login-form">
            <span>Confirm Password</span>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>

          {error && (
            <div className="login-error">{error}</div>
          )}

          {message && (
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(34,197,94,0.1)",
                color: "#6ee7b7",
                fontSize: "13px",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
            }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background: "#080d18",
            color: "#fff",
          }}
        >
          Loading...
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
