import React, { useCallback, useMemo, useState } from "react";
import { useCard } from "../../state/CardContext";
import { Order, OrderStatus } from "../../types/types";
import { getPaymentLabel } from "../../utils/paymentMethods";
import {
  AdminCredentials,
  LowStockProduct,
  fetchAdminOrders,
  fetchLowStock,
  updateOrderStatus,
  verifyAdmin,
} from "../../utils/adminApi";
import "./AdminDashboard.css";

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const LOW_STOCK_THRESHOLD = 5; // matches the default in the backend

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const AdminDashboard: React.FC = () => {
  const { reloadProducts } = useCard();

  const [creds, setCreds] = useState<AdminCredentials | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (c: AdminCredentials) => {
    setLoading(true);
    setError("");
    try {
      const [orderList, lowStockList] = await Promise.all([
        fetchAdminOrders(c),
        fetchLowStock(c),
      ]);
      setOrders(orderList);
      setLowStock(lowStockList);
    } catch (err) {
      setError(errorText(err, "Couldn't load the dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    const candidate = { email: email.trim(), password };
    try {
      await verifyAdmin(candidate);
      setCreds(candidate);
      setPassword("");
      await load(candidate);
    } catch (err) {
      setLoginError(errorText(err, "Couldn't sign in. Is the API running?"));
    } finally {
      setLoggingIn(false);
    }
  };

  const onLogout = () => {
    setCreds(null);
    setOrders([]);
    setLowStock([]);
    setEmail("");
  };

  const onStatusChange = async (order: Order, status: OrderStatus) => {
    if (!creds || status === order.status) return;
    if (
      status === "CANCELLED" &&
      !window.confirm(`Cancel order #${order.id}? Its items will go back into stock.`)
    ) {
      return;
    }

    setSavingId(order.id);
    setError("");
    try {
      const updated = await updateOrderStatus(creds, order.id, status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      if (status === "CANCELLED") {
        // stock changed, so refresh the low-stock list and the storefront products
        setLowStock(await fetchLowStock(creds));
        reloadProducts();
      }
    } catch (err) {
      setError(errorText(err, "Couldn't update the order."));
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    });
    return byStatus;
  }, [orders]);

  const visibleOrders =
    filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  // ---------- sign-in screen ----------
  if (!creds) {
    return (
      <main className="admin admin--login">
        <form className="admin-login" onSubmit={onLogin}>
          <h1>Admin sign in</h1>
          <p className="admin-login__note">Sign in with an account marked as admin.</p>

          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {loginError && <p className="admin-error" role="alert">{loginError}</p>}

          <button className="admin-btn admin-btn--primary" type="submit" disabled={loggingIn}>
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
          <a className="admin-link" href="#/">Back to store</a>
        </form>
      </main>
    );
  }

  // ---------- dashboard ----------
  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Admin dashboard</h1>
        <div className="admin-header__actions">
          <button className="admin-btn" onClick={() => load(creds)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <a className="admin-btn" href="#/">Back to store</a>
          <button className="admin-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <section className="admin-summary" aria-label="Summary">
        <div className="admin-stat">
          <strong>{orders.length}</strong>
          <span>Total orders</span>
        </div>
        <div className="admin-stat">
          <strong>{counts.PENDING ?? 0}</strong>
          <span>Pending</span>
        </div>
        <div className="admin-stat">
          <strong>{counts.SHIPPED ?? 0}</strong>
          <span>Shipped</span>
        </div>
        <div className="admin-stat admin-stat--alert">
          <strong>{lowStock.length}</strong>
          <span>Low-stock items</span>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel" aria-labelledby="admin-orders-title">
          <div className="admin-panel__head">
            <h2 id="admin-orders-title">Orders</h2>
            <label className="admin-filter">
              <span>Show</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as OrderStatus | "ALL")}
              >
                <option value="ALL">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          {visibleOrders.length === 0 ? (
            <p className="admin-empty">
              {orders.length === 0
                ? "No orders yet. Place one from the storefront and it will show up here."
                : "No orders match this status."}
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>#{order.id}</strong>
                        <small>{new Date(order.createdAt).toLocaleDateString()}</small>
                      </td>
                      <td>
                        {order.shippingAddress?.fullName ?? "—"}
                        <small>
                          {order.shippingAddress?.city}
                          {order.shippingAddress?.province
                            ? `, ${order.shippingAddress.province}`
                            : ""}
                        </small>
                      </td>
                      <td className="admin-table__items">
                        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                      </td>
                      <td>{getPaymentLabel(order.paymentMethod)}</td>
                      <td>₱{order.total.toLocaleString()}</td>
                      <td>
                        <select
                          className={`admin-status admin-status--${order.status.toLowerCase()}`}
                          value={order.status}
                          disabled={order.status === "CANCELLED" || savingId === order.id}
                          onChange={(e) => onStatusChange(order, e.target.value as OrderStatus)}
                          aria-label={`Status for order ${order.id}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="admin-panel" aria-labelledby="admin-stock-title">
          <div className="admin-panel__head">
            <h2 id="admin-stock-title">Low stock</h2>
            <span className="admin-panel__hint">{LOW_STOCK_THRESHOLD} or fewer left</span>
          </div>

          {lowStock.length === 0 ? (
            <p className="admin-empty">Every product has enough stock.</p>
          ) : (
            <ul className="admin-stock">
              {lowStock.map((product) => (
                <li key={product.id}>
                  <span className="admin-stock__name">
                    {product.name}
                    <small>{product.category ?? "Uncategorized"}</small>
                  </span>
                  <span
                    className={`admin-stock__badge ${
                      product.stock_quantity === 0 ? "admin-stock__badge--out" : ""
                    }`}
                  >
                    {product.stock_quantity === 0
                      ? "Out of stock"
                      : `Only ${product.stock_quantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
};

export default AdminDashboard;