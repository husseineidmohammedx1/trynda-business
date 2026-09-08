"use client";
import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

type Booster = {
  id: string;
  name: string;
  email: string;
  platformFeePercent: number;
  extraPenaltyPercent: number;
};

type Payment = {
  id: string;
  orderPriceUsd: string | number;
  platformFeeUsd: string | number;
  extraPenaltyUsd: string | number;
  boosterAmountUsd: string | number;
  finedUsd: string | number;
  netAmountUsd: string | number;
  exchangeRate: string | number;
  amountEgp: string | number;
  status: string;
  completedAt: string | null;
  releaseAt: string | null;
  paidAt: string | null;
};

type Order = {
  id: string;

  title: string;
  game: string;
  customer: string | null;

  description: string | null;
  characterName: string | null;
  battleTag: string | null;
  faction: string | null;
  serverName: string | null;
  vpnLocation: string | null;
  region: string | null;

  priceUsd: string | number;
  exchangeRate: string | number;

  platformFeePercent: string | number;
  extraPenaltyPercent: string | number;

  platformFeeUsd: string | number;
  extraPenaltyUsd: string | number;

  boosterAmountUsd: string | number;
  deductionUsd: string | number;

  status: string;

  boosterId: string | null;
  booster: Booster | null;

  payment: Payment | null;

  createdAt: string;
  completedAt: string | null;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "COMPLETED":
      return {
        background: "rgba(34,197,94,0.1)",
        color: "#6ee7b7",
      };

    case "IN_PROGRESS":
      return {
        background: "rgba(59,130,246,0.1)",
        color: "#60a5fa",
      };

    case "CANCELLED":
      return {
        background: "rgba(239,68,68,0.1)",
        color: "#fca5a5",
      };

    default:
      return {
        background: "rgba(245,158,11,0.1)",
        color: "#fcd34d",
      };
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [boosters, setBoosters] = useState<Booster[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const [expandedOrder, setExpandedOrder] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  // =====================================================
  // DEFAULT SETTINGS
  // =====================================================

  const [defaultPlatformFee, setDefaultPlatformFee] =
    useState("7");

  const [
    defaultExtraPenalty,
    setDefaultExtraPenalty,
  ] = useState("0");

  // =====================================================
  // CREATE ORDER FEE SETTINGS
  // =====================================================

  const [platformFeePercent, setPlatformFeePercent] =
    useState("7");

  const [extraPenaltyPercent, setExtraPenaltyPercent] =
    useState("0");

  // =====================================================
  // CREATE ORDER FORM
  // =====================================================

  const [orderId, setOrderId] = useState("");
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("World of Warcraft");
  const [customer, setCustomer] = useState("");

  const [description, setDescription] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [battleTag, setBattleTag] = useState("");
  const [faction, setFaction] = useState("");
  const [serverName, setServerName] = useState("");
  const [vpnLocation, setVpnLocation] = useState("");
  const [region, setRegion] = useState("");

  const [priceUsd, setPriceUsd] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [boosterId, setBoosterId] = useState("");

  // =====================================================
  // LOAD ORDERS
  // =====================================================

  async function loadOrders() {
    const response = await fetch("/api/orders", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to load orders"
      );
    }

    setOrders(Array.isArray(data) ? data : []);
  }

  // =====================================================
  // LOAD BOOSTERS
  // =====================================================

  async function loadBoosters() {
    const response = await fetch("/api/boosters", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to load boosters"
      );
    }

    setBoosters(Array.isArray(data) ? data : []);
  }

  // =====================================================
  // LOAD SETTINGS
  // =====================================================

  async function loadSettings() {
    const response = await fetch("/api/settings", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to load settings"
      );
    }

    const fee = Number(data.platformFeePercent);

    if (
      !Number.isFinite(fee) ||
      fee < 0 ||
      fee > 100
    ) {
      throw new Error("Invalid platform fee");
    }

    setDefaultPlatformFee(String(fee));
  }

  // =====================================================
  // LOAD EXCHANGE RATE
  // =====================================================

  async function loadExchangeRate() {
    const response = await fetch(
      "/api/exchange-rate",
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to load exchange rate"
      );
    }

    const rate = Number(data.rate);

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      throw new Error("Invalid exchange rate");
    }

    setExchangeRate(rate.toFixed(4));
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadOrders(),
        loadBoosters(),
        loadSettings(),
        loadExchangeRate(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // OPEN MODAL
  // =====================================================

  function openModal() {
    setOrderId("");
    setTitle("");
    setGame("World of Warcraft");
    setCustomer("");

    setDescription("");
    setCharacterName("");
    setBattleTag("");
    setFaction("");
    setServerName("");
    setVpnLocation("");
    setRegion("");

    setPriceUsd("");
    setBoosterId("");

    setPlatformFeePercent(
      defaultPlatformFee
    );

    setExtraPenaltyPercent("0");

    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setError("");
  }

  // =====================================================
  // CREATE ORDER
  // =====================================================

  async function createOrder(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const price = Number(priceUsd);
    const fee = Number(platformFeePercent);
    const penalty = Number(extraPenaltyPercent);

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError(
        "Please enter a valid order price."
      );
      return;
    }

    if (
      !Number.isFinite(fee) ||
      fee < 0 ||
      fee > 100
    ) {
      setError(
        "Platform Fee must be between 0 and 100."
      );
      return;
    }

    if (
      !Number.isFinite(penalty) ||
      penalty < 0 ||
      penalty > 100
    ) {
      setError(
        "Extra Penalty must be between 0 and 100."
      );
      return;
    }

    if (fee + penalty > 100) {
      setError(
        "Platform Fee and Extra Penalty cannot exceed 100% combined."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId,
            title,
            game,
            customer,

            description,
            characterName,
            battleTag,
            faction,
            serverName,
            vpnLocation,
            region,

            priceUsd: price,
            exchangeRate,

            boosterId:
              boosterId || null,

            platformFeePercent: fee,
            extraPenaltyPercent: penalty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create order"
        );
      }

      setShowModal(false);

      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create order"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // UPDATE STATUS
  // =====================================================

  async function updateStatus(
    id: string,
    status: string
  ) {
    try {
      setError("");

      const response = await fetch(
        `/api/orders/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const text = await response.text();

      let data: {
        error?: string;
      } = {};

      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `Server returned invalid response (${response.status})`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to update order (${response.status})`
        );
      }

      await loadOrders();
    } catch (err) {
      console.error(
        "Update status error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update order"
      );
    }
  }

  // =====================================================
  // DELETE ORDER
  // =====================================================

  async function deleteOrder(
    id: string,
    orderTitle: string
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to permanently delete "${orderTitle}"?\n\nThis action will delete the order and its payment record and cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `/api/orders/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete order"
        );
      }

      setExpandedOrder(null);

      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete order"
      );
    }
  }

  // =====================================================
  // CALCULATIONS
  // =====================================================

  const totalOrderValue =
    orders.reduce(
      (sum, order) =>
        sum + Number(order.priceUsd),
      0
    );

  const totalPlatformFees =
    orders.reduce(
      (sum, order) =>
        sum +
        Number(
          order.platformFeeUsd || 0
        ),
      0
    );

  const totalBoosterEarnings =
    orders.reduce(
      (sum, order) =>
        sum +
        Number(
          order.boosterAmountUsd || 0
        ),
      0
    );

  const pending =
    orders.filter(
      (order) =>
        order.status === "PENDING"
    ).length;

  const inProgress =
    orders.filter(
      (order) =>
        order.status === "IN_PROGRESS"
    ).length;

  const completed =
    orders.filter(
      (order) =>
        order.status === "COMPLETED"
    ).length;

  // =====================================================
  // PREVIEW
  // =====================================================

  const previewPrice =
    Number(priceUsd) || 0;

  const previewFeePercent =
    Number(platformFeePercent) || 0;

  const previewPenaltyPercent =
    Number(extraPenaltyPercent) || 0;

  const previewFee =
    previewPrice *
    (previewFeePercent / 100);

  const previewPenalty =
    previewPrice *
    (previewPenaltyPercent / 100);

  const previewBooster =
    previewPrice -
    previewFee -
    previewPenalty;

  const previewEgp =
    previewBooster *
    Number(exchangeRate || 0);

  return (
    <div className="shell">
      {/* SIDEBAR */}

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

          <Link
            href="/orders"
            className="active"
          >
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

      {/* MAIN */}

      <main className="content">
        <header>
          <div>
            <h1>Orders</h1>

            <p>
              Manage orders, customer
              information and booster
              assignments.
            </p>
          </div>

          <button
            type="button"
            onClick={openModal}
          >
            + Create Order
          </button>
        </header>

        {/* STATS */}

        <div className="stats">
          <div className="stat">
            <span>Total Orders</span>

            <strong>
              {orders.length}
            </strong>
          </div>

          <div className="stat">
            <span>Pending</span>

            <strong>
              {pending}
            </strong>
          </div>

          <div className="stat">
            <span>In Progress</span>

            <strong>
              {inProgress}
            </strong>
          </div>

          <div className="stat">
            <span>Completed</span>

            <strong>
              {completed}
            </strong>
          </div>
        </div>

        {/* FINANCIAL STATS */}

        <div className="stats">
          <div className="stat">
            <span>
              Gross Order Value
            </span>

            <strong>
              {money(
                totalOrderValue
              )}
            </strong>

            <small>
              Before order fees
            </small>
          </div>

          <div className="stat">
            <span>
              Platform Earnings
            </span>

            <strong
              style={{
                color: "#c4bfff",
              }}
            >
              {money(
                totalPlatformFees
              )}
            </strong>

            <small>
              Saved order fees
            </small>
          </div>

          <div className="stat">
            <span>
              Booster Earnings
            </span>

            <strong
              style={{
                color: "#6ee7b7",
              }}
            >
              {money(
                totalBoosterEarnings
              )}
            </strong>

            <small>
              After percentage deductions
            </small>
          </div>
        </div>

        {/* ERROR */}

        {error && !showModal && (
          <div
            className="login-error"
            style={{
              marginTop: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* ORDERS */}

        <section className="panel">
          <div
            className="section-header"
            style={{
              marginBottom: "20px",
            }}
          >
            <div>
              <h2>All Orders</h2>

              <p>
                Click an order to view
                complete order data.
              </p>
            </div>

            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="refresh-orders-button"
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
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                📦
              </div>

              <h3>No orders yet</h3>

              <p>
                Create your first
                order to get started.
              </p>

              <button
                className="empty-action"
                type="button"
                onClick={openModal}
              >
                Create Order
              </button>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: "1400px",
                  borderCollapse:
                    "separate",
                  borderSpacing: "0",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "230px",
                      }}
                    >
                      Order
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "150px",
                      }}
                    >
                      Customer
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "190px",
                      }}
                    >
                      Booster
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "140px",
                      }}
                    >
                      Original
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "120px",
                      }}
                    >
                      Platform Fee
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "140px",
                      }}
                    >
                      Extra Penalty
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "150px",
                      }}
                    >
                      Booster Gets
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "130px",
                      }}
                    >
                      EGP
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "155px",
                      }}
                    >
                      Status
                    </th>

                    <th
                      style={{
                        padding:
                          "16px 18px",
                        minWidth:
                          "100px",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map(
                    (order) => {
                      const original =
                        Number(
                          order.priceUsd
                        );

                      const platformFee =
                        Number(
                          order.platformFeeUsd ||
                            0
                        );

                      const extraPenalty =
                        Number(
                          order.extraPenaltyUsd ||
                            0
                        );

                      const boosterAmount =
                        Number(
                          order.boosterAmountUsd ||
                            0
                        );

                      const egp =
                        Number(
                          order.payment
                            ?.amountEgp || 0
                        );

                      const savedFeePercent =
                        Number(
                          order.platformFeePercent ||
                            0
                        );

                      const savedPenaltyPercent =
                        Number(
                          order.extraPenaltyPercent ||
                            0
                        );

                      const statusStyle =
                        getStatusStyle(
                          order.status
                        );

                      const expanded =
                        expandedOrder ===
                        order.id;

                      return (
                        <React.Fragment
                          key={order.id}
                        >
                          <tr
                            onClick={() =>
                              setExpandedOrder(
                                expanded
                                  ? null
                                  : order.id
                              )
                            }
                            style={{
                              cursor:
                                "pointer",
                            }}
                          >
                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "flex-start",
                                  gap:
                                    "10px",
                                }}
                              >
                                <div
                                  style={{
                                    width:
                                      "34px",
                                    height:
                                      "34px",
                                    display:
                                      "grid",
                                    placeItems:
                                      "center",
                                    borderRadius:
                                      "9px",
                                    background:
                                      "rgba(109,93,252,0.1)",
                                    color:
                                      "#a89fff",
                                    fontSize:
                                      "13px",
                                    fontWeight:
                                      800,
                                    flexShrink:
                                      0,
                                  }}
                                >
                                  {expanded
                                    ? "−"
                                    : "+"}
                                </div>

                                <div>
                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      color:
                                        "#ffffff",
                                    }}
                                  >
                                    {
                                      order.title
                                    }
                                  </strong>

                                  <div
                                    style={{
                                      color:
                                        "#a89fff",
                                      fontSize:
                                        "11px",
                                      marginTop:
                                        "5px",
                                      fontWeight:
                                        600,
                                    }}
                                  >
                                    ID:{" "}
                                    {
                                      order.id
                                    }
                                  </div>

                                  <div
                                    className="muted"
                                    style={{
                                      fontSize:
                                        "12px",
                                      marginTop:
                                        "4px",
                                    }}
                                  >
                                    {
                                      order.game
                                    }
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    "#cbd5e1",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                {
                                  order.customer ||
                                  "—"
                                }
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              {order.booster ? (
                                <div>
                                  <strong>
                                    {
                                      order
                                        .booster
                                        .name
                                    }
                                  </strong>

                                  <span
                                    className="muted"
                                    style={{
                                      display:
                                        "block",
                                      fontSize:
                                        "11px",
                                      marginTop:
                                        "5px",
                                    }}
                                  >
                                    {
                                      order
                                        .booster
                                        .email
                                    }
                                  </span>
                                </div>
                              ) : (
                                <span className="muted">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <strong>
                                {money(
                                  original
                                )}
                              </strong>

                              <span
                                className="muted"
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                Before fees
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <strong
                                style={{
                                  color:
                                    "#fca5a5",
                                }}
                              >
                                -{money(
                                  platformFee
                                )}
                              </strong>

                              <span
                                className="muted"
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                {
                                  savedFeePercent
                                }
                                %
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <strong
                                style={{
                                  color:
                                    extraPenalty >
                                    0
                                      ? "#fca5a5"
                                      : "#8995ab",
                                }}
                              >
                                -{money(
                                  extraPenalty
                                )}
                              </strong>

                              <span
                                className="muted"
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                {
                                  savedPenaltyPercent
                                }
                                %
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <strong
                                style={{
                                  color:
                                    "#6ee7b7",
                                  fontSize:
                                    "15px",
                                }}
                              >
                                {money(
                                  boosterAmount
                                )}
                              </strong>

                              <span
                                className="muted"
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                Net earnings
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                            >
                              <strong>
                                {egp.toFixed(
                                  2
                                )}
                              </strong>

                              <span
                                className="muted"
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "5px",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                EGP
                              </span>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                              onClick={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                            >
                              <select
                                value={
                                  order.status
                                }
                                onClick={(
                                  event
                                ) =>
                                  event.stopPropagation()
                                }
                                onChange={(
                                  event
                                ) => {
                                  event.stopPropagation();

                                  updateStatus(
                                    order.id,
                                    event.target
                                      .value
                                  );
                                }}
                                style={{
                                  width:
                                    "145px",
                                  padding:
                                    "9px 10px",
                                  borderRadius:
                                    "9px",
                                  border:
                                    "1px solid #2b3550",
                                  background:
                                    "#0b1120",
                                  color:
                                    "#ffffff",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                <option value="PENDING">
                                  PENDING
                                </option>

                                <option value="IN_PROGRESS">
                                  IN PROGRESS
                                </option>

                                <option value="COMPLETED">
                                  COMPLETED
                                </option>

                                <option value="CANCELLED">
                                  CANCELLED
                                </option>
                              </select>

                              <div
                                style={{
                                  marginTop:
                                    "7px",
                                  display:
                                    "inline-flex",
                                  padding:
                                    "4px 8px",
                                  borderRadius:
                                    "999px",
                                  fontSize:
                                    "10px",
                                  fontWeight:
                                    700,
                                  background:
                                    statusStyle.background,
                                  color:
                                    statusStyle.color,
                                }}
                              >
                                {
                                  order.status
                                }
                              </div>
                            </td>

                            <td
                              style={{
                                padding:
                                  "18px",
                                verticalAlign:
                                  "top",
                                borderTop:
                                  "1px solid rgba(255,255,255,0.07)",
                              }}
                              onClick={(
                                event
                              ) =>
                                event.stopPropagation()
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  deleteOrder(
                                    order.id,
                                    order.title
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 12px",
                                  border:
                                    "1px solid rgba(239,68,68,0.25)",
                                  borderRadius:
                                    "9px",
                                  background:
                                    "rgba(239,68,68,0.08)",
                                  color:
                                    "#fca5a5",
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    700,
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>

                          {expanded && (
                            <tr>
                              <td
                                colSpan={10}
                                style={{
                                  padding:
                                    "0 18px 20px 18px",
                                  background:
                                    "rgba(255,255,255,0.012)",
                                }}
                              >
                                <div
                                  style={{
                                    marginLeft:
                                      "44px",
                                    padding:
                                      "20px",
                                    border:
                                      "1px solid #202a42",
                                    borderRadius:
                                      "14px",
                                    background:
                                      "#0b1120",
                                  }}
                                >
                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(3, minmax(0, 1fr))",
                                      gap:
                                        "14px",
                                    }}
                                  >
                                    <div>
                                      <span className="muted">
                                        Order ID
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                          color:
                                            "#a89fff",
                                        }}
                                      >
                                        {
                                          order.id
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Character Name
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.characterName ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        BattleTag
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.battleTag ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Faction
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.faction ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Server Name
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.serverName ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Region
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.region ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        VPN Location
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {
                                          order.vpnLocation ||
                                          "—"
                                        }
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Created
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {formatDate(
                                          order.createdAt
                                        )}
                                      </strong>
                                    </div>

                                    <div>
                                      <span className="muted">
                                        Completed
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {formatDate(
                                          order.completedAt
                                        )}
                                      </strong>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      marginTop:
                                        "18px",
                                    }}
                                  >
                                    <span
                                      className="muted"
                                      style={{
                                        display:
                                          "block",
                                        marginBottom:
                                          "7px",
                                      }}
                                    >
                                      Order Description
                                    </span>

                                    <div
                                      style={{
                                        padding:
                                          "13px 14px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                        background:
                                          "#10172a",
                                        color:
                                          order.description
                                            ? "#dbe4f5"
                                            : "#64748b",
                                        fontSize:
                                          "13px",
                                        lineHeight:
                                          "1.6",
                                      }}
                                    >
                                      {
                                        order.description ||
                                        "No description provided."
                                      }
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      marginTop:
                                        "18px",
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(5, minmax(0, 1fr))",
                                      gap:
                                        "10px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        padding:
                                          "13px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      <span className="muted">
                                        Original
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {money(
                                          original
                                        )}
                                      </strong>
                                    </div>

                                    <div
                                      style={{
                                        padding:
                                          "13px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      <span className="muted">
                                        Platform{" "}
                                        {
                                          savedFeePercent
                                        }
                                        %
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                          color:
                                            "#fca5a5",
                                        }}
                                      >
                                        -{money(
                                          platformFee
                                        )}
                                      </strong>
                                    </div>

                                    <div
                                      style={{
                                        padding:
                                          "13px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      <span className="muted">
                                        Extra Penalty{" "}
                                        {
                                          savedPenaltyPercent
                                        }
                                        %
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                          color:
                                            extraPenalty >
                                            0
                                              ? "#fca5a5"
                                              : "#8995ab",
                                        }}
                                      >
                                        -{money(
                                          extraPenalty
                                        )}
                                      </strong>
                                    </div>

                                    <div
                                      style={{
                                        padding:
                                          "13px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      <span className="muted">
                                        Booster Net
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                          color:
                                            "#6ee7b7",
                                        }}
                                      >
                                        {money(
                                          boosterAmount
                                        )}
                                      </strong>
                                    </div>

                                    <div
                                      style={{
                                        padding:
                                          "13px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      <span className="muted">
                                        EGP
                                      </span>

                                      <strong
                                        style={{
                                          display:
                                            "block",
                                        }}
                                      >
                                        {egp.toFixed(
                                          2
                                        )}{" "}
                                        EGP
                                      </strong>
                                    </div>
                                  </div>

                                  {order.payment && (
                                    <div
                                      style={{
                                        marginTop:
                                          "18px",
                                        padding:
                                          "14px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                        display:
                                          "grid",
                                        gridTemplateColumns:
                                          "repeat(3, minmax(0, 1fr))",
                                        gap:
                                          "12px",
                                      }}
                                    >
                                      <div>
                                        <span className="muted">
                                          Payment Status
                                        </span>

                                        <strong
                                          style={{
                                            display:
                                              "block",
                                          }}
                                        >
                                          {
                                            order
                                              .payment
                                              .status
                                          }
                                        </strong>
                                      </div>

                                      <div>
                                        <span className="muted">
                                          Release Date
                                        </span>

                                        <strong
                                          style={{
                                            display:
                                              "block",
                                          }}
                                        >
                                          {formatDate(
                                            order
                                              .payment
                                              .releaseAt
                                          )}
                                        </strong>
                                      </div>

                                      <div>
                                        <span className="muted">
                                          Paid Date
                                        </span>

                                        <strong
                                          style={{
                                            display:
                                              "block",
                                          }}
                                        >
                                          {formatDate(
                                            order
                                              .payment
                                              .paidAt
                                          )}
                                        </strong>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
          CREATE ORDER MODAL
      ================================================= */}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0,0,0,0.78)",
            overflowY: "auto",
          }}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div
            style={{
              width:
                "min(760px, 100%)",
              maxHeight:
                "calc(100vh - 40px)",
              overflowY: "auto",
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
              Create Order
            </h2>

            <p
              className="muted"
              style={{
                margin:
                  "0 0 24px",
              }}
            >
              Add complete order
              information.
            </p>

            {/* ORDER ID */}

            <div
              style={{
                padding:
                  "14px",
                marginBottom:
                  "18px",
                border:
                  "1px solid rgba(109,93,252,0.18)",
                borderRadius:
                  "12px",
                background:
                  "rgba(109,93,252,0.05)",
              }}
            >
              <label className="login-form">
                <span>
                  Order ID
                </span>

                <input
                  value={orderId}
                  onChange={(
                    event
                  ) =>
                    setOrderId(
                      event.target.value
                        .trimStart()
                    )
                  }
                  placeholder="Example: TR-2026-001"
                  required
                />

                <small
                  className="muted"
                  style={{
                    marginTop:
                      "-7px",
                  }}
                >
                  Enter the Order ID
                  manually. It must be
                  unique.
                </small>
              </label>
            </div>

            <form
              onSubmit={
                createOrder
              }
              style={{
                display:
                  "grid",
                gap: "16px",
              }}
            >
              {/* TITLE + GAME */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "2fr 1fr",
                  gap: "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    Order Title
                  </span>

                  <input
                    value={title}
                    onChange={(
                      event
                    ) =>
                      setTitle(
                        event.target.value
                      )
                    }
                    placeholder="Example: Mythic +20"
                    required
                  />
                </label>

                <label className="login-form">
                  <span>
                    Game
                  </span>

                  <input
                    value={game}
                    onChange={(
                      event
                    ) =>
                      setGame(
                        event.target.value
                      )
                    }
                    placeholder="World of Warcraft"
                    required
                  />
                </label>
              </div>

              {/* CUSTOMER */}

              <label className="login-form">
                <span>
                  Customer
                </span>

                <input
                  value={customer}
                  onChange={(
                    event
                  ) =>
                    setCustomer(
                      event.target.value
                    )
                  }
                  placeholder="Customer name"
                />
              </label>

              {/* DESCRIPTION */}

              <label className="login-form">
                <span>
                  Order Description
                </span>

                <textarea
                  value={description}
                  onChange={(
                    event
                  ) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Describe the order..."
                  rows={4}
                  style={{
                    width:
                      "100%",
                    resize:
                      "vertical",
                    padding:
                      "13px",
                  }}
                />
              </label>

              {/* CHARACTER + BATTLETAG */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    Character Name
                  </span>

                  <input
                    value={characterName}
                    onChange={(
                      event
                    ) =>
                      setCharacterName(
                        event.target.value
                      )
                    }
                    placeholder="Character name"
                  />
                </label>

                <label className="login-form">
                  <span>
                    BattleTag
                  </span>

                  <input
                    value={battleTag}
                    onChange={(
                      event
                    ) =>
                      setBattleTag(
                        event.target.value
                      )
                    }
                    placeholder="Player#1234"
                  />
                </label>
              </div>

              {/* FACTION + SERVER */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    Faction
                  </span>

                  <select
                    value={faction}
                    onChange={(
                      event
                    ) =>
                      setFaction(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select faction
                    </option>

                    <option value="Alliance">
                      Alliance
                    </option>

                    <option value="Horde">
                      Horde
                    </option>
                  </select>
                </label>

                <label className="login-form">
                  <span>
                    Server Name
                  </span>

                  <input
                    value={serverName}
                    onChange={(
                      event
                    ) =>
                      setServerName(
                        event.target.value
                      )
                    }
                    placeholder="Server name"
                  />
                </label>
              </div>

              {/* VPN + REGION */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label className="login-form">
                  <span>
                    VPN Location
                  </span>

                  <input
                    value={vpnLocation}
                    onChange={(
                      event
                    ) =>
                      setVpnLocation(
                        event.target.value
                      )
                    }
                    placeholder="California"
                  />
                </label>

                <label className="login-form">
                  <span>
                    Region
                  </span>

                  <select
                    value={region}
                    onChange={(
                      event
                    ) =>
                      setRegion(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select region
                    </option>

                    <option value="US">
                      US
                    </option>

                    <option value="EU">
                      EU
                    </option>

                    <option value="KR">
                      KR
                    </option>

                    <option value="TW">
                      TW
                    </option>

                    <option value="CN">
                      CN
                    </option>
                  </select>
                </label>
              </div>

              {/* PRICE */}

              <label className="login-form">
                <span>
                  Order Price USD
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={priceUsd}
                  onChange={(
                    event
                  ) =>
                    setPriceUsd(
                      event.target.value
                    )
                  }
                  placeholder="100.00"
                  required
                />
              </label>

              {/* BOOSTER */}

              <label className="login-form">
                <span>Assign Booster</span>

                <div className="booster-dropdown">
                  <button
                    type="button"
                    className="booster-dropdown-button"
                    onClick={() => {
                      const element =
                        document.getElementById(
                          "booster-options"
                        );

                      if (element) {
                        element.classList.toggle(
                          "open"
                        );
                      }
                    }}
                  >
                    <span className="booster-selected-icon">
                      👤
                    </span>

                    <span className="booster-selected-content">
                      {boosterId
                        ? (() => {
                            const booster =
                              boosters.find(
                                (item) =>
                                  item.id ===
                                  boosterId
                              );

                            return booster ? (
                              <>
                                <strong>
                                  {booster.name}
                                </strong>

                                <small>
                                  {booster.email}
                                </small>
                              </>
                            ) : (
                              <strong>
                                Unassigned
                              </strong>
                            );
                          })()
                        : (
                          <strong className="booster-placeholder">
                            Select Booster
                          </strong>
                        )}
                    </span>

                    <span className="booster-arrow">
                      ˅
                    </span>
                  </button>

                  <div
                    id="booster-options"
                    className="booster-dropdown-options"
                  >
                    <button
                      type="button"
                      className="booster-option"
                      onClick={() => {
                        setBoosterId("");

                        setPlatformFeePercent(
                          defaultPlatformFee
                        );

                        setExtraPenaltyPercent(defaultExtraPenalty);

                        document
                          .getElementById(
                            "booster-options"
                          )
                          ?.classList.remove(
                            "open"
                          );
                      }}
                    >
                      <span className="booster-option-avatar">
                        —
                      </span>

                      <span className="booster-option-text">
                        <strong>
                          Unassigned
                        </strong>

                        <small>
                          No booster assigned
                        </small>
                      </span>
                    </button>

                    {boosters.map((booster) => (
                      <button
                        type="button"
                        key={booster.id}
                        className={
                          boosterId ===
                          booster.id
                            ? "booster-option selected"
                            : "booster-option"
                        }
                        onClick={() => {
                          const selectedBooster =
                            boosters.find(
                              (item) =>
                                item.id ===
                                booster.id
                            );

                          setBoosterId(
                            booster.id
                          );

                          if (selectedBooster) {
                            setPlatformFeePercent(
                              String(
                                selectedBooster.platformFeePercent
                              )
                            );

                            setExtraPenaltyPercent(
                              String(
                                selectedBooster.extraPenaltyPercent
                              )
                            );
                          } else {
                            setPlatformFeePercent(
                              defaultPlatformFee
                            );

                            setExtraPenaltyPercent(
                              defaultExtraPenalty
                            );
                          }

                          document
                            .getElementById(
                              "booster-options"
                            )
                            ?.classList.remove(
                              "open"
                            );
                        }}
                      >
                        <span className="booster-option-avatar">
                          {booster.name
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <span className="booster-option-text">
                          <strong>
                            {booster.name}
                          </strong>

                          <small>
                            {booster.email}
                          </small>
                        </span>

                        {boosterId ===
                          booster.id && (
                          <span className="booster-check">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </label>

              {/* FEES */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "14px",
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
                      platformFeePercent
                    }
                    onChange={(
                      event
                    ) =>
                      setPlatformFeePercent(
                        event.target.value
                      )
                    }
                    required
                  />

                  <small
                    className="muted"
                    style={{
                      marginTop:
                        "-7px",
                    }}
                  >
                    Default comes from the
                    selected booster.
                  </small>
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
                      extraPenaltyPercent
                    }
                    onChange={(
                      event
                    ) =>
                      setExtraPenaltyPercent(
                        event.target.value
                      )
                    }
                    required
                  />

                  <small
                    className="muted"
                    style={{
                      marginTop:
                        "-7px",
                    }}
                  >
                    0% means no extra
                    penalty.
                  </small>
                </label>
              </div>

              {/* PRICE PREVIEW */}

              {previewPrice > 0 && (
                <div
                  style={{
                    padding:
                      "16px",
                    border:
                      "1px solid #202a42",
                    borderRadius:
                      "13px",
                    background:
                      "#0b1120",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      marginBottom:
                        "9px",
                    }}
                  >
                    <span className="muted">
                      Original Price
                    </span>

                    <strong>
                      {money(
                        previewPrice
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      marginBottom:
                        "9px",
                    }}
                  >
                    <span className="muted">
                      Platform Fee (
                      {previewFeePercent}
                      %)
                    </span>

                    <strong
                      style={{
                        color:
                          "#fca5a5",
                      }}
                    >
                      -{money(
                        previewFee
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      marginBottom:
                        "9px",
                    }}
                  >
                    <span className="muted">
                      Extra Penalty (
                      {
                        previewPenaltyPercent
                      }
                      %)
                    </span>

                    <strong
                      style={{
                        color:
                          previewPenalty >
                          0
                            ? "#fca5a5"
                            : "#8995ab",
                      }}
                    >
                      -{money(
                        previewPenalty
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      borderTop:
                        "1px solid #202a42",
                      paddingTop:
                        "11px",
                    }}
                  >
                    <span>
                      Booster Net
                    </span>

                    <strong
                      style={{
                        color:
                          "#6ee7b7",
                        fontSize:
                          "18px",
                      }}
                    >
                      {money(
                        previewBooster
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      marginTop:
                        "9px",
                    }}
                  >
                    <span className="muted">
                      Booster EGP
                    </span>

                    <strong>
                      {previewEgp.toFixed(
                        2
                      )}{" "}
                      EGP
                    </strong>
                  </div>
                </div>
              )}

              {/* EXCHANGE RATE */}

              <label className="login-form">
                <span>
                  USD → EGP Rate
                </span>

                <input
                  type="number"
                  value={exchangeRate}
                  readOnly
                  placeholder="Loading..."
                  required
                />

                <small
                  style={{
                    color:
                      "#6ee7b7",
                    marginTop:
                      "-7px",
                  }}
                >
                  ✓ Live exchange rate
                </small>
              </label>

              {/* ERROR */}

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              {/* BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                  paddingTop:
                    "5px",
                }}
              >
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    padding:
                      "11px 17px",
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
                  disabled={saving}
                  style={{
                    padding:
                      "11px 18px",
                  }}
                >
                  {saving
                    ? "Creating..."
                    : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}