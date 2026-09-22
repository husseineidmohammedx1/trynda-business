"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/app/language-provider";

type BoosterOrderDetail = {
  orderId: string;
  title: string;
  status: string;

  originalUsd: number;
  platformFeeUsd: number;
  extraPenaltyUsd: number;
  boosterAmountUsd: number;
  finedUsd: number;
  netAmountUsd: number;

  exchangeRate: number;
  originalEgp: number;
  amountEgp: number;

  paidAmountUsd: number;
  paidExchangeRate: number | null;
  paidAmountEgp: number | null;

  paymentStatus: string;
  completedAt: string | null;
  releaseAt: string | null;
  paidAt: string | null;

  platformFeePercent: number;
  extraPenaltyPercent: number;
  createdAt: string;
};

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
  totalPaidEgp: number;
  paidExchangeRate: number | null;

  ordersCount: number;
  paymentsCount: number;
  totalGrossUsd: number;
  onHoldUsd: number;
  finedUsd: number;
  details: BoosterOrderDetail[];
};

function formatMoney(value: number) {
  const amount = Number(value || 0);

  if (amount < 0) {
    return `-$${Math.abs(amount).toFixed(2)}`;
  }

  return `$${amount.toFixed(2)}`;
}


function formatEgp(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) {
    return "—";
  }

  return `${Number(value).toFixed(2)} EGP`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDetailAfterFeeLabel(detail: BoosterOrderDetail, isArabic: boolean) {
  const fee = Number(detail.platformFeeUsd || 0);
  const penalty = Number(detail.extraPenaltyUsd || 0);
  const fine = Number(detail.finedUsd || 0);

  if (fee > 0 || penalty > 0 || fine > 0) {
    return isArabic ? "بعد الخصومات" : "After deductions";
  }

  return isArabic ? "بعد الرسوم" : "After fee";
}

