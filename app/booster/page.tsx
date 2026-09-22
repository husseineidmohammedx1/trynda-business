"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/language-provider";

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

type ApiResponse = {
  success?: boolean;
  error?: string;

  booster?: Booster;

  orders?: Record<string, unknown>[];
  notifications?: NotificationItem[];
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type ExchangeRateResponse = {
  rate?: number;
};

type PaymentMethod =
  | "VODAFONE_CASH"
  | "INSTAPAY";

type PaymentHistoryItem = {
  id: string;
  boosterId: string;
  month: string;
  amountUsd: number;
  exchangeRate: number;
  amountEgp: number;
  paymentMethod: PaymentMethod;
  paymentNumber: string;
  paidAt: string;
  createdAt: string;
};

type PaymentHistoryResponse = {
  transactions?: PaymentHistoryItem[];
  error?: string;
};

function formatMoney(value: unknown) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  return `$${number.toFixed(2)}`;
}

function formatEgp(value: unknown) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(2)} جنيه مصري`;
}

function getOrderPayment(order: Record<string, unknown>) {
  const payment = order.payment;

  if (!payment || typeof payment !== "object") {
    return null;
  }

  return payment as Record<string, unknown>;
}

function isCancelledOrder(order: Record<string, unknown>) {
  return String(order.status ?? "").toUpperCase() === "CANCELLED";
}

function getPaymentAmount(
  payment: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = Number(payment[key] ?? fallback);
  return Number.isFinite(value) ? value : 0;
}

function getPaymentReleaseAt(
  payment: Record<string, unknown>
) {
  const value = payment.releaseAt;
  return value ? new Date(String(value)) : null;
}

async function resizeProfileImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Invalid image"));
      image.src = imageUrl;
    });

    const size = 512;
    const sourceSize = Math.min(
      image.width,
      image.height
    );
    const sourceX =
      (image.width - sourceSize) / 2;
    const sourceY =
      (image.height - sourceSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not process image");
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );

    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function formatDate(value: unknown) {
  if (!value) {
    return "—";
  }

  const date = new Date(
    String(value)
  );

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function paymentMethodLabel(
  method: PaymentMethod,
  isArabic: boolean
) {
  if (method === "VODAFONE_CASH") {
    return isArabic ? "فودافون كاش" : "Vodafone Cash";
  }

  return isArabic ? "إنستاباي" : "InstaPay";
}

function formatPaymentHistoryDate(
  value: string | null | undefined,
  isArabic: boolean
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    isArabic ? "ar-EG" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

function prettifyKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function statusClass(value: unknown) {
  const status =
    String(value ?? "")
      .toUpperCase();

  if (
    status === "COMPLETED" ||
    status === "PAID" ||
    status === "AVAILABLE"
  ) {
    return "status-success";
  }

  if (
    status === "CANCELLED" ||
    status === "FAILED"
  ) {
    return "status-danger";
  }

  return "status-warning";
}

function statusLabel(value: unknown) {
  return String(
    value ?? "UNKNOWN"
  )
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function displayValue(
  key: string,
  value: unknown
) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value instanceof Array) {
    return value.join(", ");
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(
      value,
      null,
      2
    );
  }

  const lowerKey =
    key.toLowerCase();

  if (
    lowerKey.includes("password") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("token")
  ) {
    return "••••••••";
  }

  if (
    lowerKey.includes("date") ||
    lowerKey.includes("at") ||
    lowerKey === "created" ||
    lowerKey === "completed"
  ) {
    const parsedDate =
      new Date(String(value));

    if (
      !Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return formatDate(value);
    }
  }

  return String(value);
}

function findOrderStatus(
  order: Record<string, unknown>
) {
  return (
    order.status ??
    order.orderStatus ??
    order.paymentStatus ??
    "UNKNOWN"
  );
}

function findOrderTitle(
  order: Record<string, unknown>
) {
  return (
    order.title ??
    order.name ??
    order.orderTitle ??
    `Order #${String(
      order.id ?? ""
    ).slice(-8)}`
  );
}

function findOrderGame(
  order: Record<string, unknown>
) {
  return (
    order.game ??
    order.gameName ??
    "—"
  );
}

function findOrderPrice(
  order: Record<string, unknown>
) {
  return (
    order.priceUsd ??
    order.orderPriceUsd ??
    order.price ??
    0
  );
}

function findOrderEarnings(
  order: Record<string, unknown>
) {
  return (
    order.netAmountUsd ??
    order.boosterAmountUsd ??
    order.earningsUsd ??
    0
  );
}

export default function BoosterPage() {
  const router = useRouter();
  const { isArabic } = useLanguage();

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [data, setData] =
    useState<ApiResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [exchangeRate, setExchangeRate] =
    useState<number | null>(null);

  const [paymentHistory, setPaymentHistory] =
    useState<PaymentHistoryItem[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [financialSummaryUpdatedAt, setFinancialSummaryUpdatedAt] =
    useState(0);

  const [savingProfileImage, setSavingProfileImage] =
    useState(false);

  const [
    selectedOrder,
    setSelectedOrder,
  ] = useState<
    Record<string, unknown> | null
  >(null);

  const [activeTab, setActiveTab] =
    useState<
      "overview" |
      "orders" |
      "payments"
    >("overview");

  const [showNotifications, setShowNotifications] =
    useState(false);

  async function loadPaymentHistory() {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        "/api/booster/payment-history",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result =
        (await response.json()) as PaymentHistoryResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to load payment history"
        );
      }

      setPaymentHistory(
        Array.isArray(result.transactions)
          ? result.transactions
          : []
      );
    } catch (requestError) {
      console.error(
        "Failed to load payment history:",
        requestError
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadPortal(
    refresh = false
  ) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(
        "/api/booster/me",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result =
        (await response.json()) as ApiResponse;

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to load booster portal"
        );
      }

      setData(result);
      setFinancialSummaryUpdatedAt(Date.now());
      const exchangeResponse = await fetch(
        "/api/exchange-rate",
        {
          cache: "no-store",
        }
      );

      if (exchangeResponse.ok) {
        const exchangeResult =
          (await exchangeResponse.json()) as ExchangeRateResponse;
        const rate = Number(exchangeResult.rate);

        setExchangeRate(
          Number.isFinite(rate) && rate > 0
            ? rate
            : null
        );
      }

      await loadPaymentHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load booster portal"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadPortal();
  }, []);

  async function logout() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  async function openNotifications() {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);

    if (!willOpen) {
      return;
    }

    const hasUnread = notifications.some(
      (notification) => !notification.readAt
    );

    if (!hasUnread) {
      return;
    }

    try {
      await fetch("/api/booster/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "markNotificationsRead",
        }),
      });

      setData((current) =>
        current
          ? {
              ...current,
              notifications: (current.notifications ?? []).map(
                (notification) => ({
                  ...notification,
                  readAt:
                    notification.readAt ??
                    new Date().toISOString(),
                })
              ),
            }
          : current
      );
    } catch (requestError) {
      console.error(
        "Failed to mark notifications read:",
        requestError
      );
    }
  }

  async function updateProfileImage(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setSavingProfileImage(true);
      setError("");

      const profileImageUrl =
        await resizeProfileImage(file);
      const response = await fetch(
        "/api/booster/me",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            profileImageUrl,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update profile image"
        );
      }

      await loadPortal(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update profile image"
      );
    } finally {
      setSavingProfileImage(false);
    }
  }

  async function removeProfileImage() {
    try {
      setSavingProfileImage(true);
      setError("");

      const response = await fetch(
        "/api/booster/me",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            profileImageUrl: null,
          }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ||
            "Failed to remove profile image"
        );
      }

      await loadPortal(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to remove profile image"
      );
    } finally {
      setSavingProfileImage(false);
    }
  }


  const booster = data?.booster;

  const dueEgp =
    exchangeRate !== null && booster?.balanceUsd !== undefined
      ? Number(booster.balanceUsd) * exchangeRate
      : null;

  const orders = useMemo(
    () => data?.orders ?? [],
    [data?.orders]
  );

  const notifications = useMemo(
    () => data?.notifications ?? [],
    [data?.notifications]
  );

  const activeOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status =
          String(
            findOrderStatus(order)
          ).toUpperCase();

        return [
          "PENDING",
          "IN_PROGRESS",
        ].includes(status);
      }),
    [orders]
  );

  const completedOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status =
          String(
            findOrderStatus(order)
          ).toUpperCase();

        return status === "COMPLETED";
      }),
    [orders]
  );

  const financialSummary = useMemo(() => {
    const now = Date.now();

    let totalMoneyUsd = 0;
    let platformFeeUsd = 0;
    let finedUsd = 0;
    let paidUsd = 0;
    let onHoldUsd = 0;
    let balanceUsd = 0;

    for (const order of orders) {
      if (isCancelledOrder(order)) {
        continue;
      }

      const payment = getOrderPayment(order);

      if (!payment) {
        continue;
      }

      const grossUsd = getPaymentAmount(
        payment,
        "orderPriceUsd",
        Number(order.priceUsd ?? 0)
      );

      const feeUsd = getPaymentAmount(
        payment,
        "platformFeeUsd"
      );

      const fineUsd = getPaymentAmount(
        payment,
        "finedUsd"
      );

      const netUsd = getPaymentAmount(
        payment,
        "netAmountUsd",
        getPaymentAmount(
          payment,
          "boosterAmountUsd"
        ) - fineUsd
      );

      const paidForOrderUsd = getPaymentAmount(
        payment,
        "paidAmountUsd"
      );

      totalMoneyUsd += grossUsd;
      platformFeeUsd += feeUsd;
      finedUsd += fineUsd;
      paidUsd += paidForOrderUsd;

      const releaseAt = getPaymentReleaseAt(payment);
      const remainingUsd = Math.max(
        0,
        netUsd - paidForOrderUsd
      );

      const isStillOnHold =
        String(payment.status ?? "").toUpperCase() ===
          "ON HOLD" ||
        Boolean(
          releaseAt &&
            !Number.isNaN(releaseAt.getTime()) &&
            releaseAt.getTime() > now
        );

      if (isStillOnHold) {
        onHoldUsd += remainingUsd;
      } else {
        balanceUsd += remainingUsd;
      }
    }

    return {
      totalMoneyUsd,
      platformFeeUsd,
      finedUsd,
      paidUsd,
      onHoldUsd,
      balanceUsd,
    };
  }, [orders, financialSummaryUpdatedAt]);

  const financialBalanceEgp =
    exchangeRate !== null
      ? financialSummary.balanceUsd * exchangeRate
      : null;

  const financialOnHoldEgp =
    exchangeRate !== null
      ? financialSummary.onHoldUsd * exchangeRate
      : null;

  const financialPaidEgp =
    exchangeRate !== null
      ? financialSummary.paidUsd * exchangeRate
      : null;

  if (loading) {
    return (
      <main className="booster-loading-page">
        <div className="booster-loader-card">
          <div className="booster-loader-logo">
            <img
              src="/media/logo.png"
              alt="Trynda Business"
            />
          </div>

          <div className="booster-loading-ring" />

          <h2>
            Loading your workspace
          </h2>

          <p>
            Preparing your booster portal...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="booster-loading-page">
        <div className="booster-loader-card">
          <div className="booster-loader-error">
            !
          </div>

          <h2>
            Unable to load workspace
          </h2>

          <p>{error}</p>

          <div className="booster-error-actions">
            <button
              type="button"
              className="ui-button--primary"
              onClick={() =>
                void loadPortal()
              }
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="booster-portal">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="booster-sidebar">
        <Link
          href="/booster"
          className="booster-brand"
        >
          <div className="booster-brand-logo">
            <img
              src="/media/logo.png"
              alt="Trynda Business"
            />
          </div>

          <div>
            <strong>TRYΝDA</strong>
            <span>BUSINESS</span>
          </div>
        </Link>

        <div className="booster-profile-mini">
            <div
              className={
                booster?.profileImageUrl
                  ? "booster-avatar has-image"
                  : "booster-avatar"
              }
            >
              {booster?.profileImageUrl ? (
                <img
                  src={booster.profileImageUrl}
                  alt=""
                />
              ) : (
                (
                  booster?.name || "B"
                )
                  .charAt(0)
                  .toUpperCase()
              )}
          </div>

          <div>
            <strong>
              {booster?.name ||
                "Booster"}
            </strong>

            <span>
              {booster?.email}
            </span>
          </div>
        </div>

        <div className="booster-nav-label">
          {t("WORKSPACE", "مساحة العمل")}
        </div>

        <nav className="booster-nav">
          <button
            type="button"
            className={
              activeTab === "overview"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("overview")
            }
          >
            <span>◈</span>
            {isArabic ? "نظرة عامة" : "Overview"}
          </button>

          <button
            type="button"
            className={
              activeTab === "orders"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("orders")
            }
          >
            <span>▣</span>
            {isArabic ? "طلباتي" : "My Orders"}

            {activeOrders.length >
              0 && (
              <em>
                {activeOrders.length}
              </em>
            )}
          </button>

          <button
            type="button"
            className={
              activeTab === "payments"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("payments")
            }
          >
            <span>◇</span>
            {isArabic ? "المدفوعات" : "Payments"}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("overview");
              window.setTimeout(() => {
                document
                  .getElementById("booster-notifications")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }, 0);
            }}
          >
            <span>◉</span>
            {isArabic ? "الإشعارات" : "Notifications"}

            {notifications.filter(
              (notification) => !notification.readAt
            ).length > 0 && (
              <em>
                {notifications.filter(
                  (notification) => !notification.readAt
                ).length}
              </em>
            )}
          </button>
        </nav>

        <div className="booster-sidebar-bottom">
          <div className="booster-online">
            <span />

            <div>
              <strong>
                {t("Account active", "الحساب نشط")}
              </strong>

              <small>
                {t("Managed by Trynda", "تحت إدارة Trynda")}
              </small>
            </div>
          </div>

          <button
            type="button"
            className="booster-logout"
            onClick={logout}
          >
            <span>↪</span>
            {t("Logout", "تسجيل الخروج")}
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <section className="booster-main">
        <header className="booster-header">
          <div>
            <div className="booster-eyebrow">
              {t("BOOSTER WORKSPACE", "مساحة عمل البوستر")}
            </div>

            <h1>
              {t("Welcome back,", "مرحبًا بعودتك،")}{" "}
              <span>
                {booster?.name ||
                  "Booster"}
              </span>
            </h1>

            <p>
              {t("Your assigned orders and earnings.", "طلباتك المسندة وأرباحك.")}
            </p>
          </div>

          <div className="booster-header-actions">
            <div className="booster-notification-menu">
              <button
                type="button"
                className={
                  notifications.some(
                    (notification) => !notification.readAt
                  )
                    ? "booster-bell-button has-unread"
                    : "booster-bell-button"
                }
                aria-label="Open notifications"
                onClick={() =>
                  void openNotifications()
                }
              >
                <span className="booster-bell-icon">
                  🔔
                </span>
                {notifications.filter(
                  (notification) => !notification.readAt
                ).length > 0 && (
                  <span className="booster-bell-count">
                    {notifications.filter(
                      (notification) => !notification.readAt
                    ).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="booster-notification-dropdown">
                  <div className="booster-notification-dropdown-head">
                    <strong>{t("Notifications", "الإشعارات")}</strong>
                    <span>
                      {notifications.length}
                    </span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="booster-dropdown-empty">
                      {t("No notifications yet.", "لا توجد إشعارات حاليًا.")}
                    </div>
                  ) : (
                    <div className="booster-dropdown-list">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={
                            notification.readAt
                              ? "booster-dropdown-item"
                              : "booster-dropdown-item unread"
                          }
                        >
                          <span className="booster-dropdown-dot" />
                          <div>
                            <strong>
                              {notification.title}
                            </strong>
                            <p>
                              {notification.message}
                            </p>
                            <time>
                              {formatDate(
                                notification.createdAt
                              )}
                            </time>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="booster-role-badge">
              <span />
              {t("BOOSTER", "بوستر")}
            </div>

            <button
              type="button"
              className="refresh-orders-button"
              onClick={() =>
                void loadPortal(true)
              }
              disabled={refreshing}
            >
              <span
                className={
                  refreshing
                    ? "refresh-icon spinning"
                    : "refresh-icon"
                }
              >
                ↻
              </span>

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </header>

        {/* =====================================================
            OVERVIEW
        ===================================================== */}

        {activeTab === "overview" && (
          <>
            <div className="booster-overview-language-row">
              <button
                type="button"
                className="booster-language-switcher"
                onClick={() => {
                  const languageButton =
                    document.querySelector<HTMLButtonElement>(
                      ".language-switcher"
                    );

                  languageButton?.click();
                }}
                aria-label={t("Change language", "تغيير اللغة")}
              >
                <span>◎</span>
                {isArabic ? "English" : "العربية"}
              </button>
            </div>

            <section className="booster-hero-grid">
              <article className="booster-balance-card">
                <div>
                  <span>
                    {t("AVAILABLE BALANCE", "الرصيد المتاح")}
                  </span>

                  <strong>
                    {formatMoney(
                      booster?.balanceUsd
                    )}
                  </strong>

                  <span className="booster-balance-egp-label">
                    {t("Current USD rate", "سعر الدولار الحالي")}
                  </span>

                  <strong className="booster-balance-egp">
                    {formatEgp(dueEgp)}
                  </strong>

                  <small>
                    {t("Current balance available for payout", "الرصيد الحالي المتاح للسحب")}
                  </small>
                </div>

                <div className="booster-balance-glow">
                  $
                </div>
              </article>

              <article className="booster-profile-card">
                <div className="booster-profile-card-head">
                  <div
                    className={
                      booster?.profileImageUrl
                        ? "booster-avatar large has-image"
                        : "booster-avatar large"
                    }
                  >
                    {booster?.profileImageUrl ? (
                      <img
                        src={booster.profileImageUrl}
                        alt=""
                      />
                    ) : (
                      (
                        booster?.name ||
                        "B"
                      )
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <div>
                    <span>
                      {t("ACCOUNT", "الحساب")}
                    </span>

                    <strong>
                      {booster?.name}
                    </strong>

                    <small>
                      {booster?.email}
                    </small>
                  </div>
                </div>

                <div className="booster-account-status">
                  <span />
                  {t("Active account", "حساب نشط")}
                </div>

                <div className="booster-profile-actions">
                  <label className="ui-button--primary">
                    {savingProfileImage
                      ? t("Saving...", "جارٍ الحفظ...")
                      : t("Choose profile photo", "اختيار صورة الحساب")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={updateProfileImage}
                      disabled={savingProfileImage}
                      hidden
                    />
                  </label>

                  {booster?.profileImageUrl && (
                    <button
                      type="button"
                      onClick={removeProfileImage}
                      disabled={savingProfileImage}
                    >
                      {t("Remove", "إزالة")}
                    </button>
                  )}
                </div>

              </article>
            </section>

            <section className="booster-financial-grid" aria-label="Financial summary">
              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("Balance", "الرصيد")}</span>
                  <span className="booster-financial-card-icon">$</span>
                </div>

                <strong
                  className={
                    financialSummary.balanceUsd < 0
                      ? "danger"
                      : "success"
                  }
                >
                  {formatMoney(financialSummary.balanceUsd)}
                </strong>

                <span className="booster-financial-egp-label">
                  {t("Current USD rate", "سعر الدولار الحالي")}
                </span>

                <strong className="booster-financial-egp">
                  {formatEgp(financialBalanceEgp)}
                </strong>

                <small>{t("Available to pay", "متاح للسحب")}</small>
              </article>

              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("On Hold", "معلق")}</span>
                  <span className="booster-financial-card-icon">◷</span>
                </div>

                <strong className="warning">
                  {formatMoney(financialSummary.onHoldUsd)}
                </strong>

                <span className="booster-financial-egp-label">
                  {t("Current USD rate", "سعر الدولار الحالي")}
                </span>

                <strong className="booster-financial-egp">
                  {formatEgp(financialOnHoldEgp)}
                </strong>

                <small>{t("Waiting 5 days", "في فترة الانتظار 5 أيام")}</small>
              </article>

              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("Fined", "الخصومات")}</span>
                  <span className="booster-financial-card-icon">−$</span>
                </div>

                <strong className="danger">
                  {formatMoney(financialSummary.finedUsd)}
                </strong>

                <small>{t("Manual fines", "خصومات يدوية")}</small>
              </article>

              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("Paid", "المدفوع")}</span>
                  <span className="booster-financial-card-icon">✓</span>
                </div>

                <strong>
                  {formatMoney(financialSummary.paidUsd)}
                </strong>

                <span className="booster-financial-egp-label">
                  السعر بالجنية المصري المستحق
                </span>

                <strong className="booster-financial-egp">
                  {formatEgp(financialPaidEgp)}
                </strong>

                <small>
                  {t("Paid at the exchange rate at payment time", "تم الدفع بسعر الصرف وقت الدفع")}
                </small>
              </article>

              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("Total Money", "إجمالي المبلغ")}</span>
                  <span className="booster-financial-card-icon">↗</span>
                </div>

                <strong>
                  {formatMoney(financialSummary.totalMoneyUsd)}
                </strong>

                <small>{t("Before platform fee", "قبل رسوم المنصة")}</small>
              </article>

              <article className="booster-financial-card">
                <div className="booster-financial-card-head">
                  <span>{t("Platform Fee", "رسوم المنصة")}</span>
                  <span className="booster-financial-card-icon">−</span>
                </div>

                <strong className="danger">
                  -{formatMoney(financialSummary.platformFeeUsd)}
                </strong>

                <small>
                  {Number(booster?.platformFeePercent ?? 0).toFixed(2)}%
                </small>
              </article>
            </section>

            <section
              id="booster-notifications"
              className="booster-notifications-panel"
            >
              <div className="booster-section-heading">
                <div>
                  <span>{t("NOTIFICATIONS", "الإشعارات")}</span>
                  <h2>{t("Recent activity", "النشاط الأخير")}</h2>
                </div>
                <strong>
                  {notifications.filter(
                    (notification) => !notification.readAt
                  ).length} unread
                </strong>
              </div>

              {notifications.length === 0 ? (
                <p className="booster-notifications-empty">
                  {t("No notifications yet.", "لا توجد إشعارات حاليًا.")}
                </p>
              ) : (
                <div className="booster-notifications-list">
                  {notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={
                        notification.readAt
                          ? "booster-notification"
                          : "booster-notification unread"
                      }
                    >
                      <div>
                        <strong>
                          {notification.title}
                        </strong>
                        <p>
                          {notification.message}
                        </p>
                      </div>
                      <time>
                        {formatDate(
                          notification.createdAt
                        )}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="booster-stats-grid">
              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ↗
                  </div>

                  <span>
                    {t("Total Earned", "إجمالي الأرباح")}
                  </span>
                </div>

                <strong className="success">
                  {formatMoney(
                    booster?.totalEarnedUsd
                  )}
                </strong>

                <small>
                  Lifetime earnings
                </small>
              </div>

              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ✓
                  </div>

                  <span>
                    {t("Total Paid", "إجمالي المدفوع")}
                  </span>
                </div>

                <strong>
                  {formatMoney(
                    booster?.totalPaidUsd
                  )}
                </strong>

                <small>
                  {t("Completed payouts", "الدفعات المكتملة")}
                </small>
              </div>

              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ▣
                  </div>

                  <span>
                    {t("Active Orders", "الطلبات النشطة")}
                  </span>
                </div>

                <strong>
                  {activeOrders.length}
                </strong>

                <small>
                  {t("Current assignments", "الطلبات الحالية")}
                </small>
              </div>

              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ◉
                  </div>

                  <span>
                    {t("Completed", "مكتمل")}
                  </span>
                </div>

                <strong className="success">
                  {completedOrders.length}
                </strong>

                <small>
                  {t("Completed orders", "الطلبات المكتملة")}
                </small>
              </div>
            </section>

            <section className="booster-grid-two">
              <article className="booster-panel">
                <div className="booster-panel-header">
                  <div>
                    <span className="booster-panel-kicker">
                      {t("ACCOUNT", "الحساب")}
                    </span>

                    <h2>
                      {t("Your settings", "إعدادات حسابك")}
                    </h2>
                  </div>
                </div>

                <div className="booster-overview-list">
                  <div>
                    <span>
                      {t("Platform Fee", "رسوم المنصة")}
                    </span>

                    <strong>
                      {Number(
                        booster?.platformFeePercent ??
                          0
                      ).toFixed(2)}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t("Extra Penalty", "الخصم الإضافي")}
                    </span>

                    <strong>
                      {Number(
                        booster?.extraPenaltyPercent ??
                          0
                      ).toFixed(2)}
                      %
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t("Orders", "الطلبات")}
                    </span>

                    <strong>
                      {booster?.ordersCount ||
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t("Payments", "المدفوعات")}
                    </span>

                    <strong>
                      {booster?.paymentsCount ||
                        0}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="booster-panel">
                <div className="booster-panel-header">
                  <div>
                    <span className="booster-panel-kicker">
                      {t("ASSIGNMENTS", "الطلبات المسندة")}
                    </span>

                    <h2>
                      {t("Active orders", "الطلبات النشطة")}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="booster-link-button"
                    onClick={() =>
                      setActiveTab(
                        "orders"
                      )
                    }
                  >
                    {t("View all →", "عرض الكل ←")}
                  </button>
                </div>

                {activeOrders.length ===
                0 ? (
                  <div className="booster-empty-small">
                    <span>✓</span>

                    <div>
                      <strong>
                        {t("No active orders", "لا توجد طلبات نشطة")}
                      </strong>

                      <small>
                        {t("You're all caught up.", "أنت متابع كل شيء حاليًا.")}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="booster-active-list">
                    {activeOrders
                      .slice(0, 5)
                      .map(
                        (order, index) => (
                          <button
                            type="button"
                            key={String(
                              order.id ??
                                index
                            )}
                            onClick={() =>
                              setSelectedOrder(
                                order
                              )
                            }
                          >
                            <span className="booster-order-mini-icon">
                              ▣
                            </span>

                            <span>
                              <strong>
                                {String(
                                  findOrderTitle(
                                    order
                                  )
                                )}
                              </strong>

                              <small>
                                {String(
                                  findOrderGame(
                                    order
                                  )
                                )}
                              </small>
                            </span>

                            <em>
                              {formatMoney(
                                findOrderEarnings(
                                  order
                                )
                              )}
                            </em>
                          </button>
                        )
                      )}
                  </div>
                )}
              </article>
            </section>

            <section className="booster-panel">
              <div className="booster-panel-header">
                <div>
                  <span className="booster-panel-kicker">
                    {t("RECENT ORDERS", "أحدث الطلبات")}
                  </span>

                  <h2>
                    {t("Latest assignments", "أحدث الطلبات المسندة")}
                  </h2>
                </div>

                <button
                  type="button"
                  className="booster-link-button"
                  onClick={() =>
                    setActiveTab("orders")
                  }
                >
                  {t("View all →", "عرض الكل ←")}
                </button>
              </div>

              <OrdersTable
                orders={orders.slice(
                  0,
                  8
                )}
                onViewDetails={
                  setSelectedOrder
                }
              />
            </section>
          </>
        )}

        {/* =====================================================
            ORDERS
        ===================================================== */}

        {activeTab === "orders" && (
          <section className="booster-panel">
            <div className="booster-panel-header">
              <div>
                <span className="booster-panel-kicker">
                  ASSIGNMENTS
                </span>

                <h2>
                  My Orders
                </h2>

                <p>
                  All orders assigned to
                  your account.
                </p>
              </div>

              <div className="booster-count">
                {orders.length} orders
              </div>
            </div>

            <OrdersTable
              orders={orders}
              onViewDetails={
                setSelectedOrder
              }
            />
          </section>
        )}

        {/* =====================================================
            PAYMENTS
        ===================================================== */}

        {activeTab === "payments" && (
          <>
            <section className="booster-panel">
              <div className="booster-panel-header">
                <div>
                  <span className="booster-panel-kicker">
                    {isArabic ? "السجل المالي" : "PAYOUT HISTORY"}
                  </span>

                  <h2>
                    {isArabic ? "سجل الدفعات" : "Payment History"}
                  </h2>

                  <p>
                    {isArabic
                      ? "الدفعات التي تم تحويلها لك من الإدارة."
                      : "Payments sent to you by the administration."}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div className="booster-count">
                    {paymentHistory.length}{" "}
                    {isArabic ? "دفعة" : "payouts"}
                  </div>

                  <button
                    type="button"
                    className="refresh-orders-button"
                    onClick={() =>
                      void loadPaymentHistory()
                    }
                    disabled={historyLoading}
                  >
                    <span
                      className={
                        historyLoading
                          ? "refresh-icon spinning"
                          : "refresh-icon"
                      }
                    >
                      ↻
                    </span>

                    {historyLoading
                      ? isArabic
                        ? "جاري التحديث..."
                        : "Refreshing..."
                      : isArabic
                      ? "تحديث"
                      : "Refresh"}
                  </button>
                </div>
              </div>

              {historyLoading && paymentHistory.length === 0 ? (
                <div className="booster-empty">
                  <div>◇</div>
                  <h3>
                    {isArabic
                      ? "جاري تحميل سجل الدفعات"
                      : "Loading payment history"}
                  </h3>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="booster-empty">
                  <div>◇</div>

                  <h3>
                    {isArabic
                      ? "لا توجد دفعات سابقة"
                      : "No payout history yet"}
                  </h3>

                  <p>
                    {isArabic
                      ? "ستظهر هنا الدفعات التي يتم تحويلها لك."
                      : "Your completed payouts will appear here."}
                  </p>
                </div>
              ) : (
                <div className="booster-table-wrap">
                  <table className="booster-table">
                    <thead>
                      <tr>
                        <th>
                          {isArabic ? "التاريخ" : "Date"}
                        </th>
                        <th>
                          {isArabic ? "الشهر" : "Month"}
                        </th>
                        <th>
                          {isArabic
                            ? "المسحوب بالدولار"
                            : "USD Withdrawn"}
                        </th>
                        <th>
                          {isArabic
                            ? "سعر الصرف"
                            : "Exchange Rate"}
                        </th>
                        <th>
                          {isArabic
                            ? "المدفوع بالجنيه"
                            : "Paid in EGP"}
                        </th>
                        <th>
                          {isArabic
                            ? "طريقة الدفع"
                            : "Method"}
                        </th>
                        <th>
                          {isArabic
                            ? "رقم الدفع"
                            : "Payment Number"}
                        </th>
                        <th>Transaction ID</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paymentHistory.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>
                            <strong>
                              {formatPaymentHistoryDate(
                                transaction.paidAt,
                                isArabic
                              )}
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {transaction.month}
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {formatMoney(
                                transaction.amountUsd
                              )}
                            </strong>
                          </td>

                          <td>
                            <strong>
                              {Number(
                                transaction.exchangeRate
                              ).toFixed(4)}
                            </strong>
                          </td>

                          <td>
                            <strong
                              style={{
                                color: "#6ee7b7",
                              }}
                            >
                              {Number(
                                transaction.amountEgp
                              ).toFixed(2)} EGP
                            </strong>

                            <small className="booster-egp-amount success">
                              {isArabic
                                ? "تم التحويل بالفعل"
                                : "Completed payout"}
                            </small>
                          </td>

                          <td>
                            <span className="status-success">
                              {paymentMethodLabel(
                                transaction.paymentMethod,
                                isArabic
                              )}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {transaction.paymentNumber}
                            </strong>
                          </td>

                          <td>
                            <code
                              style={{
                                fontSize: "10px",
                                color: "#a89fff",
                              }}
                            >
                              {transaction.id}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              className="booster-panel"
              style={{ marginTop: "18px" }}
            >
              <div className="booster-panel-header">
                <div>
                  <span className="booster-panel-kicker">
                    FINANCIAL
                  </span>

                  <h2>
                    {isArabic
                      ? "دفعات الطلبات"
                      : "Order Payments"}
                  </h2>

                  <p>
                    {isArabic
                      ? "تفاصيل المدفوعات المرتبطة بالطلبات التي تم إسنادها لك."
                      : "Payment records connected to your assigned orders."}
                  </p>
                </div>

                <div className="booster-count">
                  {booster?.paymentsCount || 0}{" "}
                  {isArabic ? "سجل" : "records"}
                </div>
              </div>

              <PaymentsTable
                orders={orders}
                onViewDetails={setSelectedOrder}
              />
            </section>
          </>
        )}

        <footer className="booster-footer">
          TRYΝDA BUSINESS
          <span>/</span>
          BOOSTER WORKSPACE
        </footer>
      </section>

      {/* =====================================================
          ORDER DETAILS MODAL — READ ONLY
      ===================================================== */}

      {selectedOrder && (
        <div
          className="booster-order-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedOrder(null);
            }
          }}
        >
          <div className="booster-order-modal">
            <div className="booster-order-modal-header">
              <div>
                <span className="booster-panel-kicker">
                  ORDER DETAILS
                </span>

                <h2>
                  {String(
                    findOrderTitle(
                      selectedOrder
                    )
                  )}
                </h2>

                <p>
                  Read-only order
                  information.
                </p>
              </div>

              <button
                type="button"
                className="booster-modal-close"
                onClick={() =>
                  setSelectedOrder(null)
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="booster-detail-warning">
              <span>◉</span>

              <div>
                <strong>
                  Read-only information
                </strong>

                <small>
                  This order is controlled by
                  the administrator. You cannot
                  edit its details.
                </small>
              </div>
            </div>

            <div className="booster-detail-grid">
              {Object.entries(
                selectedOrder
              )
                .filter(
                  ([key]) =>
                    key !== "payment"
                )
                .map(
                  ([key, value]) => (
                    <div
                      className="booster-detail-item"
                      key={key}
                    >
                      <span>
                        {prettifyKey(
                          key
                        )}
                      </span>

                      <div>
                        {key
                          .toLowerCase()
                          .includes(
                            "status"
                          ) ? (
                          <span
                            className={statusClass(
                              value
                            )}
                          >
                            {statusLabel(
                              value
                            )}
                          </span>
                        ) : (
                          <strong>
                            {displayValue(
                              key,
                              value
                            )}
                          </strong>
                        )}
                      </div>
                    </div>
                  )
                )}
            </div>

            {typeof selectedOrder.payment === "object" &&
              selectedOrder.payment !== null && (
                <div className="booster-payment-details">
                  <div className="booster-order-modal-section-title">
                    PAYMENT INFORMATION
                  </div>

                  <div className="booster-detail-grid">
                    {Object.entries(
                      selectedOrder.payment as Record<
                        string,
                        unknown
                      >
                    ).map(
                      ([key, value]) => (
                        <div
                          className="booster-detail-item"
                          key={`payment-${key}`}
                        >
                          <span>
                            {prettifyKey(
                              key
                            )}
                          </span>

                          <div>
                            {key
                              .toLowerCase()
                              .includes(
                                "status"
                              ) ? (
                              <span
                                className={statusClass(
                                  value
                                )}
                              >
                                {statusLabel(
                                  value
                                )}
                              </span>
                            ) : (
                              <strong>
                                {displayValue(
                                  key,
                                  value
                                )}
                              </strong>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
            <style jsx>{`
              .booster-financial-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 14px;
                margin: 0 0 18px;
              }

              .booster-financial-card {
                min-width: 0;
                padding: 18px;
                border: 1px solid rgba(148, 163, 184, 0.10);
                border-radius: 18px;
                background: linear-gradient(
                  145deg,
                  rgba(17, 26, 45, 0.96),
                  rgba(9, 15, 28, 0.96)
                );
                box-shadow:
                  inset 0 1px 0 rgba(255, 255, 255, 0.025),
                  0 12px 30px rgba(0, 0, 0, 0.12);
              }

              .booster-financial-card-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 11px;
                color: #8f9bb0;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
              }

              .booster-financial-card-icon {
                display: grid;
                place-items: center;
                width: 30px;
                height: 30px;
                border-radius: 10px;
                background: rgba(117, 104, 255, 0.08);
                border: 1px solid rgba(117, 104, 255, 0.12);
                color: #bdb6ff;
                font-size: 12px;
                font-weight: 800;
              }

              .booster-financial-card > strong {
                display: block;
                color: #eef2ff;
                font-size: 26px;
                line-height: 1.05;
                letter-spacing: -0.03em;
              }

              .booster-financial-card > strong.success {
                color: #6ee7b7;
              }

              .booster-financial-card > strong.warning {
                color: #fcd34d;
              }

              .booster-financial-card > strong.danger {
                color: #fca5a5;
              }

              .booster-financial-egp-label {
                display: block;
                margin-top: 9px;
                color: #6f7d95;
                font-size: 10px;
                line-height: 1.4;
              }

              .booster-financial-egp {
                margin-top: 3px !important;
                color: #cbd5e1 !important;
                font-size: 17px !important;
                letter-spacing: -0.01em !important;
              }

              .booster-financial-card > small {
                display: block;
                margin-top: 8px;
                color: #66748d;
                font-size: 10px;
              }

              @media (max-width: 1100px) {
                .booster-financial-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
              }

              @media (max-width: 680px) {
                .booster-financial-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
    </main>
  );
}

