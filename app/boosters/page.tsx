"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booster = {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
  active: boolean;
  createdAt: string;

  platformFeePercent: number;
  extraPenaltyPercent: number;

  balanceUsd: number;
  totalEarnedUsd: number;
  totalPaidUsd: number;

  ordersCount: number;
  paymentsCount: number;
};

function toSafeNumber(value: unknown) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function formatMoney(value: unknown) {
  const amount = toSafeNumber(value);

  if (amount < 0) {
    return `-$${Math.abs(amount).toFixed(2)}`;
  }

  return `$${amount.toFixed(2)}`;
}

export default function BoostersPage() {
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // ADD BOOSTER MODAL
  // =====================================================

  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPlatformFee, setNewPlatformFee] = useState("7");
  const [newExtraPenalty, setNewExtraPenalty] = useState("0");

  // =====================================================
  // EDIT BOOSTER MODAL
  // =====================================================

  const [editingBooster, setEditingBooster] =
    useState<Booster | null>(null);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlatformFee, setEditPlatformFee] =
    useState("7");
  const [editExtraPenalty, setEditExtraPenalty] =
    useState("0");

  // =====================================================
  // PASSWORD MODAL
  // =====================================================

  const [passwordBooster, setPasswordBooster] =
    useState<Booster | null>(null);

  const [newPassword, setNewPassword] = useState("");

  // =====================================================
  // SAVING STATES
  // =====================================================

  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] =
    useState<string | null>(null);

  const [deletingBooster, setDeletingBooster] =
    useState<string | null>(null);

  // =====================================================
  // LOAD BOOSTERS
  // =====================================================

  async function loadBoosters() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load boosters"
        );
      }

      setBoosters(
        Array.isArray(data)
          ? data.map((booster) => ({
              ...booster,
              platformFeePercent: toSafeNumber(
                booster.platformFeePercent
              ),
              extraPenaltyPercent: toSafeNumber(
                booster.extraPenaltyPercent
              ),
              balanceUsd: toSafeNumber(
                booster.balanceUsd
              ),
              totalEarnedUsd: toSafeNumber(
                booster.totalEarnedUsd
              ),
              totalPaidUsd: toSafeNumber(
                booster.totalPaidUsd
              ),
              ordersCount: toSafeNumber(
                booster.ordersCount
              ),
              paymentsCount: toSafeNumber(
                booster.paymentsCount
              ),
            }))
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load boosters"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoosters();
  }, []);

  // =====================================================
  // ADD BOOSTER
  // =====================================================

  function openAddModal() {
    setName("");
    setEmail("");
    setPassword("");

    setNewPlatformFee("7");
    setNewExtraPenalty("0");

    setError("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (saving) {
      return;
    }

    setShowAddModal(false);
    setError("");
  }

  async function createBooster(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const platformFee =
      Number(newPlatformFee);

    const extraPenalty =
      Number(newExtraPenalty);

    if (
      !Number.isFinite(platformFee) ||
      platformFee < 0 ||
      platformFee > 100
    ) {
      setError(
        "Platform Fee must be between 0 and 100."
      );
      return;
    }

    if (
      !Number.isFinite(extraPenalty) ||
      extraPenalty < 0 ||
      extraPenalty > 100
    ) {
      setError(
        "Extra Penalty must be between 0 and 100."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
            platformFeePercent:
              platformFee,
            extraPenaltyPercent:
              extraPenalty,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create booster"
        );
      }

      setShowAddModal(false);

      await loadBoosters();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create booster"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // EDIT BOOSTER
  // =====================================================

  function openEditModal(
    booster: Booster
  ) {
    setEditingBooster(booster);

    setEditName(booster.name);
    setEditEmail(booster.email);

    setEditPlatformFee(
      String(
        booster.platformFeePercent
      )
    );

    setEditExtraPenalty(
      String(
        booster.extraPenaltyPercent
      )
    );

    setError("");
  }

  function closeEditModal() {
    if (saving) {
      return;
    }

    setEditingBooster(null);
    setError("");
  }

  async function saveBoosterEdit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingBooster) {
      return;
    }

    const platformFee =
      Number(editPlatformFee);

    const extraPenalty =
      Number(editExtraPenalty);

    if (
      !Number.isFinite(platformFee) ||
      platformFee < 0 ||
      platformFee > 100
    ) {
      setError(
        "Platform Fee must be between 0 and 100."
      );
      return;
    }

    if (
      !Number.isFinite(extraPenalty) ||
      extraPenalty < 0 ||
      extraPenalty > 100
    ) {
      setError(
        "Extra Penalty must be between 0 and 100."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            boosterId:
              editingBooster.id,

            action: "edit",

            name: editName,
            email: editEmail,

            platformFeePercent:
              platformFee,

            extraPenaltyPercent:
              extraPenalty,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update booster"
        );
      }

      setEditingBooster(null);

      await loadBoosters();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update booster"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  function openPasswordModal(
    booster: Booster
  ) {
    setPasswordBooster(booster);
    setNewPassword("");
    setError("");
  }

  function closePasswordModal() {
    if (saving) {
      return;
    }

    setPasswordBooster(null);
    setNewPassword("");
    setError("");
  }

  async function changePassword(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!passwordBooster) {
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            boosterId:
              passwordBooster.id,
            password:
              newPassword,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to change password"
        );
      }

      setPasswordBooster(null);
      setNewPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to change password"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // TOGGLE BOOSTER
  // =====================================================

  async function toggleBooster(
    booster: Booster
  ) {
    const action =
      booster.active
        ? "disable"
        : "enable";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${action} "${booster.name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setChangingStatus(booster.id);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            boosterId:
              booster.id,
            action: "toggle",
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update booster status"
        );
      }

      await loadBoosters();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update booster status"
      );
    } finally {
      setChangingStatus(null);
    }
  }

  // =====================================================
  // DELETE BOOSTER
  // =====================================================

  async function deleteBooster(
    booster: Booster
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to permanently delete "${booster.name}"?\n\nThe booster account will be deleted, but historical orders, payments and fines will be preserved.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBooster(booster.id);
      setError("");

      const response = await fetch(
        "/api/boosters",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            boosterId:
              booster.id,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete booster"
        );
      }

      await loadBoosters();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete booster"
      );
    } finally {
      setDeletingBooster(null);
    }
  }

  // =====================================================
  // STATISTICS
  // =====================================================

  const totalOrders =
    boosters.reduce(
      (sum, booster) =>
        sum +
        toSafeNumber(booster.ordersCount),
      0
    );

  const activeBoosters =
    boosters.filter(
      (booster) =>
        booster.active
    ).length;

  const inactiveBoosters =
    boosters.length -
    activeBoosters;

  const totalBalance =
    boosters.reduce(
      (sum, booster) =>
        sum +
        toSafeNumber(booster.balanceUsd),
      0
    );

  const totalEarned =
    boosters.reduce(
      (sum, booster) =>
        sum +
        toSafeNumber(booster.totalEarnedUsd),
      0
    );

  const totalPaid =
    boosters.reduce(
      (sum, booster) =>
        sum +
        toSafeNumber(booster.totalPaidUsd),
      0
    );

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

          <Link
            href="/boosters"
            className="active"
          >
            👥 Boosters
          </Link>

          <Link href="/orders">
            📦 Orders
          </Link>

          <Link href="/payments">
            💰 Payments
          </Link>

          <Link href="/settings">
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
            <h1>Boosters</h1>

            <p>
              Manage booster accounts,
              balances and fee settings.
            </p>
          </div>

          <button
            type="button"
            onClick={
              openAddModal
            }
          >
            + Add Booster
          </button>
        </header>

        {/* =================================================
            TOP STATS
        ================================================= */}

        <div className="stats">
          <div className="stat dashboard-stat">
            <span>
              Total Boosters
            </span>

            <strong>
              {boosters.length}
            </strong>

            <small>
              All booster accounts
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              Active Boosters
            </span>

            <strong
              style={{
                color:
                  "#6ee7b7",
              }}
            >
              {activeBoosters}
            </strong>

            <small>
              Currently active
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              Inactive Boosters
            </span>

            <strong
              style={{
                color:
                  inactiveBoosters >
                  0
                    ? "#fca5a5"
                    : "#8995ab",
              }}
            >
              {inactiveBoosters}
            </strong>

            <small>
              Disabled accounts
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              Total Orders
            </span>

            <strong>
              {totalOrders}
            </strong>

            <small>
              Assigned orders
            </small>
          </div>
        </div>

        {/* =================================================
            FINANCIAL STATS
        ================================================= */}

        <div className="stats">
          <div className="stat">
            <span>
              Current Balance
            </span>

            <strong
              style={{
                color:
                  totalBalance <
                  0
                    ? "#fca5a5"
                    : "#6ee7b7",
              }}
            >
              {formatMoney(
                totalBalance
              )}
            </strong>

            <small>
              Current available balance
            </small>
          </div>

          <div className="stat">
            <span>
              Total Earned
            </span>

            <strong>
              {formatMoney(
                totalEarned
              )}
            </strong>

            <small>
              Lifetime booster earnings
            </small>
          </div>

          <div className="stat">
            <span>
              Total Paid
            </span>

            <strong>
              {formatMoney(
                totalPaid
              )}
            </strong>

            <small>
              Lifetime payments
            </small>
          </div>
        </div>

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
            BOOSTERS TABLE
        ================================================= */}

        <section className="panel">
          <div
            className="section-header"
            style={{
              marginBottom: "20px",
            }}
          >
            <div>
              <h2>
                All Boosters
              </h2>

              <p>
                Manage accounts,
                percentages and access.
              </p>
            </div>

            <button
              type="button"
              onClick={
                loadBoosters
              }
              disabled={loading}
              className="refresh-boosters-button"
            >
              <span
                className={
                  loading
                    ? "refresh-icon spinning"
                    : "refresh-icon"
                }
              >
                🔄
              </span>

              <span>
                {loading
                  ? "Refreshing..."
                  : "Refresh"}
              </span>
            </button>
          </div>

          {loading ? (
            <div className="empty">
              Loading boosters...
            </div>
          ) : boosters.length ===
            0 ? (
            <div className="empty">
              <div className="empty-icon">
                👥
              </div>

              <h3>
                No boosters yet
              </h3>

              <p>
                Add your first booster
                to get started.
              </p>

              <button
                className="empty-action"
                type="button"
                onClick={
                  openAddModal
                }
              >
                Add Booster
              </button>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth:
                    "1350px",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Booster
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Orders
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Platform Fee
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Extra Penalty
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Balance
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Total Earned
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Total Paid
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                        minWidth:
                          "280px",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {boosters.map(
                    (booster) => {
                      const hasDebt =
                        booster.balanceUsd <
                        0;

                      const isChanging =
                        changingStatus ===
                        booster.id;

                      const isDeleting =
                        deletingBooster ===
                        booster.id;

                      return (
                        <tr
                          key={
                            booster.id
                          }
                        >
                          {/* BOOSTER */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <div className="admin-booster-identity">
                              <div
                                className={
                                  booster.profileImageUrl
                                    ? "admin-booster-avatar has-image"
                                    : "admin-booster-avatar"
                                }
                              >
                                {booster.profileImageUrl ? (
                                  <img
                                    src={booster.profileImageUrl}
                                    alt=""
                                  />
                                ) : (
                                  booster.name
                                    .charAt(0)
                                    .toUpperCase()
                                )}
                              </div>

                              <div>
                                <strong>
                                  {booster.name}
                                </strong>

                                <div
                                  className="muted"
                                  style={{
                                    fontSize:
                                      "12px",
                                    marginTop:
                                      "5px",
                                  }}
                                >
                                  {booster.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* ORDERS */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong>
                              {
                                booster.ordersCount
                              }
                            </strong>
                          </td>

                          {/* PLATFORM FEE */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  "#c4bfff",
                              }}
                            >
                              {
                                booster.platformFeePercent
                              }
                              %
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
                              Default fee
                            </div>
                          </td>

                          {/* EXTRA PENALTY */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  booster.extraPenaltyPercent >
                                  0
                                    ? "#fca5a5"
                                    : "#8995ab",
                              }}
                            >
                              {
                                booster.extraPenaltyPercent
                              }
                              %
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
                              Additional
                            </div>
                          </td>

                          {/* BALANCE */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  hasDebt
                                    ? "#fca5a5"
                                    : booster.balanceUsd >
                                      0
                                    ? "#6ee7b7"
                                    : "#8995ab",
                              }}
                            >
                              {formatMoney(
                                booster.balanceUsd
                              )}
                            </strong>

                            {hasDebt && (
                              <div
                                style={{
                                  color:
                                    "#fca5a5",
                                  fontSize:
                                    "11px",
                                  marginTop:
                                    "4px",
                                  fontWeight:
                                    600,
                                }}
                              >
                                Owes money
                              </div>
                            )}
                          </td>

                          {/* EARNED */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong>
                              {formatMoney(
                                booster.totalEarnedUsd
                              )}
                            </strong>
                          </td>

                          {/* PAID */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <strong>
                              {formatMoney(
                                booster.totalPaidUsd
                              )}
                            </strong>
                          </td>

                          {/* STATUS */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap:
                                  "6px",
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  "999px",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  700,
                                background:
                                  booster.active
                                    ? "rgba(34,197,94,0.1)"
                                    : "rgba(239,68,68,0.1)",
                                color:
                                  booster.active
                                    ? "#6ee7b7"
                                    : "#fca5a5",
                              }}
                            >
                              <span>
                                ●
                              </span>

                              {booster.active
                                ? "ACTIVE"
                                : "INACTIVE"}
                            </span>
                          </td>

                          {/* ACTIONS */}

                          <td
                            style={{
                              padding:
                                "17px 14px",
                              borderTop:
                                "1px solid #202a42",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                flexWrap:
                                  "wrap",
                                gap:
                                  "7px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    booster
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 11px",
                                  border:
                                    "1px solid rgba(109,93,252,0.3)",
                                  borderRadius:
                                    "9px",
                                  background:
                                    "rgba(109,93,252,0.1)",
                                  color:
                                    "#c4bfff",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openPasswordModal(
                                    booster
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 11px",
                                  border:
                                    "1px solid rgba(96,165,250,0.25)",
                                  borderRadius:
                                    "9px",
                                  background:
                                    "rgba(96,165,250,0.08)",
                                  color:
                                    "#93c5fd",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Password
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleBooster(
                                    booster
                                  )
                                }
                                disabled={
                                  isChanging
                                }
                                style={{
                                  padding:
                                    "8px 11px",
                                  border:
                                    booster.active
                                      ? "1px solid rgba(239,68,68,0.3)"
                                      : "1px solid rgba(34,197,94,0.3)",
                                  borderRadius:
                                    "9px",
                                  background:
                                    booster.active
                                      ? "rgba(239,68,68,0.08)"
                                      : "rgba(34,197,94,0.08)",
                                  color:
                                    booster.active
                                      ? "#fca5a5"
                                      : "#6ee7b7",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  cursor:
                                    isChanging
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity:
                                    isChanging
                                      ? 0.6
                                      : 1,
                                }}
                              >
                                {isChanging
                                  ? "..."
                                  : booster.active
                                  ? "Disable"
                                  : "Enable"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteBooster(
                                    booster
                                  )
                                }
                                disabled={
                                  isDeleting
                                }
                                style={{
                                  padding:
                                    "8px 11px",
                                  border:
                                    "1px solid rgba(239,68,68,0.3)",
                                  borderRadius:
                                    "9px",
                                  background:
                                    "rgba(239,68,68,0.08)",
                                  color:
                                    "#fca5a5",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  cursor:
                                    isDeleting
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity:
                                    isDeleting
                                      ? 0.6
                                      : 1,
                                }}
                              >
                                {isDeleting
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* =================================================
          ADD BOOSTER MODAL
      ================================================= */}

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0,0,0,0.76)",
            overflowY: "auto",
          }}
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddModal();
            }
          }}
        >
          <div
            style={{
              width:
                "min(520px, 100%)",
              padding: "28px",
              borderRadius:
                "20px",
              border:
                "1px solid #29344d",
              background:
                "#10172a",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.6)",
            }}
          >
            <h2
              style={{
                margin:
                  "0 0 6px",
              }}
            >
              Add Booster
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              Create a booster account
              and define its default
              fee settings.
            </p>

            <form
              onSubmit={
                createBooster
              }
              style={{
                display:
                  "grid",
                gap: "16px",
              }}
            >
              <label className="login-form">
                <span>
                  Name
                </span>

                <input
                  value={name}
                  onChange={(
                    event
                  ) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Booster name"
                  required
                />
              </label>

              <label className="login-form">
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="booster@example.com"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="login-form">
                <span>
                  Password
                </span>

                <input
                  type="password"
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap:
                    "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    Platform Fee %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      newPlatformFee
                    }
                    onChange={(
                      event
                    ) =>
                      setNewPlatformFee(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label className="login-form">
                  <span>
                    Extra Penalty %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      newExtraPenalty
                    }
                    onChange={(
                      event
                    ) =>
                      setNewExtraPenalty(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap:
                    "10px",
                  marginTop:
                    "5px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeAddModal
                  }
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                    border:
                      "1px solid #2b3550",
                    borderRadius:
                      "10px",
                    background:
                      "#1a2340",
                    color:
                      "#eef2ff",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                  }}
                >
                  {saving
                    ? "Creating..."
                    : "Create Booster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          EDIT BOOSTER MODAL
      ================================================= */}

      {editingBooster && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0,0,0,0.76)",
            overflowY: "auto",
          }}
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >
          <div
            style={{
              width:
                "min(520px, 100%)",
              padding: "28px",
              borderRadius:
                "20px",
              border:
                "1px solid #29344d",
              background:
                "#10172a",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.6)",
            }}
          >
            <h2
              style={{
                margin:
                  "0 0 6px",
              }}
            >
              Edit Booster
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              Update account information
              and default fee settings.
            </p>

            <form
              onSubmit={
                saveBoosterEdit
              }
              style={{
                display:
                  "grid",
                gap: "16px",
              }}
            >
              <label className="login-form">
                <span>
                  Name
                </span>

                <input
                  value={
                    editName
                  }
                  onChange={(
                    event
                  ) =>
                    setEditName(
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label className="login-form">
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={
                    editEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setEditEmail(
                      event.target.value
                    )
                  }
                  autoComplete="username"
                  required
                />
              </label>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap:
                    "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    Platform Fee %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      editPlatformFee
                    }
                    onChange={(
                      event
                    ) =>
                      setEditPlatformFee(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label className="login-form">
                  <span>
                    Extra Penalty %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      editExtraPenalty
                    }
                    onChange={(
                      event
                    ) =>
                      setEditExtraPenalty(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap:
                    "10px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                    border:
                      "1px solid #2b3550",
                    borderRadius:
                      "10px",
                    background:
                      "#1a2340",
                    color:
                      "#eef2ff",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          CHANGE PASSWORD MODAL
      ================================================= */}

      {passwordBooster && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0,0,0,0.76)",
          }}
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePasswordModal();
            }
          }}
        >
          <div
            style={{
              width:
                "min(440px, 100%)",
              padding: "28px",
              borderRadius:
                "20px",
              border:
                "1px solid #29344d",
              background:
                "#10172a",
              boxShadow:
                "0 30px 100px rgba(0,0,0,0.6)",
            }}
          >
            <h2
              style={{
                margin:
                  "0 0 6px",
              }}
            >
              Change Password
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              Change the password for{" "}
              <strong
                style={{
                  color:
                    "#eef2ff",
                }}
              >
                {
                  passwordBooster.name
                }
              </strong>
              .
            </p>

            <form
              onSubmit={
                changePassword
              }
              style={{
                display:
                  "grid",
                gap: "16px",
              }}
            >
              <label className="login-form">
                <span>
                  New Password
                </span>

                <input
                  type="password"
                  value={
                    newPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap:
                    "10px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closePasswordModal
                  }
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                    border:
                      "1px solid #2b3550",
                    borderRadius:
                      "10px",
                    background:
                      "#1a2340",
                    color:
                      "#eef2ff",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      "10px 16px",
                  }}
                >
                  {saving
                    ? "Changing..."
                    : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}