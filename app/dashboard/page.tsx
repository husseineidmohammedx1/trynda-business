"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/language-provider";

type Stats = {
  totalRevenue: number;
  platformFees: number;
  boosterEarnings: number;
  activeBoosters: number;
  activeOrders: number;
  completedOrders: number;
};

type Booster = {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
};

type RecentOrder = {
  id: string;
  title: string;
  game: string;
  customer: string | null;
  priceUsd: string | number;
  platformFeeUsd: string | number;
  boosterAmountUsd: string | number;
  exchangeRate: string | number;
  status: string;
  booster: Booster | null;
  createdAt: string;
  completedAt: string | null;
};

type DashboardResponse = Partial<Stats> & {
  orders?: RecentOrder[];
};

type StatusConfig = {
  className: string;
  label: string;
};

type StatCardProps = {
  icon: string;
  label: string;
  value: string | number;
  description: string;
  tone?: "danger" | "primary" | "success";
};

type SectionHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

const PLATFORM_FEE_PERCENT = 7;

const EMPTY_STATS: Stats = {
  totalRevenue: 0,
  platformFees: 0,
  boosterEarnings: 0,
  activeBoosters: 0,
  activeOrders: 0,
  completedOrders: 0,
};

const NAVIGATION_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/boosters", icon: "👥", label: "Boosters" },
  { href: "/orders", icon: "📦", label: "Orders" },
  { href: "/payments", icon: "💰", label: "Payments" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

const STATUS_CONFIG: Record<string, StatusConfig> = {
  CANCELLED: {
    className: "order-status--cancelled",
    label: "Cancelled",
  },
  COMPLETED: {
    className: "order-status--completed",
    label: "Completed",
  },
  IN_PROGRESS: {
    className: "order-status--in-progress",
    label: "In Progress",
  },
};

const PENDING_STATUS: StatusConfig = {
  className: "order-status--pending",
  label: "Pending",
};

function toNumber(value: unknown) {
  return Number(value || 0);
}

function formatUsd(value: number) {
  return "$" + Number(value || 0).toFixed(2);
}

function formatEgp(value: number) {
  return Number(value || 0).toFixed(2) + " EGP";
}

function getStats(data: DashboardResponse): Stats {
  return {
    totalRevenue: toNumber(data.totalRevenue),
    platformFees: toNumber(data.platformFees),
    boosterEarnings: toNumber(data.boosterEarnings),
    activeBoosters: toNumber(data.activeBoosters),
    activeOrders: toNumber(data.activeOrders),
    completedOrders: toNumber(data.completedOrders),
  };
}

function getOrderValues(order: RecentOrder) {
  const price = Number(order.priceUsd || 0);
  const platformFee = Number(
    order.platformFeeUsd || price * (PLATFORM_FEE_PERCENT / 100)
  );
  const boosterAmount = Number(
    order.boosterAmountUsd || price - platformFee
  );
  const exchangeRate = Number(order.exchangeRate || 0);
  const egp = boosterAmount * exchangeRate;

  return {
    boosterAmount,
    egp,
    platformFee,
    price,
    exchangeRate,
  };
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || PENDING_STATUS;
}

function StatCard({
  icon,
  label,
  value,
  description,
  tone,
}: StatCardProps) {
  const valueClassName =
    tone
      ? `dashboard-stat-value dashboard-stat-value--${tone}`
      : "dashboard-stat-value";

  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>

      <span>{label}</span>

      <strong className={valueClassName}>{value}</strong>

      <small>{description}</small>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>

      {action}
    </div>
  );
}

