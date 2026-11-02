import { useEffect, useRef, useState } from "react";
import { useCard } from "../../state/CardContext";
import { Product } from "../../types/types";
import { formatPeso } from "../../utils/catalog";
import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
  onOpen: () => void;
}

const LOW_STOCK = 5;

function ProductCard({ product, onOpen }: ProductCardProps) {
  const { state, dispatch } = useCard();
  const { name, price, image, stock, category } = product;

  const inCart = state.cart.find((item) => item.id === product.id)?.quantity ?? 0;
  const soldOut = stock === 0;
  const allInCart = !soldOut && inCart >= stock;

  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleAddToCart = () => {
    dispatch({ type: "ADD_TO_CART", payload: product });
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1400);
  };

  const buttonLabel = soldOut
    ? "Sold out"
    : justAdded
      ? "Added"
      : allInCart
        ? "All in your cart"
        : "Add to cart";

  return (
    <article className={`product-card ${soldOut ? "product-card--sold-out" : ""}`}>
      <div
        className="product-card__image-wrap product-card__open"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <img src={image} alt="" className="product-card__image" loading="lazy" />
        {soldOut && <span className="product-card__flag">Sold out</span>}
        {inCart > 0 && (
          <span className="product-card__flag product-card__flag--cart">{inCart} in cart</span>
        )}
      </div>

      <div className="product-card__body">
        <p className="product-card__category">{category}</p>
        <h3 className="product-card__name" title={name}>
          <button type="button" className="product-card__name-btn" onClick={onOpen}>
            {name}
          </button>
        </h3>
        <div className="product-card__meta">
          <p className="product-card__price">{formatPeso(price)}</p>
          {!soldOut && (
            <p
              className={`product-card__stock ${
                stock <= LOW_STOCK ? "product-card__stock--low" : "product-card__stock--in"
              }`}
            >
              {stock <= LOW_STOCK ? `Only ${stock} left` : "In stock"}
            </p>
          )}
        </div>
      </div>

      <button
        className={`product-card__button ${justAdded ? "product-card__button--added" : ""}`}
        disabled={soldOut || allInCart}
        onClick={handleAddToCart}
        aria-label={soldOut || allInCart ? undefined : `Add ${name} to cart`}
      >
        <span aria-live="polite">{buttonLabel}</span>
      </button>
    </article>
  );
}

export default ProductCard;
