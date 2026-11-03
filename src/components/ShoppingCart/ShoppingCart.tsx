import { useEffect } from "react";
import { useCard } from "../../state/CardContext";
import { formatPeso } from "../../utils/catalog";
import "./ShoppingCart.css";

function ShoppingCart() {
  const { state, dispatch } = useCard();
  const { cart, isCartOpen } = state;

  const subtotal = cart
    .filter((item) => item.selected)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 150 : 0;
  const total = subtotal + shipping;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCount = cart
    .filter((item) => item.selected)
    .reduce((sum, item) => sum + item.quantity, 0);

  const onClose = () => dispatch({ type: "TOGGLE_CART", payload: false });
  const onIncrease = (id: string, quantity: number, stock: number) =>
    dispatch({
      type: "UPDATE_QUANTITY",
      payload: { id, quantity: Math.min(quantity + 1, stock) },
    });
  const onDecrease = (id: string, quantity: number) =>
    dispatch({
      type: "UPDATE_QUANTITY",
      payload: { id, quantity: quantity - 1 },
    });
  const onRemove = (id: string) =>
    dispatch({ type: "REMOVE_FROM_CART", payload: id });
  const onClearCart = () => dispatch({ type: "CLEAR_CART" });
  const onToggleSelected = (id: string) =>
    dispatch({ type: "TOGGLE_ITEM_SELECTED", payload: id });
  const onCheckout = () => {
    if (!state.user) {
      dispatch({
        type: "OPEN_AUTH",
        payload: { reason: "Log in to check out. Your cart will be saved to your account.", next: "checkout" },
      });
      return;
    }
    dispatch({ type: "TOGGLE_CART", payload: false });
    dispatch({ type: "TOGGLE_CHECKOUT", payload: true });
  };

  useEffect(() => {
    if (!isCartOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "TOGGLE_CART", payload: false });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCartOpen, dispatch]);

  const hasSelectedItems = cart.some((item) => item.selected);

  return (
    <>
      <div
        className={`cart-overlay ${isCartOpen ? "cart-overlay--visible" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`cart-drawer ${isCartOpen ? "cart-drawer--open" : ""}`}
        aria-label="Cart"
        aria-hidden={!isCartOpen}
        inert={!isCartOpen}
      >
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">
            Your loadout
            {itemCount > 0 && <span className="cart-drawer__title-count">{itemCount}</span>}
          </h2>
          <div className="cart-drawer__header-actions">
            {cart.length > 0 && (
              <button className="cart-drawer__clear" onClick={onClearCart}>
                Clear cart
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close cart">
              ✕
            </button>
          </div>
        </div>

        <div className="cart-drawer__items">
          {cart.length === 0 ? (
            <div className="cart-drawer__empty">
              <img
                src="/images/cart-empty.svg"
                alt=""
                aria-hidden="true"
                className="cart-drawer__empty-icon"
              />
              <h3 className="cart-drawer__empty-title">Your cart is empty</h3>
              <p className="cart-drawer__empty-text">
                Gear you add from the shop shows up here.
              </p>
              <button className="cart-drawer__continue" onClick={onClose}>
                Browse gear
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <input
                  type="checkbox"
                  className="cart-item__checkbox"
                  checked={item.selected}
                  onChange={() => onToggleSelected(item.id)}
                  aria-label={`Include ${item.name} in checkout`}
                />

                <button
                  type="button"
                  className="cart-item__image-button"
                  onClick={() => dispatch({ type: "OPEN_PRODUCT_DETAILS", payload: item.id })}
                  aria-label={`View details for ${item.name}`}
                >
                  <img src={item.image} alt="" className="cart-item__image" />
                </button>
                <div className="cart-item__details">
                  <button
                    type="button"
                    className="cart-item__name"
                    onClick={() => dispatch({ type: "OPEN_PRODUCT_DETAILS", payload: item.id })}
                  >
                    {item.name}
                  </button>
                  <p className="cart-item__price">{formatPeso(item.price * item.quantity)}</p>
                  <div className="cart-item__qty">
                    <button
                      onClick={() => onDecrease(item.id, item.quantity)}
                      aria-label={item.quantity === 1 ? `Remove ${item.name}` : `Decrease ${item.name} quantity`}
                    >
                      −
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      onClick={() => onIncrease(item.id, item.quantity, item.stock)}
                      disabled={item.quantity >= item.stock}
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      +
                    </button>
                    {item.quantity > 1 && (
                      <span className="cart-item__each">{formatPeso(item.price)} each</span>
                    )}
                  </div>
                  {item.quantity >= item.stock && (
                    <p className="cart-stock-warning">That's all {item.stock} we have in stock</p>
                  )}
                </div>
                <button
                  className="cart-item__remove"
                  onClick={() => onRemove(item.id)}
                  title="Remove item from cart"
                  aria-label={`Remove ${item.name}`}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="cart-drawer__row">
              <span>Subtotal</span>
              <span>{formatPeso(subtotal)}</span>
            </div>
            <div className="cart-drawer__row">
              <span>Shipping</span>
              <span>{formatPeso(shipping)}</span>
            </div>
            <div className="cart-drawer__row cart-drawer__row--total">
              <span>Total</span>
              <span>{formatPeso(total)}</span>
            </div>
            <button
              className="cart-drawer__checkout"
              onClick={onCheckout}
              disabled={!hasSelectedItems}
            >
              {hasSelectedItems
                ? `Check out ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`
                : "Select items to check out"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default ShoppingCart;