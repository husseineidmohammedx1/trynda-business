"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SettingsResponse = {
  id: string;
  businessName: string;
  platformFeePercent: number;
  holdDays: number;
  baseCurrency: string;
  localCurrency: string;
  updatedAt: string;
};

export default function SettingsPage() {
  const [businessName, setBusinessName] =
    useState("Trynda Business");

  const [platformFee, setPlatformFee] =
    useState("7");

  const [holdDays, setHoldDays] =
    useState("5");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  // =====================================================
  // LOAD
  // =====================================================

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/settings",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error ===
            "string"
            ? data.error
            : "Failed to load settings"
        );
      }

      const settings =
        data as SettingsResponse;

      setBusinessName(
        settings.businessName ||
          "Trynda Business"
      );

      setPlatformFee(
        String(
          settings.platformFeePercent
        )
      );

      setHoldDays(
        String(settings.holdDays)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load settings"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSave() {
    const fee =
      Number(platformFee);

    const days =
      Number(holdDays);

    if (
      !Number.isFinite(fee) ||
      fee < 0 ||
      fee > 100
    ) {
      setError(
        "Platform fee must be between 0 and 100."
      );
      return;
    }

    if (
      !Number.isInteger(days) ||
      days < 0 ||
      days > 365
    ) {
      setError(
        "Hold days must be between 0 and 365."
      );
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const response =
        await fetch(
          "/api/settings",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              businessName:
                businessName.trim(),
              platformFeePercent:
                fee,
              holdDays:
                days,
            }),
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error ===
            "string"
            ? data.error
            : "Failed to save settings"
        );
      }

      const result =
        data as {
          settings: SettingsResponse;
        };

      // Set UI from the actual
      // database response.
      setBusinessName(
        result.settings.businessName
      );

      setPlatformFee(
        String(
          result.settings
            .platformFeePercent
        )
      );

      setHoldDays(
        String(
          result.settings.holdDays
        )
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside>
        <Link
          href="/dashboard"
          className="sidebar-brand"
        >
          <div className="sidebar-brand-logo">
            <img
              src="/media/logo.png"
              alt="Trynda Business"
            />
          </div>

          <div className="sidebar-brand-text">
            <strong>TRYΝDA</strong>
            <span>BUSINESS</span>
          </div>
        </Link>

        <nav>
          <Link href="/dashboard">
            📊 Dashboard
          </Link>

          <Link href="/boosters">
            👥 Boosters
          </Link>

          <Link href="/orders">
            📦 Orders
          </Link>

          <Link href="/payments">
            💰 Payments
          </Link>

          <Link
            href="/settings"
            className="active"
          >
            ⚙️ Settings
          </Link>
        </nav>

        <button
          type="button"
          onClick={async () => {
            await fetch(
              "/api/auth/logout",
              {
                method: "POST",
              }
            );

            window.location.href =
              "/login";
          }}
        >
          🚪 Logout
        </button>
      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="content">
        <header>
          <div>
            <h1>
              Settings
            </h1>

            <p>
              Manage your business
              configuration.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "↻ Refresh"}
          </button>
        </header>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            className="login-error"
            style={{
              marginTop: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* =================================================
            BUSINESS
        ================================================= */}

        <section className="panel">
          <div
            style={{
              marginBottom:
                "22px",
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              🏢 Business
            </h2>

            <p className="muted">
              General business
              information.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "18px",
            }}
          >
            <label className="setting-field">
              <span>
                Business Name
              </span>

              <input
                type="text"
                value={businessName}
                onChange={(event) =>
                  setBusinessName(
                    event.target.value
                  )
                }
              />
            </label>

            <div className="setting-card">
              <span>
                Base Currency
              </span>

              <strong>
                USD
              </strong>
            </div>

            <div className="setting-card">
              <span>
                Local Currency
              </span>

              <strong>
                EGP
              </strong>
            </div>

            <div className="setting-card">
              <span>
                System Status
              </span>

              <strong
                style={{
                  color:
                    "#6ee7b7",
                }}
              >
                ● ONLINE
              </strong>
            </div>
          </div>
        </section>

        {/* =================================================
            PAYMENT SETTINGS
        ================================================= */}

        <section
          className="panel"
          style={{
            marginTop: "20px",
          }}
        >
          <div
            style={{
              marginBottom:
                "22px",
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              💰 Payment Settings
            </h2>

            <p className="muted">
              Configure booster
              payment calculations.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "18px",
            }}
          >
            <label className="setting-field">
              <span>
                Platform Fee (%)
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={platformFee}
                disabled={loading || saving}
                onChange={(event) =>
                  setPlatformFee(
                    event.target.value
                  )
                }
              />

              <small>
                Current fee applied to
                new orders.
              </small>
            </label>

            <label className="setting-field">
              <span>
                Payment Hold (Days)
              </span>

              <input
                type="number"
                min="0"
                max="365"
                step="1"
                value={holdDays}
                disabled={loading || saving}
                onChange={(event) =>
                  setHoldDays(
                    event.target.value
                  )
                }
              />

              <small>
                Number of days before
                eligible money becomes
                available.
              </small>
            </label>

            <div
              style={{
                padding:
                  "14px 16px",
                borderRadius:
                  "12px",
                border:
                  "1px solid rgba(139,124,255,0.18)",
                background:
                  "rgba(109,93,252,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color:
                    "#8995ab",
                  marginBottom:
                    "5px",
                }}
              >
                Exchange Rate
              </div>

              <strong
                style={{
                  fontSize:
                    "17px",
                  color:
                    "#c9c3ff",
                }}
              >
                Automatic
              </strong>

              <div
                className="muted"
                style={{
                  fontSize:
                    "11px",
                  marginTop:
                    "4px",
                }}
              >
                USD → EGP rate is
                retrieved automatically
                when needed.
              </div>
            </div>
          </div>

          {/* SAVE */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "flex-end",
              alignItems:
                "center",
              gap: "12px",
              marginTop:
                "24px",
            }}
          >
            {saved && (
              <span
                style={{
                  color:
                    "#6ee7b7",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                }}
              >
                ✓ Settings saved
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={
                loading || saving
              }
              className="settings-save-button"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </section>

        {/* =================================================
            SECURITY
        ================================================= */}

        <section
          className="panel"
          style={{
            marginTop:
              "20px",
          }}
        >
          <div
            style={{
              marginBottom:
                "20px",
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              🔐 Security
            </h2>

            <p className="muted">
              Administrator account
              security.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: "20px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <strong>
                Administrator
              </strong>

              <p
                className="muted"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                Admin account controls
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                alert(
                  "Password change will be added next."
                )
              }
            >
              Change Password
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