function RecentOrderRow({
  order,
}: {
  order: RecentOrder;
}) {
  const {
    boosterAmount,
    egp,
    platformFee,
    price,
    exchangeRate,
  } = getOrderValues(order);

  const status = getStatusConfig(order.status);

  return (
    <tr>
      <td>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "grid",
              flex: "0 0 auto",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border:
                "1px solid rgba(117, 104, 255, 0.16)",
              background:
                "rgba(117, 104, 255, 0.10)",
              color: "#a9a1ff",
              placeItems: "center",
            }}
          >
            📦
          </span>

          <div style={{ minWidth: 0 }}>
            <strong
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {order.title}
            </strong>

            <div className="muted">{order.game}</div>

            <div
              className="muted"
              style={{ marginTop: "3px" }}
            >
              {new Date(order.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </td>

      <td>
        {order.customer || "—"}
      </td>

      <td>
        {order.booster ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: "grid",
                flex: "0 0 auto",
                width: "34px",
                height: "34px",
                overflow: "hidden",
                borderRadius: "10px",
                border:
                  "1px solid rgba(117, 104, 255, 0.18)",
                background:
                  "rgba(117, 104, 255, 0.12)",
                color: "#c4bfff",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "12px",
              }}
            >
              {order.booster.profileImageUrl ? (
                <img
                  src={order.booster.profileImageUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                order.booster.name
                  .charAt(0)
                  .toUpperCase()
              )}
            </span>

            <div style={{ minWidth: 0 }}>
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {order.booster.name}
              </strong>

              <div
                className="muted"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {order.booster.email}
              </div>
            </div>
          </div>
        ) : (
          <span className="muted">
            Unassigned
          </span>
        )}
      </td>

      <td>
        <strong>
          {formatUsd(price)}
        </strong>
        <div className="muted">Gross</div>
      </td>

      <td>
        <strong
          style={{ color: "#fca5a5" }}
        >
          -{formatUsd(platformFee)}
        </strong>
        <div className="muted">
          {PLATFORM_FEE_PERCENT}%
        </div>
      </td>

      <td>
        <strong
          style={{ color: "#6ee7b7" }}
        >
          {formatUsd(boosterAmount)}
        </strong>
        <div className="muted">Net</div>
      </td>

      <td>
        <strong>{formatEgp(egp)}</strong>
        <div className="muted">
          1 USD = {exchangeRate.toFixed(2)} EGP
        </div>
      </td>

      <td>
        <span
          className={
            "order-status " +
            status.className
          }
        >
          <span className="order-status-dot" />
          {status.label}
        </span>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { isArabic } = useLanguage();
  const router = useRouter();

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [exchangeRate, setExchangeRate] =
    useState<number | null>(null);

  const [recentOrders, setRecentOrders] =
    useState<RecentOrder[]>([]);

  const [stats, setStats] =
    useState<Stats>(EMPTY_STATS);

  async function loadDashboard() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/dashboard",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        throw new Error(
          "Failed to load dashboard"
        );
      }

      const data =
        (await response.json()) as DashboardResponse;

      setRecentOrders(
        Array.isArray(data.orders)
          ? data.orders
          : []
      );

      setStats(getStats(data));
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadExchangeRate() {
    try {
      const response = await fetch(
        "/api/exchange-rate",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as {
          error?: string;
          rate?: number | string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load exchange rate"
        );
      }

      const rate = Number(data.rate);

      if (
        Number.isFinite(rate) &&
        rate > 0
      ) {
        setExchangeRate(rate);
      }
    } catch (error) {
      console.error(
        "Exchange rate error:",
        error
      );
    }
  }

  useEffect(() => {
    void loadDashboard();
    void loadExchangeRate();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );

      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const totalRevenueEgp =
    exchangeRate !== null
      ? stats.totalRevenue *
        exchangeRate
      : 0;

  const overviewStats: StatCardProps[] =
    [
      {
        icon: "$",
        label: "Total Order Value",
        value: loading
          ? "..."
          : formatUsd(
              stats.totalRevenue
            ),
        description:
          "Before 7% platform fee",
      },
      {
        icon: "%",
        label: "Platform Earnings",
        value: loading
          ? "..."
          : formatUsd(
              stats.platformFees
            ),
        description:
          "Order-specific fee",
        tone: "primary",
      },
      {
        icon: "↗",
        label: "Booster Earnings",
        value: loading
          ? "..."
          : formatUsd(
              stats.boosterEarnings
            ),
        description:
          "After platform fee",
        tone: "success",
      },
      {
        icon: "👥",
        label: "Active Boosters",
        value: loading
          ? "..."
          : stats.activeBoosters,
        description:
          "Currently active",
      },
      {
        icon: "📦",
        label: "Active Orders",
        value: loading
          ? "..."
          : stats.activeOrders,
        description:
          "Pending + in progress",
      },
      {
        icon: "✓",
        label: "Completed Orders",
        value: loading
          ? "..."
          : stats.completedOrders,
        description:
          "Successfully completed",
        tone: "success",
      },
    ];

  const breakdownStats: StatCardProps[] =
    [
      {
        icon: "01",
        label: "Gross",
        value:
          formatUsd(
            stats.totalRevenue
          ),
        description:
          "Original order value",
      },
      {
        icon: "02",
        label: "Platform Fee",
        value:
          "-" +
          formatUsd(
            stats.platformFees
          ),
        description:
          PLATFORM_FEE_PERCENT + "%",
        tone: "danger",
      },
      {
        icon: "03",
        label: "Booster Net",
        value:
          formatUsd(
            stats.boosterEarnings
          ),
        description:
          "Before fines",
        tone: "success",
      },
      {
        icon: "04",
        label: "Revenue EGP",
        value:
          loading ||
          exchangeRate === null
            ? "..."
            : formatEgp(
                totalRevenueEgp
              ),
        description:
          "Current rate",
      },
    ];

  return (
    <div className="shell dashboard-shell">
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
          {NAVIGATION_ITEMS.map(
            (item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.href ===
                  "/dashboard"
                    ? "active"
                    : undefined
                }
              >
                {item.icon}{" "}
                {isArabic
                  ? {
                      Dashboard:
                        "لوحة التحكم",
                      Boosters:
                        "البوسترز",
                      Orders:
                        "الطلبات",
                      Payments:
                        "المدفوعات",
                      Settings:
                        "الإعدادات",
                    }[item.label]
                  : item.label}
              </Link>
            )
          )}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          🚪{" "}
          {loggingOut
            ? "Logging out..."
            : "Logout"}
        </button>
      </aside>

      <main className="content">
        <header>
          <div>
            <h1>
              {isArabic
                ? "لوحة التحكم"
                : "Dashboard"}
            </h1>

            <p>
              تابع أداء ونشاط عملك.
            </p>
          </div>
        </header>

        <div className="stats">
          {overviewStats.map(
            (stat) => (
              <StatCard
                key={stat.label}
                {...stat}
              />
            )
          )}
        </div>

        <section
          className="panel"
          style={{ marginTop: "20px" }}
        >
          <SectionHeader
            title="Current Exchange Rate"
            description="Live USD → EGP conversion used across the dashboard."
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              marginTop: "18px",
              padding: "16px",
              border:
                "1px solid rgba(117, 104, 255, 0.12)",
              borderRadius: "14px",
              background:
                "rgba(117, 104, 255, 0.045)",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  color: "#7f8ba3",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                1 USD
              </span>

              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  fontSize: "24px",
                }}
              >
                →
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: "3px",
                  color: "#7f8ba3",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                EGP
              </span>
            </div>

            <div
              style={{
                textAlign: "right",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: "28px",
                  color: "#fff",
                }}
              >
                {exchangeRate !== null
                  ? formatEgp(
                      exchangeRate
                    )
                  : "..."}
              </strong>

              <small
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: "#6ee7b7",
                }}
              >
                ● Live rate
              </small>
            </div>
          </div>
        </section>

        <section
          className="panel"
          style={{ marginTop: "20px" }}
        >
          <SectionHeader
            title="Payment Breakdown"
            description="How your order revenue is distributed."
          />

          <div
            className="stats"
            style={{ marginTop: "18px" }}
          >
            {breakdownStats.map(
              (stat) => (
                <StatCard
                  key={stat.label}
                  {...stat}
                />
              )
            )}
          </div>
        </section>

        <section
          className="panel"
          style={{ marginTop: "20px" }}
        >
          <SectionHeader
            title="Recent Orders"
            description="Latest activity from your business."
            action={
              <Link
                href="/orders"
                className="view-all"
              >
                View all orders →
              </Link>
            }
          />

          {loading ? (
            <div className="empty">
              Loading orders...
            </div>
          ) : recentOrders.length ===
            0 ? (
            <div className="empty">
              <div className="empty-icon">
                📦
              </div>

              <h3>
                {isArabic
                  ? "لا توجد طلبات بعد"
                  : "No orders yet"}
              </h3>

              <p>
                Create your first
                order to get started.
              </p>

              <Link
                href="/orders"
                className="empty-action"
              >
                Create Order →
              </Link>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                overflowX: "auto",
                marginTop: "16px",
                WebkitOverflowScrolling:
                  "touch",
              }}
            >
              <table
                style={{
                  minWidth: "1050px",
                }}
              >
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Booster</th>
                    <th>Original</th>
                    <th>7% Fee</th>
                    <th>Booster</th>
                    <th>EGP</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {recentOrders.map(
                    (order) => (
                      <RecentOrderRow
                        key={order.id}
                        order={order}
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div
          style={{
            marginTop: "20px",
            paddingBottom:
              "12px",
            color: "#56627a",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing:
              "0.14em",
            textAlign: "center",
          }}
        >
          TRYΝDA BUSINESS
        </div>
      </main>
    </div>
  );
}
