"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Fine = {
  id: string;
  reason: string;
  amountUsd: number;
  remainingUsd: number;
  createdAt: string;
};

type PaymentDetail = {
  orderId: string;
  title: string;

  originalUsd: number;
  platformFeeUsd: number;
  extraPenaltyUsd: number;
  boosterAmountUsd: number;

  finedUsd: number;
  netAmountUsd: number;

  exchangeRate: number;
  amountEgp: number;

  paidAmountUsd: number;
  paidExchangeRate: number | null;
  paidAmountEgp: number | null;

  paymentStatus: string;
  orderStatus?: string;

  createdAt?: string;
  completedAt: string | null;
  releaseAt: string | null;
  paidAt: string | null;
};

type BoosterPayment = {
  id: string;
  name: string;
  email: string;
  active: boolean;

  orders: number;

  grossUsd: number;
  platformFeeUsd: number;
  boosterAmountUsd: number;

  totalEarnedAfterFeesAndFines: number;
  expectedPayableUsd: number;

  balanceUsd: number;
  onHoldUsd: number;
  finedUsd: number;
  paidUsd: number;

  status: string;

  fines: Fine[];
  details: PaymentDetail[];
};

type Totals = {
  boosters: number;
  orders: number;
  grossUsd: number;
  platformFeeUsd: number;
  boosterAmountUsd: number;

  balanceUsd: number;
  onHoldUsd: number;
  finedUsd: number;
  paidUsd: number;
};

type PaymentsResponse = {
  month: string;
  holdDays: number;
  payments: BoosterPayment[];
  totals: Totals;
};

