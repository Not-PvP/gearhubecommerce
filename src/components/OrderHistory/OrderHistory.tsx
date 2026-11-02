import React, { useEffect, useState } from "react";
import { useCard } from "../../state/CardContext";
import { getPaymentLabel } from "../../utils/paymentMethods";
import { cancelOrder } from "../../utils/api";
import { Order } from "../../types/types";
import { formatPeso } from "../../utils/catalog";
import "./OrderHistory.css";

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pending",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const OrderHistory: React.FC = () => {
  const { state, dispatch, logout, reloadProducts } = useCard();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});

  const onCancelOrder = async (order: Order) => {
    if (!state.token) return;
    setCancellingId(order.id);
    setCancelErrors((prev) => ({ ...prev, [order.id]: "" }));
    try {
      const updated = await cancelOrder(state.token, order.id);
      dispatch({
        type: "SET_ORDERS",
        payload: state.orders.map((o) => (o.id === updated.id ? updated : o)),
      });
      setConfirmingId(null);
      reloadProducts();
    } catch (err) {
      setCancelErrors((prev) => ({
        ...prev,
        [order.id]: err instanceof Error ? err.message : "Couldn't cancel this order.",
      }));
    } finally {
      setCancellingId(null);
    }
  };

  const isOpen = state.isOrderHistoryOpen;
  const close = () => dispatch({ type: "TOGGLE_ORDER_HISTORY", payload: false });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "TOGGLE_ORDER_HISTORY", payload: false });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, dispatch]);

  return (
    <>
      <div
        className={`order-history-overlay ${
          state.isOrderHistoryOpen ? "order-history-overlay--visible" : ""
        }`}
        onClick={close}
      />

      <aside
        className={`order-history ${
          state.isOrderHistoryOpen ? "order-history--open" : ""
        }`}
        aria-label="Your account and orders"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="order-history__header">
          <h2>Your orders</h2>
          <button className="close-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {state.user && (
          <div className="order-history__account">
            <div className="order-history__account-who">
              <span className="order-history__avatar" aria-hidden="true">
                {state.user.email.charAt(0).toUpperCase()}
              </span>
              <div>
                <span className="order-history__account-label">Logged in as</span>
                <p className="order-history__account-email" title={state.user.email}>
                  {state.user.email}
                </p>
              </div>
            </div>
            <div className="order-history__account-actions">
              {state.user.isAdmin && (
                <a
                  className="order-history__admin"
                  href="#/admin"
                  onClick={() => dispatch({ type: "TOGGLE_ORDER_HISTORY", payload: false })}
                >
                  Admin dashboard
                </a>
              )}
              <button className="order-history__logout" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        )}

        {state.orders.length === 0 ? (
          <div className="order-history__empty">
            <p className="order-history__empty-title">No orders yet</p>
            <p className="order-history__empty-text">Orders you place show up here so you can track them.</p>
            <button className="order-history__logout" onClick={close}>
              Browse gear
            </button>
          </div>
        ) : (
          <div className="order-history__list">
            {state.orders.map((order) => (
              <div className="order-history__card" key={order.id}>
                <div className="order-history__top">
                  <div>
                    <h3>Order #{order.id}</h3>
                    <p>{formatDate(order.createdAt)}</p>
                  </div>

                  <span
                    className={`order-history__status order-history__status--${order.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>

                <div className="order-history__items">
                  {order.items.map((item) => (
                    <div className="order-history__item" key={item.id}>
                      <img src={item.image} alt="" />
                      <div>
                        <p>{item.name}</p>
                        <span>
                          {formatPeso(item.unitPrice)} × {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-history__bottom">
                  <span>{getPaymentLabel(order.paymentMethod)}</span>
                  <strong>{formatPeso(order.total)}</strong>
                </div>

                {order.status === "PENDING" && (
                  <div className="order-history__cancel">
                    {confirmingId === order.id ? (
                      <>
                        <span className="order-history__cancel-question">Cancel this order?</span>
                        <button
                          className="order-history__cancel-btn order-history__cancel-btn--keep"
                          onClick={() => setConfirmingId(null)}
                          disabled={cancellingId === order.id}
                        >
                          Keep it
                        </button>
                        <button
                          className="order-history__cancel-btn order-history__cancel-btn--confirm"
                          onClick={() => onCancelOrder(order)}
                          disabled={cancellingId === order.id}
                        >
                          {cancellingId === order.id ? "Cancelling…" : "Yes, cancel"}
                        </button>
                      </>
                    ) : (
                      <button
                        className="order-history__cancel-btn"
                        onClick={() => setConfirmingId(order.id)}
                      >
                        Cancel order
                      </button>
                    )}
                  </div>
                )}
                {cancelErrors[order.id] && (
                  <p className="order-history__cancel-error" role="alert">
                    {cancelErrors[order.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

export default OrderHistory;
