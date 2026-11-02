import { useEffect, useRef, useState } from "react";
import { useCard } from "../../state/CardContext";
import { OrderStatus, PaymentMethod, ShippingAddress } from "../../types/types";
import { createInvoice, getInvoiceStatus } from "../../utils/xenditClient";
import { PROVINCES, REGION_VI } from "../../utils/locations";
import { createOrder } from "../../utils/api";
import "./Checkout.css";

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: "",
  street: "",
  city: "",
  province: "",
  postalCode: "",
  phone: "",
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

type Stage = "form" | "placing" | "awaiting-payment" | "confirmed" | "cancelled" | "error";

function Checkout() {
  const { state, dispatch } = useCard();
  const { cart, isCheckoutOpen, token } = state;

  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [stage, setStage] = useState<Stage>("form");
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [placedOrderStatus, setPlacedOrderStatus] =
    useState<OrderStatus>("PENDING");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedItems = cart.filter((item) => item.selected);
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shipping = subtotal > 0 ? 150 : 0;
  const total = subtotal + shipping;

  const clearPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollIntervalRef.current = null;
    pollTimeoutRef.current = null;
  };

  useEffect(() => {
    if (!isCheckoutOpen) {
      clearPolling();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    }
  }, [isCheckoutOpen]);

  useEffect(() => () => clearPolling(), []);

  const onClose = () => {
    clearPolling();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    dispatch({ type: "TOGGLE_CHECKOUT", payload: false });
    setTimeout(() => {
      setAddress(EMPTY_ADDRESS);
      setPaymentMethod("cod");
      setStage("form");
      setPlacedOrderId(null);
      setPlacedOrderStatus("PENDING");
      setErrorMessage("");
    }, 250);
  };

  const onChangeField =
    (field: keyof ShippingAddress) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      if(field === "phone") {
        value = value.replace(/\D/g, "").slice(0, 11);
      }
      if (field === "postalCode") {
        value = value.replace(/\D/g, "").slice(0, 4);
      }
      setAddress((prev) => ({ ...prev, [field]: value }));
    };

  const isAddressComplete = Object.values(address).every(
    (value) => value.trim().length > 0,
  );

  const finalizeOrder = async (reference: string, invoiceId?: string) => {
    setStage("placing");
    try {
      if (!token) {
        throw new Error("Your login expired. Please log in again.");
      }
      // the backend re-checks stock and prices before saving
      const order = await createOrder(token, {
        items: selectedItems.map((item) => ({ productId: item.id, quantity: item.quantity })),
        shippingAddress: address,
        paymentMethod,
        invoiceId,
      });
      dispatch({ type: "PLACE_ORDER", payload: order });
      setPlacedOrderId(order.id);
      setPlacedOrderStatus(order.status);
      setStage("confirmed");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Couldn't save your order.";
      setErrorMessage(
        invoiceId
          ? `Your payment went through, but we couldn't save the order: ${reason} Keep this payment reference: ${reference}.`
          : reason,
      );
      setStage("error");
    }
  };

  const startPollingForPayment = (sessionId: string, orderId: string) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let settled = false;

    pollIntervalRef.current = setInterval(async () => {
      if (settled) return;

      if (popupRef.current?.closed) {
        settled = true;
        clearPolling();
        setStage("cancelled");
        return;
      }

      if (Date.now() > deadline) {
        settled = true;
        clearPolling();
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
        setErrorMessage("This checkout session timed out. Please try again.");
        setStage("error");
        return;
      }

      try {
        const { status } = await getInvoiceStatus(sessionId);
        if (settled) return;
        if (status === "PAID" || status === "SETTLED") {
          settled = true;
          clearPolling();
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          finalizeOrder(orderId, sessionId);
        } else if (status === "EXPIRED") {
          settled = true;
          clearPolling();
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
          setErrorMessage("This invoice expired before payment was completed.");
          setStage("error");
        }
      } catch (err) {
        console.error("Failed to poll invoice status:", err);
      }
    }, POLL_INTERVAL_MS);
  };

  const onPlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddressComplete || selectedItems.length === 0) return;

    const orderId = `ORD-${Date.now()}`;

    if (paymentMethod === "cod") {
      finalizeOrder(orderId);
      return;
    }

    const popup = window.open(
      "about:blank",
      "xendit_checkout",
      "width=480,height=720",
    );

    if (!popup) {
      setErrorMessage(
        "We couldn't open the secure payment window. Please allow pop-ups for this site and try again.",
      );
      setStage("error");
      return;
    }

    popupRef.current = popup;
    popup.document.write(
      "<p style='font-family:sans-serif;padding:24px;color:#555'>Loading secure checkout&hellip;</p>",
    );

    setStage("awaiting-payment");
    setErrorMessage("");

    try {
      const { id, invoiceUrl } = await createInvoice(
        [
          ...selectedItems.map((item) => ({
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
          })),
          ...(shipping > 0
            ? [{ name: "Shipping", unitPrice: shipping, quantity: 1 }]
            : []),
        ],
        orderId,
      );

      if (popup.closed) {
        setErrorMessage("The payment window was closed. Please try again.");
        setStage("error");
        return;
      }

      popup.location.href = invoiceUrl;
      startPollingForPayment(id, orderId);
    } catch (err) {
      if (!popup.closed) popup.close();
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Couldn't start checkout. Please try again.",
      );
      setStage("error");
    }
  };

  const onCancelAwaitingPayment = () => {
    clearPolling();
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    setStage("form");
  };

  const onRetry = () => {
    setErrorMessage("");
    setStage("form");
  };

  if (!isCheckoutOpen) return null;

  return (
    <>
      <div className="checkout-overlay" onClick={stage === "form" ? onClose : undefined} />
      <div
        className={`checkout-modal ${stage === "form" ? "checkout-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <div className="checkout-modal__header">
          <h2 className="checkout-modal__title" id="checkout-title">
            {stage === "confirmed"
              ? "Order confirmed"
              : stage === "awaiting-payment"
                ? "Complete payment"
                : stage === "placing"
                  ? "Placing order"
                : stage === "cancelled"
                  ? "Payment cancelled"
                  : stage === "error"
                    ? "Something went wrong"
                    : "Checkout"}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close checkout">
            ✕
          </button>
        </div>

        {stage === "confirmed" && placedOrderId && (
          <div className="checkout-confirmation">
            <p className="checkout-confirmation__icon">✓</p>
            <p className="checkout-confirmation__text">
              Your order has been placed.
            </p>
            <p className="checkout-confirmation__id">Order #{placedOrderId}</p>
            <p className="checkout-confirmation__status">
              {placedOrderStatus === "PAID"
                ? "Payment received. You can track it under Your orders."
                : "Pay the courier on delivery. You can track it under Your orders."}
            </p>
            <button className="checkout-modal__submit" onClick={onClose}>
              Keep shopping
            </button>
          </div>
        )}

        {stage === "placing" && (
          <div className="checkout-confirmation" role="status">
            <p className="checkout-confirmation__spinner" aria-hidden="true" />
            <p className="checkout-confirmation__text">Placing your order&hellip;</p>
            <p className="checkout-confirmation__status">Checking stock and saving your order.</p>
          </div>
        )}

        {stage === "awaiting-payment" && (
          <div className="checkout-confirmation">
            <p className="checkout-confirmation__spinner" aria-hidden="true" />
            <p className="checkout-confirmation__text">
              Choose how to pay and finish your payment in the Xendit window
              that opened.
            </p>
            <p className="checkout-confirmation__status">
              Waiting for confirmation&hellip;
            </p>
            <button className="checkout-modal__secondary" onClick={onCancelAwaitingPayment}>
              Cancel
            </button>
          </div>
        )}

        {stage === "cancelled" && (
          <div className="checkout-confirmation">
            <p className="checkout-confirmation__icon checkout-confirmation__icon--muted">
              ✕
            </p>
            <p className="checkout-confirmation__text">
              Payment window was closed before completing.
            </p>
            <p className="checkout-confirmation__status">
              Your cart is unchanged — nothing was charged.
            </p>
            <button className="checkout-modal__submit" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="checkout-confirmation">
            <p className="checkout-confirmation__icon checkout-confirmation__icon--error">
              !
            </p>
            <p className="checkout-confirmation__text">{errorMessage}</p>
            <button className="checkout-modal__submit" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {stage === "form" && (
          <form className="checkout-form" onSubmit={onPlaceOrder}>
            <div className="checkout-form__details">
              <fieldset className="checkout-section">
                <legend className="checkout-section__title">Shipping address</legend>
                <div className="checkout-fields">
                  <label className="checkout-field checkout-field--half">
                    <span className="checkout-field__label">Full name</span>
                    <input
                      className="checkout-field__input"
                      placeholder="Juan dela Cruz"
                      autoComplete="name"
                      value={address.fullName}
                      onChange={onChangeField("fullName")}
                      required
                    />
                  </label>
                  <label className="checkout-field checkout-field--half">
                    <span className="checkout-field__label">Mobile number</span>
                    <span className="checkout-phone">
                      <span className="checkout-phone__prefix" aria-hidden="true">09</span>
                      <input
                        className="checkout-field__input checkout-phone__input"
                        placeholder="123 456 789"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-label="Mobile number, after 09"
                        value={address.phone.slice(2)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                          setAddress((prev) => ({ ...prev, phone: `09${digits}` }));
                        }}
                        required
                      />
                    </span>
                  </label>
                  <label className="checkout-field checkout-field--full">
                    <span className="checkout-field__label">Street address</span>
                    <input
                      className="checkout-field__input"
                      placeholder="House no., street, barangay"
                      autoComplete="street-address"
                      value={address.street}
                      onChange={onChangeField("street")}
                      required
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field__label">Province</span>
                    <select
                      className="checkout-field__input checkout-field__select"
                      autoComplete="address-level1"
                      value={address.province}
                      onChange={(e) =>
                        setAddress((prev) => ({ ...prev, province: e.target.value, city: "" }))
                      }
                      required
                    >
                      <option value="" disabled>
                        Select province
                      </option>
                      {PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field__label">City / municipality</span>
                    <select
                      className="checkout-field__input checkout-field__select"
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                      disabled={!address.province}
                      required
                    >
                      <option value="" disabled>
                        Select city
                      </option>
                      {(REGION_VI[address.province] ?? []).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkout-field checkout-field--postal">
                    <span className="checkout-field__label">Postal code</span>
                    <input
                      className="checkout-field__input"
                      placeholder="5000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      pattern="[0-9]{4}"
                      title="Enter a valid 4-digit postal code."
                      value={address.postalCode}
                      onChange={onChangeField("postalCode")}
                      required
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="checkout-section">
                <legend className="checkout-section__title">Payment</legend>
                <div className="checkout-pay" role="radiogroup" aria-label="Payment method">
                  {(
                    [
                      { id: "cod", label: "Cash on delivery", hint: "Pay the courier when it arrives" },
                      { id: "xendit", label: "Online payment", hint: "Card, GCash, Maya, banks, 7-Eleven & more" },
                    ] as { id: PaymentMethod; label: string; hint: string }[]
                  ).map((option) => (
                    <label
                      className={`checkout-pay__option ${paymentMethod === option.id ? "is-selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        className="checkout-pay__radio"
                        checked={paymentMethod === option.id}
                        onChange={() => setPaymentMethod(option.id)}
                      />
                      <span className="checkout-pay__label">{option.label}</span>
                      <span className="checkout-pay__hint">{option.hint}</span>
                    </label>
                  ))}
                </div>

                <p className="checkout-section__note">
                  {paymentMethod === "cod"
                    ? "Our courier collects payment when your order is delivered."
                    : "A secure Xendit window opens where you choose card, e-wallet, online banking or over-the-counter. Test mode: no real money is charged."}
                </p>
              </fieldset>
            </div>

            <aside className="checkout-summary" aria-label="Order summary">
              <h3 className="checkout-summary__title">
                Your order
                <span className="checkout-summary__count">
                  {selectedItems.reduce((n, item) => n + item.quantity, 0)} item
                  {selectedItems.reduce((n, item) => n + item.quantity, 0) === 1 ? "" : "s"}
                </span>
              </h3>

              <ul className="checkout-summary__items">
                {selectedItems.map((item) => (
                  <li className="checkout-summary__item" key={item.id}>
                    <img className="checkout-summary__thumb" src={item.image} alt="" />
                    <span className="checkout-summary__name">
                      <span className="checkout-summary__name-text">{item.name}</span>
                      <span className="checkout-summary__qty">Qty {item.quantity}</span>
                    </span>
                    <span className="checkout-summary__price">
                      ₱{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="checkout-summary__totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>₱{subtotal.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>₱{shipping.toLocaleString()}</dd>
                </div>
                <div className="checkout-summary__total">
                  <dt>Total</dt>
                  <dd>₱{total.toLocaleString()}</dd>
                </div>
              </dl>

              <button
                type="submit"
                className="checkout-modal__submit"
                disabled={!isAddressComplete || selectedItems.length === 0}
              >
                {paymentMethod === "cod" ? "Place order" : "Continue to payment"}
              </button>
              {!isAddressComplete && (
                <p className="checkout-summary__hint">
                  {paymentMethod === "cod"
                    ? "Fill in your delivery details to place your order."
                    : "Fill in your delivery details to continue to payment."}
                </p>
              )}
            </aside>

            <div className="checkout-mobile-bar">
              <span className="checkout-mobile-bar__total">
                <span className="checkout-mobile-bar__label">Total</span>
                ₱{total.toLocaleString()}
              </span>
              <button
                type="submit"
                className="checkout-modal__submit"
                disabled={!isAddressComplete || selectedItems.length === 0}
              >
                {paymentMethod === "cod" ? "Place order" : "Continue to payment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export default Checkout;