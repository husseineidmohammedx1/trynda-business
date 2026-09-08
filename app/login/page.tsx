"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ResetStep = "email" | "code" | "password";

type ApiResponse = {
  error?: string;
  role?: string;
  user?: {
    role?: string;
  };
};

type PremiumButtonProps = {
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

const recoveryOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 3000,
  display: "grid",
  placeItems: "center",
  padding: "20px",
  background: "rgba(0,0,0,0.80)",
  backdropFilter: "blur(10px)",
};

const recoveryModalStyle: CSSProperties = {
  width: "min(460px,100%)",
  padding: "30px",
  border: "1px solid rgba(168,159,255,0.25)",
  borderRadius: "20px",
  background: "rgba(16,23,42,0.98)",
  boxShadow: "0 30px 100px rgba(0,0,0,0.7)",
};

const recoveryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "15px",
  marginBottom: "24px",
};

const recoveryEyebrowStyle: CSSProperties = {
  marginBottom: "8px",
  color: "#a89fff",
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.15em",
};

const recoveryDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13px",
  lineHeight: 1.6,
};

const closeButtonStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  border: "1px solid #2b3550",
  borderRadius: "9px",
  background: "#1a2340",
  color: "#cbd5e1",
  fontSize: "18px",
};

const formStackStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
};

const successNoticeStyle: CSSProperties = {
  padding: "13px 14px",
  border: "1px solid rgba(34,197,94,0.2)",
  borderRadius: "10px",
  background: "rgba(34,197,94,0.08)",
  color: "#6ee7b7",
  fontSize: "12px",
  lineHeight: 1.6,
};

const passwordHintStyle: CSSProperties = {
  padding: "12px 14px",
  border: "1px solid rgba(168,159,255,0.18)",
  borderRadius: "10px",
  background: "rgba(168,159,255,0.08)",
  color: "#c4bfff",
  fontSize: "12px",
};

const codeInputStyle: CSSProperties = {
  textAlign: "center",
  letterSpacing: "8px",
  fontSize: "24px",
  fontWeight: 800,
};

const textActionStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#8995ab",
  fontSize: "12px",
};

const forgotPasswordStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#a89fff",
  fontSize: "12px",
  fontWeight: 600,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function postJson(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as ApiResponse;

  return { data, response };
}

function PremiumButton({
  label,
  loading = false,
  loadingLabel,
  type = "submit",
  disabled = false,
  onClick,
}: PremiumButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="premium-login-button"
      onClick={onClick}
    >
      <span className="button-content">
        {loading ? (
          <>
            <span className="button-spinner" />
            {loadingLabel}
          </>
        ) : (
          <>
            {label}
            <span className="button-arrow">→</span>
          </>
        )}
      </span>

      <span className="button-glow" />
    </button>
  );
}

function ErrorNotice({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="premium-login-error">
      <span>!</span>
      {message}
    </div>
  );
}

function SuccessNotice({ children }: { children: ReactNode }) {
  return <div style={successNoticeStyle}>✓ {children}</div>;
}

