import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCard } from "../../state/CardContext";
import { Order, OrderStatus } from "../../types/types";
import { getPaymentLabel } from "../../utils/paymentMethods";
import {
  LowStockProduct,
  adminLogin,
  fetchAdminOrders,
  fetchLowStock,
  updateOrderStatus,
} from "../../utils/adminApi";
import "./AdminDashboard.css";

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const LOW_STOCK_THRESHOLD = 5;

const allowedNextStatuses = (current: OrderStatus, paymentMethod: Order["paymentMethod"]): OrderStatus[] => {
  if (current === "PENDING") {
    return paymentMethod === "cod" ? ["SHIPPED", "CANCELLED"] : ["PAID", "CANCELLED"];
  }
  if (current === "PAID") return ["SHIPPED"];
  if (current === "SHIPPED") return ["DELIVERED"];
  return [];
};

const availableStatuses = (current: OrderStatus, paymentMethod: Order["paymentMethod"]) => {
  return [current, ...allowedNextStatuses(current, paymentMethod)];
};

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const AdminDashboard: React.FC = () => { // create local state
  const { state, reloadProducts, logout, startSession } = useCard();

  const [token, setToken] = useState<string | null>(null);
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
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusListRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // The menu is position: fixed (so the table's overflow can't clip it), which means
  // it must be re-anchored to its button whenever the page or table scrolls.
  const updateMenuPosition = useCallback(() => {
    const button = statusButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = statusListRef.current?.offsetHeight ?? 0;
    const menuWidth = statusListRef.current?.offsetWidth ?? 170;
    const gap = 6;
    const fitsBelow = rect.bottom + gap + menuHeight <= window.innerHeight;
    const top = fitsBelow || rect.top - gap - menuHeight < 0
      ? rect.bottom + gap
      : rect.top - gap - menuHeight;
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
    setMenuPos({ top, left: Math.max(8, left) });
  }, []);

  useLayoutEffect(() => {
    if (openStatusId === null) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [openStatusId, updateMenuPosition]);

  useEffect(() => {
    if (openStatusId === null) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setOpenStatusId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenStatusId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openStatusId]);

  const load = useCallback(async (t: string) => { 
    setLoading(true); // marks the dashboard as loading; and
    setError(""); // clears any prev error
    try {
      const [orderList, lowStockList] = await Promise.all([ // 
        fetchAdminOrders(t), // runs them at the same time, and
        fetchLowStock(t), // waits for both to finish
      ]);
      setOrders(orderList); // kung mag succeed both (sa babaw), isave mga returned orders; and
      setLowStock(lowStockList); // low stock products in the component's state (local react state)
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
    try {
      const session = await adminLogin(email.trim(), password);
      // share the admin session with the rest of the app so the storefront stays locked
      await startSession(session); // saves the token
      setToken(session.token);
      setPassword("");
      await load(session.token);
    } catch (err) {
      setLoginError(errorText(err, "Couldn't sign in. Is the API running?"));
    } finally {
      setLoggingIn(false);
    }
  };
  // kung mag appear admin dashboard, run ya ni after irender
  useEffect(() => { // detect na ang admin already present in shared state with token
    if (!token && state.user?.isAdmin && state.token) { // kung true ya tanan set ya to ang token
      setToken(state.token);
      load(state.token); // start dayun request ka orders kag lowstock products
    }
  }, [token, state.user, state.token, load]);

  const onLogout = () => {
    if (token === state.token) logout();
    setToken(null);
    setOrders([]);
    setLowStock([]);
    setEmail("");
  };

  const onStatusChange = async (order: Order, status: OrderStatus) => {
    if (!token || status === order.status) return;
    if (
      status === "CANCELLED" &&
      !window.confirm(`Cancel order #${order.id}? Its items will go back into stock.`)
    ) {
      return;
    }

    setSavingId(order.id);
    setError("");
    try {
      const updated = await updateOrderStatus(token, order.id, status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      if (status === "CANCELLED") {
        setLowStock(await fetchLowStock(token));
        reloadProducts();
      }
    } catch (err) {
      setError(errorText(err, "Couldn't update the order."));
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => { // ginatally kung pira ka orders have each status
    const byStatus: Record<string, number> = {}; // hold ya number sa kada status
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    });
    return byStatus; // return ya tong na count sa useMemo
  }, [orders]); // tels react when pagid ma calculate

  const visibleOrders = // hold the list used after applying the selected status filter
    filter === "ALL" ? orders : orders.filter((o) => o.status === filter); // chooses order list depende sa naselect

  if (!token) {
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

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Admin dashboard</h1>
        <div className="admin-header__actions">
          <button className="admin-btn" onClick={() => load(token)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
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
                        <div
                          className="admin-status-wrap"
                          ref={openStatusId === order.id ? statusMenuRef : null}
                        >
                          <button
                            type="button"
                            className={`admin-status-button admin-status--${order.status.toLowerCase()}`}
                            onClick={(e) => {
                              statusButtonRef.current = e.currentTarget;
                              setOpenStatusId((current) =>
                                current === order.id ? null : order.id
                              );
                            }}
                            disabled={order.status === "CANCELLED" || order.status === "DELIVERED" || savingId === order.id}
                            aria-expanded={openStatusId === order.id}
                            aria-haspopup="listbox"
                            aria-label={`Status for order ${order.id}: ${order.status}`}
                          >
                            {savingId === order.id ? "Updating…" : order.status}
                            <img
                              src="/images/arrow-down.svg"
                              alt=""
                              aria-hidden="true"
                              className={`admin-status-icon ${openStatusId === order.id ? "open" : ""}`}
                            />
                          </button>

                          {openStatusId === order.id && (
                            <div
                              ref={statusListRef}
                              className="admin-status-menu"
                              style={
                                menuPos
                                  ? { top: menuPos.top, left: menuPos.left }
                                  : { visibility: "hidden" }
                              }
                              role="listbox"
                              aria-label={`Change status for order ${order.id}`}
                            >
                              {availableStatuses(order.status, order.paymentMethod).map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  role="option"
                                  aria-selected={status === order.status}
                                  className={
                                    status === order.status
                                      ? "admin-status-menu-item admin-status-menu-item-active"
                                      : "admin-status-menu-item"
                                  }
                                  onClick={() => {
                                    setOpenStatusId(null);
                                    onStatusChange(order, status);
                                  }}
                                >
                                  <span className={`admin-status-dot admin-status-dot--${status.toLowerCase()}`} />
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
                    className={`admin-stock__badge ${product.stock_quantity === 0 ? "admin-stock__badge--out" : ""
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