function getCurrentMonth() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function formatMoney(value: number) {
  const amount = Number(value || 0);

  if (amount < 0) {
    return `-$${Math.abs(amount).toFixed(2)}`;
  }

  return `$${amount.toFixed(2)}`;
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function getHoldTime(
  releaseAt: string | null
) {
  if (!releaseAt) {
    return null;
  }

  const remaining =
    new Date(releaseAt).getTime() -
    Date.now();

  if (remaining <= 0) {
    return "Available";
  }

  const totalMinutes = Math.ceil(
    remaining / (1000 * 60)
  );

  const days = Math.floor(
    totalMinutes / (60 * 24)
  );

  const hours = Math.floor(
    (totalMinutes % (60 * 24)) / 60
  );

  const minutes =
    totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export default function PaymentsPage() {
  const [payments, setPayments] =
    useState<BoosterPayment[]>([]);

  const [totals, setTotals] =
    useState<Totals | null>(null);

  const [month, setMonth] =
    useState(getCurrentMonth());

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [expandedBooster, setExpandedBooster] =
    useState<string | null>(null);

  const [payingBooster, setPayingBooster] =
    useState<string | null>(null);

  const [fineBooster, setFineBooster] =
    useState<BoosterPayment | null>(null);

  const [fineAmount, setFineAmount] =
    useState("");

  const [fineReason, setFineReason] =
    useState("");

  const [savingFine, setSavingFine] =
    useState(false);

  const [payBoosterModal, setPayBoosterModal] =
    useState<BoosterPayment | null>(null);

  const [payExchangeRate, setPayExchangeRate] =
    useState("");

  const [savingPayment, setSavingPayment] =
    useState(false);

  // =====================================================
  // LOAD PAYMENTS
  // =====================================================

  async function loadPayments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/payments?month=${encodeURIComponent(
          month
        )}`,
        {
          cache: "no-store",
        }
      );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Failed to load payments";

        throw new Error(message);
      }

      const result =
        data as PaymentsResponse;

      setPayments(
        Array.isArray(result.payments)
          ? result.payments
          : []
      );

      setTotals(
        result.totals ?? null
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payments"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, [month]);

  // =====================================================
  // PAY BOOSTER MODAL
  // =====================================================

  function openPayModal(
    booster: BoosterPayment
  ) {
    if (booster.balanceUsd <= 0) {
      return;
    }

    setPayBoosterModal(booster);
    setPayExchangeRate("");
    setError("");
  }

  function closePayModal() {
    if (savingPayment) {
      return;
    }

    setPayBoosterModal(null);
    setPayExchangeRate("");
    setError("");
  }

  async function payBooster() {
    if (!payBoosterModal) {
      return;
    }

    const rate = Number(
      payExchangeRate
    );

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      setError(
        "Please enter a valid exchange rate."
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm payment of ${formatMoney(
        payBoosterModal.balanceUsd
      )} to ${payBoosterModal.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingPayment(true);
      setError("");

      const response = await fetch(
        "/api/payments",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            boosterId:
              payBoosterModal.id,
            month,
            exchangeRate: rate,
          }),
        }
      );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Failed to pay booster";

        throw new Error(message);
      }

      setPayBoosterModal(null);
      setPayExchangeRate("");

      await loadPayments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to pay booster"
      );
    } finally {
      setSavingPayment(false);
    }
  }

  // =====================================================
  // FINE MODAL
  // =====================================================

  function openFineModal(
    booster: BoosterPayment
  ) {
    setFineBooster(booster);
    setFineAmount("");
    setFineReason("");
    setError("");
  }

  function closeFineModal() {
    if (savingFine) {
      return;
    }

    setFineBooster(null);
    setFineAmount("");
    setFineReason("");
  }

  // =====================================================
  // ADD FINE
  // =====================================================

  async function addFine(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!fineBooster) {
      return;
    }

    const amount =
      Number(fineAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Fine amount must be greater than 0."
      );
      return;
    }

    if (!fineReason.trim()) {
      setError(
        "Please enter a reason for the fine."
      );
      return;
    }

    try {
      setSavingFine(true);
      setError("");

      const response =
        await fetch(
          "/api/payments/fine",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              boosterId:
                fineBooster.id,
              amountUsd: amount,
              reason:
                fineReason.trim(),
            }),
          }
        );

      const data: unknown =
        await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Failed to create fine";

        throw new Error(message);
      }

      closeFineModal();

      await loadPayments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create fine"
      );
    } finally {
      setSavingFine(false);
    }
  }

  async function deleteFine(
    fine: Fine
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete this fine?\n\n${fine.reason}\n-${formatMoney(
          fine.amountUsd
        )}`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response =
        await fetch(
          `/api/payments/fine?id=${encodeURIComponent(
            fine.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete fine"
        );
      }

      await loadPayments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete fine"
      );
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

          <Link
            href="/payments"
            className="active"
          >
            💰 Payments
          </Link>

          <Link href="/settings">
            ⚙️ Settings
          </Link>
        </nav>

        <button
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
            <h1>Payments</h1>

            <p>
              Manage monthly booster
              balances, holds and
              payments.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                color: "#8995ab",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Month
            </span>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(
                  event.target.value
                )
              }
              style={{
                padding:
                  "10px 12px",
                borderRadius:
                  "10px",
                border:
                  "1px solid #273249",
                background:
                  "#0b1120",
                color:
                  "#eef2ff",
              }}
            />
          </div>
        </header>

        {/* =================================================
            MAIN STATS
        ================================================= */}

        <div className="stats">
          <div className="stat">
            <span>Balance</span>

            <strong
              style={{
                color:
                  (totals?.balanceUsd ??
                    0) < 0
                    ? "#fca5a5"
                    : "#6ee7b7",
              }}
            >
              {formatMoney(
                totals?.balanceUsd ?? 0
              )}
            </strong>

            <small>
              Available to pay
            </small>
          </div>

          <div className="stat">
            <span>On Hold</span>

            <strong
              style={{
                color:
                  "#fcd34d",
              }}
            >
              {formatMoney(
                totals?.onHoldUsd ?? 0
              )}
            </strong>

            <small>
              Waiting 5 days
            </small>
          </div>

          <div className="stat">
            <span>Fined</span>

            <strong
              style={{
                color:
                  "#fca5a5",
              }}
            >
              {formatMoney(
                totals?.finedUsd ?? 0
              )}
            </strong>

            <small>
              Manual fines
            </small>
          </div>

          <div className="stat">
            <span>Paid</span>

            <strong>
              {formatMoney(
                totals?.paidUsd ?? 0
              )}
            </strong>

            <small>
              Paid this month
            </small>
          </div>
        </div>

        {/* =================================================
            SECONDARY STATS
        ================================================= */}

        <div className="stats">
          <div className="stat">
            <span>
              Boosters
            </span>

            <strong>
              {totals?.boosters ?? 0}
            </strong>
          </div>

          <div className="stat">
            <span>
              Orders
            </span>

            <strong>
              {totals?.orders ?? 0}
            </strong>
          </div>

          <div className="stat">
            <span>
              Total Money
            </span>

            <strong>
              {formatMoney(
                totals?.grossUsd ?? 0
              )}
            </strong>

            <small>
              Before 7% fee
            </small>
          </div>

          <div className="stat">
            <span>
              Platform Fee
            </span>

            <strong
              style={{
                color:
                  "#fca5a5",
              }}
            >
              -
              {formatMoney(
                totals?.platformFeeUsd ??
                  0
              )}
            </strong>

            <small>7%</small>
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
            BOOSTER PAYMENTS
        ================================================= */}

        <section className="panel">
          <div
            className="section-header"
            style={{
              marginBottom:
                "20px",
            }}
          >
            <div>
              <h2>
                Booster Payments
              </h2>

              <p>
                {month} • Hold
                period: 5 days
              </p>
            </div>

            <button
  type="button"
  onClick={loadPayments}
  disabled={loading}
  className="refresh-payments-button"
>
  <span
    className={
      loading
        ? "refresh-icon spinning"
        : "refresh-icon"
    }
  >
  
  </span>

  <span>
    {loading ? "Refreshing..." : "Refresh"}
  </span>
</button>
          </div>

          {loading ? (
            <div className="empty">
              Loading payments...
            </div>
          ) : payments.length ===
            0 ? (
            <div className="empty">
              <div className="empty-icon">
                💰
              </div>

              <h3>
                No boosters found
              </h3>

              <p>
                Booster payment
                data will appear
                here.
              </p>
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
                  minWidth:
                    "1450px",
                }}
              >
                <thead>
                  <tr>
                    <th>
                      Booster
                    </th>

                    <th>
                      Orders
                    </th>

                    <th>
                      Total Money
                    </th>

                    <th>
                      Balance
                    </th>

                    <th>
                      On Hold
                    </th>

                    <th>
                      Fined
                    </th>

                    <th>
                      Paid
                    </th>

                    <th>
                      Expected Payable
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map(
                    (payment) => {
                      const expanded =
                        expandedBooster ===
                        payment.id;

                      const hasDebt =
                        payment.balanceUsd <
                        0;

                      return (
                        <>
                          <tr
                            key={
                              payment.id
                            }
                          >
                            {/* BOOSTER */}

                            <td>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBooster(
                                    expanded
                                      ? null
                                      : payment.id
                                  )
                                }
                                style={{
                                  border:
                                    "none",
                                  background:
                                    "transparent",
                                  color:
                                    "#eef2ff",
                                  padding: 0,
                                  textAlign:
                                    "left",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                <strong>
                                  {
                                    payment.name
                                  }
                                </strong>

                                <div
                                  className="muted"
                                  style={{
                                    fontSize:
                                      "12px",
                                    marginTop:
                                      "3px",
                                  }}
                                >
                                  {
                                    payment.email
                                  }
                                </div>
                              </button>
                            </td>

                            {/* ORDERS */}

                            <td>
                              {
                                payment.orders
                              }
                            </td>

                            {/* TOTAL MONEY */}

                            <td>
                              <strong>
                                {formatMoney(
                                  payment.grossUsd
                                )}
                              </strong>
                            </td>

                            {/* BALANCE */}

                            <td>
                              <strong
                                style={{
                                  color:
                                    hasDebt
                                      ? "#fca5a5"
                                      : payment.balanceUsd >
                                        0
                                      ? "#6ee7b7"
                                      : "#8995ab",
                                }}
                              >
                                {formatMoney(
                                  payment.balanceUsd
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
                                      "3px",
                                  }}
                                >
                                  Owes money
                                </div>
                              )}
                            </td>

                            {/* ON HOLD */}

                            <td>
                              <strong
                                style={{
                                  color:
                                    payment.onHoldUsd >
                                    0
                                      ? "#fcd34d"
                                      : "#8995ab",
                                }}
                              >
                                {formatMoney(
                                  payment.onHoldUsd
                                )}
                              </strong>
                            </td>

                            {/* FINED */}

                            <td>
                              <strong
                                style={{
                                  color:
                                    payment.finedUsd >
                                    0
                                      ? "#fca5a5"
                                      : "#8995ab",
                                }}
                              >
                                {formatMoney(
                                  payment.finedUsd
                                )}
                              </strong>
                            </td>

                            {/* PAID */}

                            <td>
                              <strong>
                                {formatMoney(
                                  payment.paidUsd
                                )}
                              </strong>
                            </td>

                            {/* EXPECTED PAYABLE */}

                            <td>
                              <strong
                                style={{
                                  color:
                                    payment.expectedPayableUsd <
                                    0
                                      ? "#fca5a5"
                                      : "#6ee7b7",
                                  fontSize:
                                    "15px",
                                }}
                              >
                                {formatMoney(
                                  payment.expectedPayableUsd
                                )}
                              </strong>

                              <div
                                className="muted"
                                style={{
                                  fontSize:
                                    "10px",
                                  marginTop:
                                    "3px",
                                }}
                              >
                                Includes
                                on-hold
                              </div>
                            </td>

                            {/* STATUS */}

                            <td>
                              <span
                                style={{
                                  display:
                                    "inline-flex",
                                  padding:
                                    "6px 10px",
                                  borderRadius:
                                    "999px",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,

                                  background:
                                    hasDebt
                                      ? "rgba(239,68,68,0.1)"
                                      : payment.status ===
                                        "AVAILABLE"
                                      ? "rgba(34,197,94,0.1)"
                                      : payment.status ===
                                        "ON HOLD"
                                      ? "rgba(245,158,11,0.1)"
                                      : "rgba(255,255,255,0.05)",

                                  color:
                                    hasDebt
                                      ? "#fca5a5"
                                      : payment.status ===
                                        "AVAILABLE"
                                      ? "#6ee7b7"
                                      : payment.status ===
                                        "ON HOLD"
                                      ? "#fcd34d"
                                      : "#cbd5e1",
                                }}
                              >
                                {hasDebt
                                  ? "OWES MONEY"
                                  : payment.status}
                              </span>
                            </td>

                            {/* ACTIONS */}

                            <td>
                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap:
                                    "7px",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    openFineModal(
                                      payment
                                    )
                                  }
                                  style={{
                                    padding:
                                      "8px 11px",
                                    border:
                                      "1px solid rgba(239,68,68,0.22)",
                                    borderRadius:
                                      "9px",
                                    background:
                                      "rgba(239,68,68,0.07)",
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
                                  Fine
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openPayModal(
                                      payment
                                    )
                                  }
                                  disabled={
                                    payment.balanceUsd <=
                                      0
                                  }
                                  style={{
                                    padding:
                                      "8px 11px",
                                    border:
                                      "1px solid rgba(109,93,252,0.25)",
                                    borderRadius:
                                      "9px",
                                    background:
                                      payment.balanceUsd >
                                      0
                                        ? "rgba(109,93,252,0.12)"
                                        : "rgba(255,255,255,0.04)",
                                    color:
                                      payment.balanceUsd >
                                      0
                                        ? "#c4bfff"
                                        : "#64718a",
                                    fontSize:
                                      "12px",
                                    fontWeight:
                                      700,
                                    cursor:
                                      payment.balanceUsd >
                                      0
                                        ? "pointer"
                                        : "not-allowed",
                                  }}
                                >
                                  Pay
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* =================================================
                              EXPANDED BOOSTER DETAILS
                          ================================================= */}

                          {expanded && (
                            <tr
                              key={`${payment.id}-details`}
                            >
                              <td
                                colSpan={10}
                                style={{
                                  padding:
                                    "18px 12px",
                                  background:
                                    "rgba(255,255,255,0.018)",
                                }}
                              >
                                {/* FINANCIAL SUMMARY */}

                                <div
                                  style={{
                                    display:
                                      "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fit, minmax(160px, 1fr))",
                                    gap:
                                      "12px",
                                    marginBottom:
                                      "20px",
                                  }}
                                >
                                  <div className="stat">
                                    <span>
                                      Total Money
                                    </span>

                                    <strong>
                                      {formatMoney(
                                        payment.grossUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      7% Platform
                                      Fee
                                    </span>

                                    <strong
                                      style={{
                                        color:
                                          "#fca5a5",
                                      }}
                                    >
                                      -
                                      {formatMoney(
                                        payment.platformFeeUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      Booster
                                      Earnings
                                    </span>

                                    <strong>
                                      {formatMoney(
                                        payment.boosterAmountUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      Fines
                                    </span>

                                    <strong
                                      style={{
                                        color:
                                          payment.finedUsd >
                                          0
                                            ? "#fca5a5"
                                            : "#8e9ab6",
                                      }}
                                    >
                                      -
                                      {formatMoney(
                                        payment.finedUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      Total After
                                      Fees & Fines
                                    </span>

                                    <strong>
                                      {formatMoney(
                                        payment.totalEarnedAfterFeesAndFines
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      On Hold
                                    </span>

                                    <strong
                                      style={{
                                        color:
                                          payment.onHoldUsd >
                                          0
                                            ? "#facc15"
                                            : "#8e9ab6",
                                      }}
                                    >
                                      {formatMoney(
                                        payment.onHoldUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      Paid
                                    </span>

                                    <strong>
                                      {formatMoney(
                                        payment.paidUsd
                                      )}
                                    </strong>
                                  </div>

                                  <div className="stat">
                                    <span>
                                      Expected Payable
                                    </span>

                                    <strong
                                      style={{
                                        color:
                                          payment.expectedPayableUsd <
                                          0
                                            ? "#fca5a5"
                                            : "#6ee7b7",
                                        fontSize:
                                          "18px",
                                      }}
                                    >
                                      {formatMoney(
                                        payment.expectedPayableUsd
                                      )}
                                    </strong>

                                    <small>
                                      Includes
                                      on-hold money
                                    </small>
                                  </div>
                                </div>

                                {/* ORDERS */}

                                <div
                                  style={{
                                    marginBottom:
                                      "20px",
                                  }}
                                >
                                  <h3
                                    style={{
                                      margin:
                                        "0 0 12px",
                                      fontSize:
                                        "15px",
                                    }}
                                  >
                                    Orders
                                  </h3>

                                  <div
                                    style={{
                                      overflowX:
                                        "auto",
                                    }}
                                  >
                                    <table
                                      style={{
                                        minWidth:
                                          "1050px",
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th>
                                            Order
                                          </th>

                                          <th>
                                            Original
                                          </th>

                                          <th>
                                            7% Fee
                                          </th>

                                          <th>
                                            Booster
                                          </th>

                                          <th>
                                            Fined
                                          </th>

                                          <th>
                                            Net
                                          </th>

                                          <th>
                                            EGP
                                          </th>

                                          <th>
                                            Release
                                          </th>

                                          <th>
                                            Status
                                          </th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {payment.details.map(
                                          (
                                            detail
                                          ) => {
                                            const hold =
                                              getHoldTime(
                                                detail.releaseAt
                                              );

                                            const isCancelled =
                                              detail.orderStatus ===
                                              "CANCELLED";

                                            return (
                                              <tr
                                                key={
                                                  detail.orderId
                                                }
                                              >
                                                {/* ORDER */}

                                                <td>
                                                  <strong>
                                                    {
                                                      detail.title
                                                    }
                                                  </strong>

                                                  <div
                                                    className="muted"
                                                    style={{
                                                      fontSize:
                                                        "11px",
                                                      marginTop:
                                                        "3px",
                                                    }}
                                                  >
                                                    Order ID:{" "}
                                                    {
                                                      detail.orderId
                                                    }
                                                  </div>

                                                  <div
                                                    className="muted"
                                                    style={{
                                                      fontSize:
                                                        "11px",
                                                      marginTop:
                                                        "3px",
                                                    }}
                                                  >
                                                    Completed:{" "}
                                                    {formatDate(
                                                      detail.completedAt
                                                    )}
                                                  </div>
                                                </td>

                                                {/* ORIGINAL */}

                                                <td>
                                                  {formatMoney(
                                                    detail.originalUsd
                                                  )}
                                                </td>

                                                {/* FEE */}

                                                <td>
                                                  <span
                                                    style={{
                                                      color:
                                                        "#fca5a5",
                                                    }}
                                                  >
                                                    -
                                                    {formatMoney(
                                                      detail.platformFeeUsd
                                                    )}
                                                  </span>
                                                </td>

                                                {/* BOOSTER */}

                                                <td>
                                                  {formatMoney(
                                                    detail.boosterAmountUsd
                                                  )}
                                                </td>

                                                {/* FINED */}

                                                <td>
                                                  <span
                                                    style={{
                                                      color:
                                                        detail.finedUsd >
                                                        0
                                                          ? "#fca5a5"
                                                          : "#8995ab",
                                                    }}
                                                  >
                                                    -
                                                    {formatMoney(
                                                      detail.finedUsd
                                                    )}
                                                  </span>
                                                </td>

                                                {/* NET */}

                                                <td>
                                                  <strong
                                                    style={{
                                                      color:
                                                        isCancelled
                                                          ? "#8995ab"
                                                          : "#6ee7b7",
                                                    }}
                                                  >
                                                    {formatMoney(
                                                      detail.netAmountUsd
                                                    )}
                                                  </strong>
                                                </td>

                                                {/* EGP */}

                                                <td>
                                                  <strong>
                                                    {Number(
                                                      detail.amountEgp ||
                                                        0
                                                    ).toFixed(
                                                      2
                                                    )}{" "}
                                                    EGP
                                                  </strong>
                                                </td>

                                                {/* RELEASE */}

                                                <td>
                                                  {isCancelled ? (
                                                    <strong
                                                      style={{
                                                        color:
                                                          "#fca5a5",
                                                      }}
                                                    >
                                                      Cancelled
                                                    </strong>
                                                  ) : detail.paymentStatus ===
                                                    "PAID" ? (
                                                    <div>
                                                      <strong>
                                                        Paid
                                                      </strong>

                                                      <div
                                                        className="muted"
                                                        style={{
                                                          fontSize:
                                                            "11px",
                                                        }}
                                                      >
                                                        {formatDate(
                                                          detail.paidAt
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : hold &&
                                                    hold !==
                                                      "Available" ? (
                                                    <div>
                                                      <strong
                                                        style={{
                                                          color:
                                                            "#fcd34d",
                                                        }}
                                                      >
                                                        {hold}
                                                      </strong>

                                                      <div
                                                        className="muted"
                                                        style={{
                                                          fontSize:
                                                            "11px",
                                                        }}
                                                      >
                                                        {formatDate(
                                                          detail.releaseAt
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <strong
                                                      style={{
                                                        color:
                                                          "#6ee7b7",
                                                      }}
                                                    >
                                                      Available
                                                    </strong>
                                                  )}
                                                </td>

                                                {/* STATUS */}

                                                <td>
                                                  <span
                                                    style={{
                                                      fontSize:
                                                        "11px",
                                                      fontWeight:
                                                        700,

                                                      color:
                                                        isCancelled
                                                          ? "#fca5a5"
                                                          : detail.paymentStatus ===
                                                            "PAID"
                                                          ? "#6ee7b7"
                                                          : detail.paymentStatus ===
                                                            "AVAILABLE"
                                                          ? "#6ee7b7"
                                                          : "#fcd34d",
                                                    }}
                                                  >
                                                    {isCancelled
                                                      ? "CANCELLED"
                                                      : detail.paymentStatus}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          }
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* FINES */}

                                <div>
                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      justifyContent:
                                        "space-between",
                                      alignItems:
                                        "center",
                                      marginBottom:
                                        "12px",
                                    }}
                                  >
                                    <div>
                                      <h3
                                        style={{
                                          margin:
                                            0,
                                          fontSize:
                                            "15px",
                                        }}
                                      >
                                        Fines
                                      </h3>

                                      <p
                                        className="muted"
                                        style={{
                                          margin:
                                            "4px 0 0",
                                          fontSize:
                                            "12px",
                                        }}
                                      >
                                        {
                                          payment
                                            .fines
                                            .length
                                        }{" "}
                                        fine(s)
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openFineModal(
                                          payment
                                        )
                                      }
                                      style={{
                                        padding:
                                          "8px 12px",
                                        border:
                                          "1px solid rgba(239,68,68,0.22)",
                                        borderRadius:
                                          "9px",
                                        background:
                                          "rgba(239,68,68,0.07)",
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
                                      + Add Fine
                                    </button>
                                  </div>

                                  {payment.fines
                                    .length ===
                                  0 ? (
                                    <div
                                      className="muted"
                                      style={{
                                        padding:
                                          "14px",
                                        border:
                                          "1px solid #202a42",
                                        borderRadius:
                                          "10px",
                                      }}
                                    >
                                      No fines
                                      for this
                                      month.
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        display:
                                          "grid",
                                        gap:
                                          "8px",
                                      }}
                                    >
                                      {payment.fines.map(
                                        (
                                          fine
                                        ) => (
                                          <div
                                            key={
                                              fine.id
                                            }
                                            style={{
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                              gap: "15px",
                                              padding: "12px 14px",
                                              border: "1px solid #202a42",
                                              borderRadius: "10px",
                                            }}
                                          >
                                            <div>
                                              <strong>
                                                {
                                                  fine.reason
                                                }
                                              </strong>

                                              <div
                                                className="muted"
                                                style={{
                                                  fontSize: "11px",
                                                  marginTop: "3px",
                                                }}
                                              >
                                                {formatDate(
                                                  fine.createdAt
                                                )}
                                              </div>
                                            </div>

                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                              }}
                                            >
                                              <div>
                                                <strong
                                                  style={{
                                                    color: "#fca5a5",
                                                    whiteSpace: "nowrap",
                                                  }}
                                                >
                                                  -{formatMoney(
                                                    fine.amountUsd
                                                  )}
                                                </strong>

                                                <div
                                                  className="muted"
                                                  style={{
                                                    fontSize: "10px",
                                                    marginTop: "3px",
                                                  }}
                                                >
                                                  Remaining:{" "}
                                                  {formatMoney(
                                                    fine.remainingUsd
                                                  )}
                                                </div>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  deleteFine(
                                                    fine
                                                  )
                                                }
                                                style={{
                                                  padding: "7px 10px",
                                                  border: "1px solid rgba(239,68,68,0.3)",
                                                  borderRadius: "8px",
                                                  background: "rgba(239,68,68,0.08)",
                                                  color: "#fca5a5",
                                                  fontSize: "11px",
                                                  fontWeight: 700,
                                                  cursor: "pointer",
                                                }}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {payBoosterModal && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePayModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0, 0, 0, 0.76)",
          }}
        >
          <div
            style={{
              width:
                "min(440px, 100%)",
              padding: "26px",
              borderRadius:
                "18px",
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
                margin: "0 0 6px",
              }}
            >
              Pay Booster
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom: "20px",
              }}
            >
              Record the exchange rate used for this payment.
            </p>

            <div
              style={{
                display: "grid",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                }}
              >
                <span className="muted">
                  Booster
                </span>

                <strong>
                  {payBoosterModal.name}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                }}
              >
                <span className="muted">
                  USD Amount
                </span>

                <strong
                  style={{
                    color: "#6ee7b7",
                  }}
                >
                  {formatMoney(
                    payBoosterModal.balanceUsd
                  )}
                </strong>
              </div>
            </div>

            <label className="login-form">
              <span>
                Exchange Rate (USD → EGP)
              </span>

              <input
                type="number"
                min="0.01"
                step="0.0001"
                value={payExchangeRate}
                onChange={(event) =>
                  setPayExchangeRate(
                    event.target.value
                  )
                }
                placeholder="Example: 52.5000"
                autoFocus
                required
              />
            </label>

            {Number(payExchangeRate) > 0 && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "15px",
                  border:
                    "1px solid #202a42",
                  borderRadius: "12px",
                  background: "#0b1120",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span className="muted">
                    USD
                  </span>

                  <strong>
                    {formatMoney(
                      payBoosterModal.balanceUsd
                    )}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span className="muted">
                    Rate
                  </span>

                  <strong>
                    {Number(
                      payExchangeRate
                    ).toFixed(4)}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    borderTop:
                      "1px solid #202a42",
                    paddingTop: "10px",
                  }}
                >
                  <span>
                    Paid in EGP
                  </span>

                  <strong
                    style={{
                      color: "#6ee7b7",
                      fontSize: "18px",
                    }}
                  >
                    {(
                      payBoosterModal.balanceUsd *
                      Number(payExchangeRate)
                    ).toFixed(2)} EGP
                  </strong>
                </div>
              </div>
            )}

            {error && (
              <div
                className="login-error"
                style={{
                  marginTop: "16px",
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={closePayModal}
                disabled={savingPayment}
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
                type="button"
                onClick={payBooster}
                disabled={
                  savingPayment ||
                  Number(payExchangeRate) <= 0
                }
                style={{
                  padding:
                    "10px 16px",
                }}
              >
                {savingPayment
                  ? "Paying..."
                  : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          FINE MODAL
      ================================================= */}

      {fineBooster && (
        <div
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeFineModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            background:
              "rgba(0, 0, 0, 0.76)",
          }}
        >
          <div
            style={{
              width:
                "min(440px, 100%)",
              padding: "26px",
              borderRadius:
                "18px",
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
              Add Fine
            </h2>

            <p
              className="muted"
              style={{
                marginTop: 0,
                marginBottom:
                  "20px",
              }}
            >
              Add a manual dollar
deduction for{" "}
<strong
  style={{
    color: "#eef2ff",
  }}
>
  {fineBooster.name}
</strong>
.
</p>

            <form
              onSubmit={addFine}
              style={{
                display:
                  "grid",
                gap: "16px",
              }}
            >
              <label className="login-form">
                <span>
                  Amount USD
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    fineAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setFineAmount(
                      event.target
                        .value
                    )
                  }
                  placeholder="25.00"
                  required
                />
              </label>

              <label className="login-form">
                <span>
                  Reason
                </span>

                <textarea
                  value={
                    fineReason
                  }
                  onChange={(
                    event
                  ) =>
                    setFineReason(
                      event.target
                        .value
                    )
                  }
                  placeholder="Example: Late order, customer complaint..."
                  rows={4}
                  required
                  style={{
                    width: "100%",
                    resize: "vertical",
                    padding:
                      "13px",
                  }}
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
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeFineModal
                  }
                  disabled={
                    savingFine
                  }
                  style={{
                    padding:
                      "10px 15px",
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
                    savingFine
                  }
                  style={{
                    padding:
                      "10px 15px",
                  }}
                >
                  {savingFine
                    ? "Saving..."
                    : "Add Fine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}