export default function LoginPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(true);

  const [showForgot, setShowForgot] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const currentVideo = videoRef.current;

    if (!currentVideo) {
      return;
    }

    currentVideo.muted = true;
    setMuted(true);

    void currentVideo.play().catch((playError) => {
      console.error("Video autoplay failed:", playError);
    });
  }, []);

  function clearRecoveryForm() {
    setResetStep("email");
    setForgotEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
    setForgotMessage("");
  }

  async function enableSound() {
    const currentVideo = videoRef.current;

    if (!currentVideo) {
      return;
    }

    try {
      currentVideo.muted = false;
      currentVideo.volume = 0.35;

      await currentVideo.play();
      setMuted(false);
    } catch {
      setError("Please click the sound button again.");
    }
  }

  function toggleSound() {
    const currentVideo = videoRef.current;

    if (!currentVideo) {
      return;
    }

    if (currentVideo.muted) {
      void enableSound();
      return;
    }

    currentVideo.muted = true;
    setMuted(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, response } = await postJson("/api/auth/login", {
        email: normalizeEmail(email),
        password,
      });

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      const role = String(
        data?.user?.role ?? data?.role ?? ""
      ).toUpperCase();

      if (role === "BOOSTER") {
        router.replace("/booster");
      } else if (role === "ADMIN") {
        router.replace("/dashboard");
      } else {
        setError("Your account does not have a valid role.");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openForgotPassword() {
    clearRecoveryForm();
    setShowForgot(true);
  }

  function closeForgotPassword() {
    if (forgotLoading) {
      return;
    }

    setShowForgot(false);
    clearRecoveryForm();
  }

  async function sendResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const recoveryEmail = normalizeEmail(forgotEmail);

    setForgotError("");
    setForgotMessage("");

    if (!recoveryEmail) {
      setForgotError("Please enter your email address.");
      return;
    }

    setForgotLoading(true);

    try {
      const { data, response } = await postJson("/api/auth/forgot-password", {
        email: recoveryEmail,
      });

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset code.");
      }

      setForgotMessage("A 6-digit reset code has been sent to your Gmail.");
      setResetStep("code");
    } catch (requestError) {
      setForgotError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to send reset code."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function continueToPassword() {
    setForgotError("");
    setForgotMessage("");

    if (!/^\d{6}$/.test(resetCode)) {
      setForgotError("Please enter the 6-digit reset code.");
      return;
    }

    setResetStep("password");
  }

  function handleResetCodeChange(event: ChangeEvent<HTMLInputElement>) {
    const numericCode = event.target.value.replace(/\D/g, "").slice(0, 6);

    setResetCode(numericCode);
  }

  function returnToEmailStep() {
    setResetStep("email");
    setResetCode("");
    setForgotError("");
    setForgotMessage("");
  }

  function returnToCodeStep() {
    setResetStep("code");
    setForgotError("");
    setForgotMessage("");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (newPassword.length < 8) {
      setForgotError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);

    try {
      const { data, response } = await postJson("/api/auth/reset-password", {
        email: normalizeEmail(forgotEmail),
        code: resetCode.trim(),
        password: newPassword,
      });

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setForgotMessage("Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        setShowForgot(false);
        clearRecoveryForm();
        setEmail("");
        setPassword("");
      }, 1500);
    } catch (requestError) {
      setForgotError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to reset password."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function handleRecoveryBackdropMouseDown(
    event: MouseEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget) {
      closeForgotPassword();
    }
  }

  function renderRecoveryStep() {
    if (resetStep === "email") {
      return (
        <form onSubmit={sendResetCode} style={formStackStyle}>
          <label className="login-form">
            <span>ADMIN EMAIL</span>
            <input
              type="email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              autoFocus
              required
            />
          </label>

          <ErrorNotice message={forgotError} />

          {forgotMessage && <SuccessNotice>{forgotMessage}</SuccessNotice>}

          <PremiumButton
            label="SEND RESET CODE"
            loading={forgotLoading}
            loadingLabel="SENDING CODE..."
          />
        </form>
      );
    }

    if (resetStep === "code") {
      return (
        <div style={formStackStyle}>
          <SuccessNotice>
            <>
              Reset code sent to:
              <br />
              <strong>{forgotEmail}</strong>
            </>
          </SuccessNotice>

          <label className="login-form">
            <span>6-DIGIT RESET CODE</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={resetCode}
              onChange={handleResetCodeChange}
              placeholder="000000"
              autoFocus
              required
              style={codeInputStyle}
            />
          </label>

          <ErrorNotice message={forgotError} />

          <PremiumButton
            type="button"
            label="VERIFY CODE"
            disabled={resetCode.length !== 6}
            onClick={continueToPassword}
          />

          <button type="button" onClick={returnToEmailStep} style={textActionStyle}>
            ← Send another code
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={resetPassword} style={formStackStyle}>
        <div style={passwordHintStyle}>
          Code entered successfully. Create your new password.
        </div>

        <label className="login-form">
          <span>NEW PASSWORD</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            autoComplete="new-password"
            autoFocus
            required
          />
        </label>

        <label className="login-form">
          <span>CONFIRM PASSWORD</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>

        <ErrorNotice message={forgotError} />

        {forgotMessage && <SuccessNotice>{forgotMessage}</SuccessNotice>}

        <PremiumButton
          label="RESET PASSWORD"
          loading={forgotLoading}
          loadingLabel="RESETTING..."
        />

        <button
          type="button"
          onClick={returnToCodeStep}
          disabled={forgotLoading}
          style={textActionStyle}
        >
          ← Back to code
        </button>
      </form>
    );
  }

  return (
    <main className="login-page">
      <video
        ref={videoRef}
        className="login-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      >
        <source src="/media/background.mp4" type="video/mp4" />
      </video>

      <div className="login-overlay" />
      <div className="login-vignette" />
      <div className="login-light login-light-one" />
      <div className="login-light login-light-two" />

      <div className="login-particles">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index} />
        ))}
      </div>

      <div className="login-brand">
        <span className="brand-line" />
        <span>TRYΝDA BUSINESS</span>
        <span className="brand-line" />
      </div>

      <button
        type="button"
        className="sound-button login-sound"
        onClick={toggleSound}
        aria-label={muted ? "Turn sound on" : "Mute sound"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <section className="login-ice-panel">
        <div className="ice-glass" />
        <div className="ice-border" />
        <div className="ice-shine" />
        <div className="ice-corner ice-corner-top" />
        <div className="ice-corner ice-corner-bottom" />

        <div className="login-panel-header">
          <div className="login-logo-wrap">
            <div className="logo-ring" />
            <div className="logo-ring-two" />
            <img
              src="/media/logo.png"
              alt="Trynda Business"
              className="login-logo"
            />
          </div>

          <div className="login-status">
            <span className="status-dot" />
            SYSTEM ONLINE
          </div>
        </div>

        <div className="login-heading">
          <div className="eyebrow">
            <span />
            ADMINISTRATOR ACCESS
          </div>

          <h1>
            Welcome
            <br />
            <strong>Back.</strong>
          </h1>

          <p>Access your Trynda Business control center.</p>
        </div>

        <form className="login-form premium-login-form" onSubmit={handleSubmit}>
          <label>
            <span className="input-label">EMAIL ADDRESS</span>
            <div className="input-wrap">
              <span className="input-icon">@</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="username"
                required
              />
              <span className="input-line" />
            </div>
          </label>

          <label>
            <span className="input-label">PASSWORD</span>
            <div className="input-wrap">
              <span className="input-icon">•••</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <span className="input-line" />
            </div>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={openForgotPassword}
              style={forgotPasswordStyle}
            >
              Forgot password?
            </button>
          </div>

          <ErrorNotice message={error} />

          <PremiumButton
            label="SIGN IN"
            loading={loading}
            loadingLabel="AUTHENTICATING..."
          />
        </form>

        <div className="login-footer">
          <span>SECURE ADMIN ENVIRONMENT</span>
          <span className="footer-separator">/</span>
          <span>TRYΝDA BUSINESS</span>
        </div>
      </section>

      <div className="login-side-info">
        <div className="side-line" />
        <div>
          <span>BUSINESS</span>
          <strong>CONTROL</strong>
        </div>
      </div>

      <div className="login-bottom-status">
        <span className="live-dot" />
        <span>SYSTEM READY</span>
      </div>

      {showForgot && (
        <div
          onMouseDown={handleRecoveryBackdropMouseDown}
          style={recoveryOverlayStyle}
        >
          <div style={recoveryModalStyle}>
            <div style={recoveryHeaderStyle}>
              <div>
                <div style={recoveryEyebrowStyle}>ACCOUNT RECOVERY</div>
                <h2 style={{ margin: 0, fontSize: "24px" }}>Reset Password</h2>
                <p className="muted" style={recoveryDescriptionStyle}>
                  Securely recover your administrator account.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForgotPassword}
                disabled={forgotLoading}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            {renderRecoveryStep()}
          </div>
        </div>
      )}
    </main>
  );
}
