import { useEffect, useState } from "react";
import { useCard } from "../../state/CardContext";
import { formatPeso } from "../../utils/catalog";
import "./CartToast.css";

const SHOW_FOR_MS = 2800;

function CartToast() {
  const { state, dispatch } = useCard();
  const { lastAdded } = state;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastAdded) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [lastAdded]);

  if (!lastAdded) return null;
  const { product } = lastAdded;
  const quantity = state.cart.find((item) => item.id === product.id)?.quantity ?? 1;

  const onViewCart = () => {
    setVisible(false);
    dispatch({ type: "TOGGLE_CART", payload: true });
  };

  return (
    <div className={`cart-toast ${visible ? "cart-toast--visible" : ""}`} role="status" aria-live="polite">
      {visible && (
        <>
          <img src={product.image} alt="" className="cart-toast__image" />
          <div className="cart-toast__text">
            <p className="cart-toast__title">
              <span className="cart-toast__check" aria-hidden="true">✓</span> Added to cart
            </p>
            <p className="cart-toast__name" title={product.name}>
              {product.name}
            </p>
            <p className="cart-toast__meta">
              {formatPeso(product.price)} · {quantity} in cart
            </p>
          </div>
          <button className="cart-toast__view" onClick={onViewCart}>
            View cart
          </button>
          <button className="cart-toast__close" onClick={() => setVisible(false)} aria-label="Dismiss">
            ✕
          </button>
        </>
      )}
    </div>
  );
}

export default CartToast;
