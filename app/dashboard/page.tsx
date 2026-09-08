"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  dashboard?: boolean;
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
  { href: "/dashboard", icon: "◈", label: "Dashboard" },
  { href: "/boosters", icon: "♟", label: "Boosters" },
  { href: "/orders", icon: "▣", label: "Orders" },
  { href: "/payments", icon: "◇", label: "Payments" },
  { href: "/settings", icon: "⚙", label: "Settings" },
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
  return "$" + value.toFixed(2);
}

function formatEgp(value: number) {
  return value.toFixed(2) + " EGP";
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
  const price = Number(order.priceUsd);
  const platformFee = Number(
    order.platformFeeUsd || price * (PLATFORM_FEE_PERCENT / 100)
  );

  const boosterAmount = Number(
    order.boosterAmountUsd || price - platformFee
  );

  const egp = boosterAmount * Number(order.exchangeRate || 0);

  return {
    boosterAmount,
    egp,
    platformFee,
    price,
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
  dashboard = false,
}: StatCardProps) {
  const valueClassName = tone
    ? "dashboard-stat-value dashboard-stat-value--" + tone
    : "dashboard-stat-value";

  const cardClassName = dashboard
    ? "stat dashboard-stat dashboard-stat--premium"
    : "stat dashboard-breakdown-card";

  return (
    <div className={cardClassName}>
      <div className="dashboard-stat-top">
        <div className="stat-icon dashboard-stat-icon">{icon}</div>

        <span className="dashboard-stat-label">{label}</span>
      </div>

      <strong className={valueClassName}>{value}</strong>

      <div className="dashboard-stat-description">
        <span className="dashboard-stat-dot" />
        {description}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="section-header dashboard-section-header">
      <div>
        <div className="dashboard-section-title-row">
          <h2>{title}</h2>
        </div>

        <p className="muted">{description}</p>
      </div>

      {action}
    </div>
  );
}