export default function BoostersPage() {
  const { isArabic } = useLanguage();

  const t = (en: string, ar: string) => (isArabic ? ar : en);

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

  const [expandedBooster, setExpandedBooster] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] =
    useState<string | null>(null);

  const [deletingBooster, setDeletingBooster] =
    useState<string | null>(null);

  const [exchangeRate, setExchangeRate] =
    useState<number | null>(null);

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
          ? data
          : []
      );

      const exchangeResponse = await fetch(
        "/api/exchange-rate",
        { cache: "no-store" }
      );

      if (exchangeResponse.ok) {
        const exchangeData =
          (await exchangeResponse.json()) as {
            rate?: number | string;
          };

        const rate = Number(exchangeData.rate);

        setExchangeRate(
          Number.isFinite(rate) && rate > 0
            ? rate
            : null
        );
      }
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
        Number(
          booster.ordersCount || 0
        ),
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
        Number(
          booster.balanceUsd || 0
        ),
      0
    );

  const totalEarned =
    boosters.reduce(
      (sum, booster) =>
        sum +
        Number(
          booster.totalEarnedUsd ||
            0
        ),
      0
    );

  const totalPaid =
    boosters.reduce(
      (sum, booster) =>
        sum +
        Number(
          booster.totalPaidUsd ||
            0
        ),
      0
    );

  const totalPaidEgp =
    boosters.reduce(
      (sum, booster) =>
        sum +
        Number(
          booster.totalPaidEgp ||
            0
        ),
      0
    );

  const totalPaidExchangeRate =
    totalPaid > 0 && totalPaidEgp > 0
      ? totalPaidEgp / totalPaid
      : null;

  const totalBalanceEgp =
    exchangeRate !== null
      ? totalBalance * exchangeRate
      : null;

  return (
    <div className="shell boosters-page">
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
            📊 {t("Dashboard", "لوحة التحكم")}
          </Link>

          <Link
            href="/boosters"
            className="active"
          >
            👥 {t("Boosters", "البوسترز")}
          </Link>

          <Link href="/orders">
            📦 {t("Orders", "الطلبات")}
          </Link>

          <Link href="/payments">
            💰 {t("Payments", "المدفوعات")}
          </Link>

          <Link href="/settings">
            ⚙️ {t("Settings", "الإعدادات")}
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
          🚪 {t("Logout", "تسجيل الخروج")}
        </button>
      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="content">
        <header>
          <div>
            <h1>{t("Boosters", "البوسترز")}</h1>

            <p>
              {t(
                "Manage booster accounts, balances and fee settings.",
                "إدارة حسابات البوسترز والأرصدة وإعدادات الرسوم."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={
              openAddModal
            }
          >
            + {t("Add Booster", "إضافة بوستر")}
          </button>
        </header>

        {/* =================================================
            TOP STATS
        ================================================= */}

        <div className="stats">
          <div className="stat dashboard-stat">
            <span>
              {t("Total Boosters", "إجمالي البوسترز")}
            </span>

            <strong>
              {boosters.length}
            </strong>

            <small>
              {t("All booster accounts", "جميع حسابات البوسترز")}
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              {t("Active Boosters", "البوسترز النشطون")}
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
              {t("Currently active", "النشطون حاليًا")}
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              {t("Inactive Boosters", "البوسترز غير النشطين")}
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
              {t("Disabled accounts", "الحسابات المعطلة")}
            </small>
          </div>

          <div className="stat dashboard-stat">
            <span>
              {t("Total Orders", "إجمالي الطلبات")}
            </span>

            <strong>
              {totalOrders}
            </strong>

            <small>
              {t("Assigned orders", "الطلبات المسندة")}
            </small>
          </div>
        </div>

        {/* =================================================
            FINANCIAL STATS
        ================================================= */}

        <div className="stats">
          <div className="stat">
            <span>
              {t("Current Balance", "الرصيد الحالي")}
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

            <span className="payment-balance-egp-label">
              {exchangeRate !== null
                ? `${t("Current USD rate", "سعر الدولار الحالي")}: ${exchangeRate.toFixed(4)} EGP`
                : t("Current USD rate: loading...", "سعر الدولار الحالي: جاري التحميل...")}
            </span>

            <strong className="payment-balance-egp">
              {exchangeRate !== null
                ? formatEgp(totalBalanceEgp)
                : "—"}
            </strong>

            <small>
              {t("Current available balance", "الرصيد المتاح حاليًا")}
            </small>
          </div>

          <div className="stat">
            <span>
              {t("Total Earned", "إجمالي الأرباح")}
            </span>

            <strong>
              {formatMoney(
                totalEarned
              )}
            </strong>

            <small>
              {t("Lifetime booster earnings", "إجمالي أرباح البوسترز منذ البداية")}
            </small>
          </div>

          <div className="stat">
            <span>
              {t("Total Paid", "إجمالي المدفوع")}
            </span>

            <strong>
              {formatMoney(
                totalPaid
              )}
            </strong>

            <span className="payment-balance-egp-label">
              {totalPaidExchangeRate !== null
                ? `${t("Effective paid USD rate", "سعر الدولار الفعلي وقت الدفع")}: ${totalPaidExchangeRate.toFixed(4)} EGP`
                : t("Historical payment rate", "سعر الصرف التاريخي للمدفوعات")}
            </span>

            <strong className="payment-balance-egp">
              {totalPaidEgp > 0
                ? formatEgp(totalPaidEgp)
                : "—"}
            </strong>

            <small>
              {t("Fixed from payment-time exchange rates", "ثابت حسب أسعار الصرف وقت الدفع")}
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
                {t("All Boosters", "كل البوسترز")}
              </h2>

              <p>
                {t(
                  "Manage accounts, percentages and access.",
                  "إدارة الحسابات والنسب والصلاحيات."
                )}
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
              {t("Loading boosters...", "جارٍ تحميل البوسترز...")}
            </div>
          ) : boosters.length ===
            0 ? (
            <div className="empty">
              <div className="empty-icon">
                👥
              </div>

              <h3>
                {t("No boosters yet", "لا يوجد بوسترز حتى الآن")}
              </h3>

              <p>
                {t(
                  "Add your first booster to get started.",
                  "أضف أول بوستر للبدء."
                )}
              </p>

              <button
                className="empty-action"
                type="button"
                onClick={
                  openAddModal
                }
              >
                {t("Add Booster", "إضافة بوستر")}
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
                    "1380px",
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
                      {t("Booster", "البوستر")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Orders", "الطلبات")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Platform Fee", "رسوم المنصة")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Extra Penalty", "الخصم الإضافي")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Balance", "الرصيد")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Total Earned", "إجمالي الأرباح")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Total Paid", "إجمالي المدفوع")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                      }}
                    >
                      {t("Status", "الحالة")}
                    </th>

                    <th
                      style={{
                        padding:
                          "15px 14px",
                        minWidth:
                          "280px",
                      }}
                    >
                      {t("Actions", "الإجراءات")}
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

                      const expanded =
                        expandedBooster === booster.id;

                      return (
                        <Fragment>
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
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBooster(
                                  expanded ? null : booster.id
                                )
                              }
                              aria-expanded={expanded}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                width: "100%",
                                minWidth: 0,
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                color: "inherit",
                                textAlign: "left",
                                cursor: "pointer",
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  width: "44px",
                                  height: "44px",
                                  minWidth: "44px",
                                  borderRadius: "12px",
                                  overflow: "hidden",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "linear-gradient(135deg, #1d2842 0%, #111827 100%)",
                                  border: "1px solid rgba(148,163,184,0.18)",
                                  color: "#c4bfff",
                                  fontSize: "16px",
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {booster.profileImageUrl ? (
                                  <img
                                    src={booster.profileImageUrl}
                                    alt={`${booster.name} profile`}
                                    loading="lazy"
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                ) : (
                                  booster.name
                                    .charAt(0)
                                    .toUpperCase()
                                )}
                              </span>

                              <div
                                style={{
                                  minWidth: 0,
                                }}
                              >
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
                                    overflow: "hidden",
                                    textOverflow:
                                      "ellipsis",
                                  }}
                                >
                                  {booster.email}
                                </div>
                              </div>

                              <span
                                aria-hidden="true"
                                style={{
                                  marginLeft: "auto",
                                  color: "#8995ab",
                                  fontSize: "16px",
                                  lineHeight: 1,
                                  transform: expanded
                                    ? "rotate(180deg)"
                                    : "rotate(0deg)",
                                  transition: "transform 160ms ease",
                                }}
                              >
                                ⌄
                              </span>
                            </button>
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
                              {t("Default fee", "الرسوم الافتراضية")}
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
                              {t("Additional", "إضافي")}
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

                            <div className="payment-row-egp">
                              {exchangeRate !== null
                                ? formatEgp(booster.balanceUsd * exchangeRate)
                                : "—"}
                            </div>

                            <small
                              className="muted"
                              style={{
                                display: "block",
                                marginTop: "3px",
                                fontSize: "10px",
                              }}
                            >
                              {exchangeRate !== null
                                ? `${t("Current rate", "السعر الحالي")}: ${exchangeRate.toFixed(4)} EGP`
                                : t("Current rate: loading...", "السعر الحالي: جاري التحميل...")}
                            </small>

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
                                {t("Owes money", "عليه مبلغ مستحق")}
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

                            {booster.totalPaidEgp > 0 && (
                              <div className="payment-row-egp">
                                {formatEgp(booster.totalPaidEgp)}
                              </div>
                            )}

                            {booster.paidExchangeRate !== null && (
                              <small
                                className="muted"
                                style={{
                                  display: "block",
                                  marginTop: "3px",
                                  fontSize: "10px",
                                }}
                              >
                                {`${t("Paid rate", "سعر الدفع")}: ${booster.paidExchangeRate.toFixed(4)} EGP`}
                              </small>
                            )}
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
                                {t("Edit", "تعديل")}
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
                                {t("Password", "كلمة المرور")}
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
                                  ? t("Disable", "تعطيل")
                                  : t("Enable", "تفعيل")}
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
                                  ? t("Deleting...", "جارٍ الحذف...")
                                  : t("Delete", "حذف")}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr>
                            <td
                              colSpan={9}
                              style={{
                                padding: 0,
                                borderTop: "1px solid rgba(117,104,255,0.14)",
                                background: "rgba(117,104,255,0.025)",
                              }}
                            >
                              <div
                                style={{
                                  padding: "16px 14px 18px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    marginBottom: "12px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <strong
                                      style={{
                                        color: "#f8fafc",
                                        fontSize: "14px",
                                      }}
                                    >
                                      {booster.name} — {t("Order history", "سجل الطلبات")}
                                    </strong>
                                    <div
                                      className="muted"
                                      style={{
                                        marginTop: "4px",
                                        fontSize: "11px",
                                      }}
                                    >
                                      {t(
                                        "Before vs. after deductions, plus the historical USD → EGP rate for each order.",
                                        "مقارنة المبلغ قبل وبعد الخصومات، مع سعر تحويل الدولار إلى الجنيه وقت كل طلب."
                                      )}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <span className="ui-chip">
                                      {t("Gross", "الإجمالي")} {formatMoney(booster.totalGrossUsd)}
                                    </span>
                                    <span className="ui-chip ui-chip--success">
                                      {t("Earned", "الأرباح")} {formatMoney(booster.totalEarnedUsd)}
                                    </span>
                                    {booster.finedUsd > 0 && (
                                      <span className="ui-chip ui-chip--danger">
                                        {t("Fined", "الخصومات")} {formatMoney(booster.finedUsd)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {booster.details.length === 0 ? (
                                  <div className="empty" style={{ minHeight: 120 }}>
                                    {t("No order history found for this booster.", "لا يوجد سجل طلبات لهذا البوستر.")}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      overflowX: "auto",
                                      border: "1px solid rgba(148,163,184,0.10)",
                                      borderRadius: "12px",
                                    }}
                                  >
                                    <table
                                      style={{
                                        width: "100%",
                                        minWidth: "1500px",
                                        borderCollapse: "collapse",
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th>{t("Order", "الطلب")}</th>
                                          <th>{t("Status", "الحالة")}</th>
                                          <th>{t("Before ($)", "قبل ($)")}</th>
                                          <th>{t("Platform Fee", "رسوم المنصة")}</th>
                                          <th>{t("Extra / Fine", "إضافي / غرامة")}</th>
                                          <th>{t("After ($)", "بعد ($)")}</th>
                                          <th>{t("Rate", "السعر")}</th>
                                          <th>{t("Before (EGP)", "قبل (جنيه)")}</th>
                                          <th>{t("After (EGP)", "بعد (جنيه)")}</th>
                                          <th>{t("Paid ($)", "المدفوع ($)")}</th>
                                          <th>{t("Paid (EGP)", "المدفوع (جنيه)")}</th>
                                          <th>{t("Completed", "مكتمل")}</th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {booster.details.map((detail) => {
                                          const status = String(detail.status || "").toUpperCase();
                                          const paymentStatus = String(detail.paymentStatus || "").toUpperCase();
                                          const statusText = paymentStatus === "PAID"
                                            ? t("PAID", "مدفوع")
                                            : status === "COMPLETED"
                                            ? t("COMPLETED", "مكتمل")
                                            : status === "IN_PROGRESS"
                                            ? t("IN_PROGRESS", "قيد التنفيذ")
                                            : status === "CANCELLED"
                                            ? t("CANCELLED", "ملغي")
                                            : status || paymentStatus || "—";

                                          const afterLabel = getDetailAfterFeeLabel(detail, isArabic);

                                          return (
                                            <tr key={detail.orderId}>
                                              <td
                                                style={{
                                                  padding: "13px 10px",
                                                  verticalAlign: "top",
                                                  minWidth: "260px",
                                                }}
                                              >
                                                <strong
                                                  style={{
                                                    display: "block",
                                                    color: "#f3f5ff",
                                                    maxWidth: "360px",
                                                  }}
                                                >
                                                  {detail.title || detail.orderId}
                                                </strong>
                                                <small
                                                  className="muted"
                                                  style={{
                                                    display: "block",
                                                    marginTop: "5px",
                                                  }}
                                                >
                                                  {detail.orderId}
                                                </small>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <span className="ui-chip">
                                                  {statusText}
                                                </span>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <strong>{formatMoney(detail.originalUsd)}</strong>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <span style={{ color: "#fcd34d" }}>
                                                  -{formatMoney(detail.platformFeeUsd)}
                                                </span>
                                                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                                                  {detail.platformFeePercent.toFixed(2)}%
                                                </small>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <span style={{ color: detail.finedUsd + detail.extraPenaltyUsd > 0 ? "#fca5a5" : "#8995ab" }}>
                                                  -{formatMoney(detail.extraPenaltyUsd + detail.finedUsd)}
                                                </span>
                                                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                                                  {afterLabel}
                                                </small>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <strong style={{ color: "#6ee7b7" }}>
                                                  {formatMoney(detail.netAmountUsd)}
                                                </strong>
                                                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                                                  {t("booster earnings", "أرباح البوستر")}
                                                </small>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <strong>{detail.exchangeRate.toFixed(4)}</strong>
                                                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                                                  EGP / USD
                                                </small>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <strong>{formatEgp(detail.originalEgp)}</strong>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                <strong style={{ color: "#6ee7b7" }}>
                                                  {formatEgp(detail.amountEgp)}
                                                </strong>
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                {formatMoney(detail.paidAmountUsd)}
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top" }}>
                                                {formatEgp(detail.paidAmountEgp)}
                                                {detail.paidExchangeRate !== null && (
                                                  <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                                                    @ {detail.paidExchangeRate.toFixed(4)}
                                                  </small>
                                                )}
                                              </td>

                                              <td style={{ padding: "13px 10px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                                                {formatDate(detail.completedAt || detail.createdAt)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
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
              {t("Add Booster", "إضافة بوستر")}
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              {t(
                "Create a booster account and define its default fee settings.",
                "أنشئ حساب بوستر وحدد إعدادات الرسوم الافتراضية."
              )}
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
                  {t("Name", "الاسم")}
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
                  {t("Email", "البريد الإلكتروني")}
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
                  {t("Password", "كلمة المرور")}
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
                  placeholder={t("Minimum 8 characters", "8 أحرف على الأقل")}
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
                    {t("Platform Fee %", "رسوم المنصة %")}
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
                    {t("Extra Penalty %", "الخصم الإضافي %")}
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
                  {t("Cancel", "إلغاء")}
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
              {t("Edit Booster", "تعديل البوستر")}
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              {t(
                "Update account information and default fee settings.",
                "تحديث بيانات الحساب وإعدادات الرسوم الافتراضية."
              )}
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
                  {t("Name", "الاسم")}
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
                  {t("Email", "البريد الإلكتروني")}
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
                    {t("Platform Fee %", "رسوم المنصة %")}
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
                    {t("Extra Penalty %", "الخصم الإضافي %")}
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
                  {t("Cancel", "إلغاء")}
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
                    ? t("Saving...", "جارٍ الحفظ...")
                    : t("Save Changes", "حفظ التغييرات")}
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
              {t("Change Password", "تغيير كلمة المرور")}
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "24px",
              }}
            >
              {t("Change the password for", "تغيير كلمة المرور لـ")} {" "}
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
                  {t("New Password", "كلمة المرور الجديدة")}
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
                  placeholder={t("Minimum 8 characters", "8 أحرف على الأقل")}
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
                  {t("Cancel", "إلغاء")}
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
                    ? t("Changing...", "جارٍ التغيير...")
                    : t("Change Password", "تغيير كلمة المرور")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}