function OrdersTable({
  orders,
  onViewDetails,
}: {
  orders: Record<string, unknown>[];

  onViewDetails: (
    order: Record<string, unknown>
  ) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="booster-empty">
        <div>▣</div>

        <h3>
          No orders assigned
        </h3>

        <p>
          Orders assigned by the
          administrator will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="booster-table-wrap">
      <table className="booster-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Game</th>
            <th>Status</th>
            <th>Value</th>
            <th>Your Earnings</th>
            <th>Created</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {orders.map(
            (order, index) => {
              const id = String(
                order.id ??
                  `order-${index}`
              );

              return (
                <tr key={id}>
                  <td>
                    <div className="booster-order-cell">
                      <span className="booster-order-table-icon">
                        ▣
                      </span>

                      <div>
                        <strong>
                          {String(
                            findOrderTitle(
                              order
                            )
                          )}
                        </strong>

                        <small>
                          #{id.slice(
                            -8
                          )}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>
                    {String(
                      findOrderGame(
                        order
                      )
                    )}
                  </td>

                  <td>
                    <span
                      className={statusClass(
                        findOrderStatus(
                          order
                        )
                      )}
                    >
                      {statusLabel(
                        findOrderStatus(
                          order
                        )
                      )}
                    </span>
                  </td>

                  <td>
                    {formatMoney(
                      findOrderPrice(
                        order
                      )
                    )}
                  </td>

                  <td>
                    <strong className="money-success">
                      {formatMoney(
                        findOrderEarnings(
                          order
                        )
                      )}
                    </strong>
                  </td>

                  <td>
                    {formatDate(
                      order.createdAt
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="booster-details-button"
                      onClick={() =>
                        onViewDetails(
                          order
                        )
                      }
                    >
                      View details
                    </button>
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({
  orders,
  onViewDetails,
}: {
  orders: Record<string, unknown>[];

  onViewDetails: (
    order: Record<string, unknown>
  ) => void;
}) {
  const payments = orders.filter(
    (order) =>
      order.payment &&
      typeof order.payment ===
        "object"
  );

  if (payments.length === 0) {
    return (
      <div className="booster-empty">
        <div>◇</div>

        <h3>
          No payments yet
        </h3>

        <p>
          Payment information will appear
          with your assigned orders.
        </p>
      </div>
    );
  }

  return (
    <div className="booster-table-wrap">
      <table className="booster-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>الإجمالي قبل الخصم</th>
            <th>الإجمالي بعد الخصم</th>
            <th>Status</th>
            <th>Paid</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {payments.map(
            (order, index) => {
              const payment =
                order.payment as Record<
                  string,
                  unknown
                >;

              const paymentExchangeRate =
                Number(
                  payment.exchangeRate ??
                    order.exchangeRate ??
                    0
                );

              const grossUsd = Number(
                payment.orderPriceUsd ??
                  findOrderPrice(order)
              );

              const netUsd = Number(
                payment.netAmountUsd ??
                  findOrderEarnings(order)
              );

              return (
                <tr
                  key={String(
                    payment.id ??
                      order.id ??
                      index
                  )}
                >
                  <td className="booster-payment-order-title">
                    {String(
                      findOrderTitle(
                        order
                      )
                    )}
                  </td>

                  <td>
                    {formatMoney(
                      grossUsd
                    )}

                    <small className="booster-egp-amount">
                      {formatEgp(
                        grossUsd *
                          paymentExchangeRate
                      )}
                    </small>
                  </td>

                  <td>
                    <strong className="money-success">
                      {formatMoney(
                        netUsd
                      )}
                    </strong>

                    <small className="booster-egp-amount success booster-payment-egp-total">
                      بعد الخصم بالجنيه المصري: {" "}
                      {formatEgp(
                        netUsd *
                          paymentExchangeRate
                      )}
                    </small>
                  </td>

                  <td>
                    <span
                      className={statusClass(
                        payment.status
                      )}
                    >
                      {statusLabel(
                        payment.status
                      )}
                    </span>
                  </td>

                  <td>
                    {formatDate(
                      payment.paidAt ??
                        payment.completedAt
                    )}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="booster-details-button"
                      onClick={() =>
                        onViewDetails(
                          order
                        )
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}
