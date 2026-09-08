"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
};

function formatMoney(value: unknown) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  return `$${number.toFixed(2)}`;
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

  const [data, setData] =
    useState<ApiResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

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

  const orders = useMemo(
    () => data?.orders ?? [],
    [data?.orders]
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
          WORKSPACE
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
            Overview
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
            My Orders

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
            Payments
          </button>
        </nav>

        <div className="booster-sidebar-bottom">
          <div className="booster-online">
            <span />

            <div>
              <strong>
                Account active
              </strong>

              <small>
                Managed by Trynda
              </small>
            </div>
          </div>

          <button
            type="button"
            className="booster-logout"
            onClick={logout}
          >
            <span>↪</span>
            Logout
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
              BOOSTER WORKSPACE
            </div>

            <h1>
              Welcome back,{" "}
              <span>
                {booster?.name ||
                  "Booster"}
              </span>
            </h1>

            <p>
              Your assigned orders and
              earnings.
            </p>
          </div>

          <div className="booster-header-actions">
            <div className="booster-role-badge">
              <span />
              BOOSTER
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
            <section className="booster-hero-grid">
              <article className="booster-balance-card">
                <div>
                  <span>
                    AVAILABLE BALANCE
                  </span>

                  <strong>
                    {formatMoney(
                      booster?.balanceUsd
                    )}
                  </strong>

                  <small>
                    Current balance
                    available for payout
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
                      ACCOUNT
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
                  Active account
                </div>

                <div className="booster-profile-actions">
                  <label className="ui-button--primary">
                    {savingProfileImage
                      ? "Saving..."
                      : "Choose profile photo"}
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
                      Remove
                    </button>
                  )}
                </div>
              </article>
            </section>

            <section className="booster-stats-grid">
              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ↗
                  </div>

                  <span>
                    Total Earned
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
                    Total Paid
                  </span>
                </div>

                <strong>
                  {formatMoney(
                    booster?.totalPaidUsd
                  )}
                </strong>

                <small>
                  Completed payouts
                </small>
              </div>

              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ▣
                  </div>

                  <span>
                    Active Orders
                  </span>
                </div>

                <strong>
                  {activeOrders.length}
                </strong>

                <small>
                  Current assignments
                </small>
              </div>

              <div className="booster-stat">
                <div className="booster-stat-top">
                  <div className="booster-stat-icon">
                    ◉
                  </div>

                  <span>
                    Completed
                  </span>
                </div>

                <strong className="success">
                  {completedOrders.length}
                </strong>

                <small>
                  Completed orders
                </small>
              </div>
            </section>

            <section className="booster-grid-two">
              <article className="booster-panel">
                <div className="booster-panel-header">
                  <div>
                    <span className="booster-panel-kicker">
                      ACCOUNT
                    </span>

                    <h2>
                      Your settings
                    </h2>
                  </div>
                </div>

                <div className="booster-overview-list">
                  <div>
                    <span>
                      Platform Fee
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
                      Extra Penalty
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
                      Orders
                    </span>

                    <strong>
                      {booster?.ordersCount ||
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Payments
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
                      ASSIGNMENTS
                    </span>

                    <h2>
                      Active orders
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
                    View all →
                  </button>
                </div>

                {activeOrders.length ===
                0 ? (
                  <div className="booster-empty-small">
                    <span>✓</span>

                    <div>
                      <strong>
                        No active orders
                      </strong>

                      <small>
                        You're all caught up.
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
                    RECENT ORDERS
                  </span>

                  <h2>
                    Latest assignments
                  </h2>
                </div>

                <button
                  type="button"
                  className="booster-link-button"
                  onClick={() =>
                    setActiveTab("orders")
                  }
                >
                  View all →
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
          <section className="booster-panel">
            <div className="booster-panel-header">
              <div>
                <span className="booster-panel-kicker">
                  FINANCIAL
                </span>

                <h2>
                  Payments
                </h2>

                <p>
                  Payment records connected
                  to your orders.
                </p>
              </div>

              <div className="booster-count">
                {booster?.paymentsCount ||
                  0} records
              </div>
            </div>

            <PaymentsTable
              orders={orders}
              onViewDetails={
                setSelectedOrder
              }
            />
          </section>
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
            <th>Gross</th>
            <th>Net</th>
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

              return (
                <tr
                  key={String(
                    payment.id ??
                      order.id ??
                      index
                  )}
                >
                  <td>
                    {String(
                      findOrderTitle(
                        order
                      )
                    )}
                  </td>

                  <td>
                    {formatMoney(
                      payment.orderPriceUsd ??
                        findOrderPrice(
                          order
                        )
                    )}
                  </td>

                  <td>
                    <strong className="money-success">
                      {formatMoney(
                        payment.netAmountUsd ??
                          findOrderEarnings(
                            order
                          )
                      )}
                    </strong>
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