function RecentOrderRow({ order }: { order: RecentOrder }) {
  const { boosterAmount, egp, platformFee, price } =
    getOrderValues(order);

  const status = getStatusConfig(order.status);

  return (
    <tr>
      <td data-label="Order">
        <div className="dashboard-order-main">
          <div className="dashboard-order-icon">▣</div>

          <div className="dashboard-order-title">
            <strong>{order.title}</strong>

            <div className="order-meta order-meta--game">
              {order.game}
            </div>

            <div className="order-meta order-meta--date">
              {new Date(order.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </td>

      <td data-label="Customer">
        <div className="dashboard-table-primary">
          {order.customer || "—"}
        </div>
      </td>

      <td data-label="Booster">
        {order.booster ? (
          <div className="dashboard-booster-cell">
            <div className="dashboard-booster-avatar">
              {order.booster.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{order.booster.name}</strong>

              <div className="order-meta order-meta--email">
                {order.booster.email}
              </div>
            </div>
          </div>
        ) : (
          <span className="dashboard-unassigned">
            Unassigned
          </span>
        )}
      </td>

      <td data-label="Original">
        <strong className="dashboard-money">
          {formatUsd(price)}
        </strong>

        <div className="muted">Gross</div>
      </td>

      <td data-label="7% Fee">
        <strong className="dashboard-money order-amount--platform">
          -{formatUsd(platformFee)}
        </strong>

        <div className="muted">{PLATFORM_FEE_PERCENT}%</div>
      </td>

      <td data-label="Booster">
        <strong className="dashboard-money order-amount--booster">
          {formatUsd(boosterAmount)}
        </strong>

        <div className="muted">Net</div>
      </td>

      <td data-label="EGP">
        <strong className="dashboard-money dashboard-egp">
          {formatEgp(egp)}
        </strong>
      </td>

      <td data-label="Status">
        <span className={"order-status " + status.className}>
          <span className="order-status-dot" />
          {status.label}
        </span>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number | null>(
    null
  );
  const [recentOrders, setRecentOrders] = useState<
    RecentOrder[]
  >([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  async function loadDashboard() {
    try {
      setLoading(true);

      const response = await fetch("/api/dashboard", {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        throw new Error("Failed to load dashboard");
      }

      const data = (await response.json()) as DashboardResponse;

      setRecentOrders(
        Array.isArray(data.orders) ? data.orders : []
      );

      setStats(getStats(data));
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadExchangeRate() {
    try {
      const response = await fetch("/api/exchange-rate", {
        cache: "no-store",
      });

      const data = (await response.json()) as {
        error?: string;
        rate?: number | string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load exchange rate"
        );
      }

      const rate = Number(data.rate);

      if (Number.isFinite(rate) && rate > 0) {
        setExchangeRate(rate);
      }
    } catch (error) {
      console.error("Exchange rate error:", error);
    }
  }

  useEffect(() => {
    void loadDashboard();
    void loadExchangeRate();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.replace("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const totalRevenueEgp =
    exchangeRate !== null
      ? stats.totalRevenue * exchangeRate
      : 0;

  const overviewStats: StatCardProps[] = [
    {
      icon: "$",
      label: "Total Order Value",
      value: loading
        ? "..."
        : formatUsd(stats.totalRevenue),
      description: "Before 7% platform fee",
    },
    {
      icon: "%",
      label: "Platform Earnings",
      value: loading
        ? "..."
        : formatUsd(stats.platformFees),
      description: "Order-specific fee",
      tone: "primary",
    },
    {
      icon: "↗",
      label: "Booster Earnings",
      value: loading
        ? "..."
        : formatUsd(stats.boosterEarnings),
      description: "After platform fee",
      tone: "success",
    },
    {
      icon: "♟",
      label: "Active Boosters",
      value: loading ? "..." : stats.activeBoosters,
      description: "Currently active",
    },
    {
      icon: "▣",
      label: "Active Orders",
      value: loading ? "..." : stats.activeOrders,
      description: "Pending + in progress",
    },
    {
      icon: "✓",
      label: "Completed Orders",
      value: loading ? "..." : stats.completedOrders,
      description: "Successfully completed",
      tone: "success",
    },
  ];

  const breakdownStats: StatCardProps[] = [
    {
      icon: "01",
      label: "Gross",
      value: formatUsd(stats.totalRevenue),
      description: "Original order value",
    },
    {
      icon: "02",
      label: "Platform Fee",
      value: "-" + formatUsd(stats.platformFees),
      description: PLATFORM_FEE_PERCENT + "%",
      tone: "danger",
    },
    {
      icon: "03",
      label: "Booster Net",
      value: formatUsd(stats.boosterEarnings),
      description: "Before fines",
      tone: "success",
    },
    {
      icon: "04",
      label: "Revenue EGP",
      value:
        loading || exchangeRate === null
          ? "..."
          : formatEgp(totalRevenueEgp),
      description: "Current rate",
    },
  ];

  return (
    <div className="shell dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link
          href="/dashboard"
          className="sidebar-brand dashboard-brand"
        >
          <div className="sidebar-brand-logo dashboard-brand-logo">
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

        <div className="dashboard-nav-label">
          MAIN MENU
        </div>

        <nav className="dashboard-nav">
          {NAVIGATION_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                item.href === "/dashboard"
                  ? "active"
                  : undefined
              }
            >
              <span className="dashboard-nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>

              {item.href === "/dashboard" && (
                <span className="dashboard-nav-active-dot" />
              )}
            </Link>
          ))}
        </nav>

        <div className="dashboard-sidebar-spacer" />

        <div className="dashboard-sidebar-status">
          <span className="dashboard-sidebar-status-dot" />

          <div>
            <strong>System online</strong>
            <span>All services operational</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="dashboard-logout"
        >
          <span>↪</span>
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </aside>

      <main className="content dashboard-content">
        <header className="dashboard-header">
          <div>
            <div className="dashboard-eyebrow">
              <span />
              BUSINESS OVERVIEW
            </div>

            <h1>Dashboard</h1>

            <p>
              Monitor your business performance and activity.
            </p>
          </div>

          <div className="dashboard-header-right">
            <div className="dashboard-live-indicator">
              <span />
              LIVE
            </div>

            <div className="admin-badge dashboard-admin-badge">
              <span className="admin-dot" />

              <div>
                <span className="dashboard-admin-role">
                  ADMIN
                </span>

                <strong>Administrator</strong>
              </div>
            </div>
          </div>
        </header>

        <section className="dashboard-overview">
          <div className="dashboard-overview-heading">
            <div>
              <span>OVERVIEW</span>
              <h2>Business performance</h2>
            </div>

            <div className="dashboard-overview-line" />
          </div>

          <div className="stats dashboard-stats-grid">
            {overviewStats.map((stat) => (
              <StatCard
                key={stat.label}
                dashboard
                {...stat}
              />
            ))}
          </div>
        </section>

        <section className="panel dashboard-section dashboard-rate dashboard-rate-premium">
          <div className="dashboard-rate-left">
            <div className="dashboard-rate-icon">
              $
            </div>

            <div>
              <div className="dashboard-rate-eyebrow">
                MARKET DATA
              </div>

              <h2 className="dashboard-rate__title">
                Current Exchange Rate
              </h2>

              <p className="muted">
                Live USD → EGP conversion used across the
                dashboard.
              </p>
            </div>
          </div>

          <div className="dashboard-rate-center">
            <span>1 USD</span>
            <strong>→</strong>
            <span>EGP</span>
          </div>

          <div className="dashboard-rate__value">
            <strong>
              {exchangeRate !== null
                ? formatEgp(exchangeRate)
                : "..."}
            </strong>

            <div className="dashboard-rate__live">
              <span />
              Live rate
            </div>
          </div>
        </section>

        <section className="panel dashboard-section dashboard-breakdown-panel">
          <SectionHeader
            title="Payment Breakdown"
            description="How your order revenue is distributed."
          />

          <div className="stats dashboard-breakdown">
            {breakdownStats.map((stat) => (
              <StatCard
                key={stat.label}
                {...stat}
              />
            ))}
          </div>
        </section>

        <section className="panel dashboard-panel dashboard-section dashboard-orders-panel">
          <SectionHeader
            title="Recent Orders"
            description="Latest activity from your business."
            action={
              <Link
                href="/orders"
                className="view-all dashboard-view-all"
              >
                <span>View all orders</span>
                <strong>→</strong>
              </Link>
            }
          />

          {loading ? (
            <div className="empty dashboard-empty">
              <div className="dashboard-loading-ring" />
              <h3>Loading orders</h3>
              <p>
                Fetching the latest business activity...
              </p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="empty dashboard-empty">
              <div className="empty-icon dashboard-empty-icon">
                ▣
              </div>

              <h3>No orders yet</h3>

              <p>
                Create your first order to get started.
              </p>

              <Link
                href="/orders"
                className="empty-action dashboard-create-order"
              >
                Create Order
                <span>→</span>
              </Link>
            </div>
          ) : (
            <div className="dashboard-table-wrap">
              <table className="dashboard-orders-table">
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
                  {recentOrders.map((order) => (
                    <RecentOrderRow
                      key={order.id}
                      order={order}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="dashboard-footer">
          <span>TRYΝDA BUSINESS</span>
          <span className="dashboard-footer-separator">
            /
          </span>
          <span>CONTROL CENTER</span>
        </div>
      </main>
    </div>
  );
}