import { useEffect, useState } from "react";
import { useCard } from "../../state/CardContext";
import { Product } from "../../types/types";
import { fetchProduct } from "../../utils/api";
import { formatPeso } from "../../utils/catalog";
import "./ProductDetails.css";

const LOW_STOCK = 5;

interface ProductDetailsProps {
  productId: string;
  onClose: () => void;
}

function ProductDetails({ productId, onClose }: ProductDetailsProps) {
  const { state, dispatch } = useCard();
  const listed = state.products.find((p) => p.id === productId);
  const [product, setProduct] = useState<Product | undefined>(listed);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetchProduct(productId)
      .then((fresh) => {
        if (!active) return;
        setProduct(fresh);
        dispatch({
          type: "SET_PRODUCTS",
          payload: state.products.map((p) => (p.id === fresh.id ? fresh : p)),
        });
      })
      .catch((error: Error) => active && setLoadError(error.message));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!product) return null;

  const { name, category, description, price, image, stock } = product;
  const inCart = state.cart.find((item) => item.id === product.id)?.quantity ?? 0;
  const soldOut = stock === 0;
  const allInCart = !soldOut && inCart >= stock;

  const stockLabel = soldOut ? "Out of stock" : stock <= LOW_STOCK ? `Only ${stock} left` : "In stock";
  const stockClass = soldOut ? "out" : stock <= LOW_STOCK ? "low" : "in";

  return (
    <>
      <div className="product-details-overlay" onClick={onClose} />
      <div className="product-details" role="dialog" aria-modal="true" aria-labelledby="product-details-title">
        <button className="product-details__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="product-details__image-wrap">
          <img src={image} alt={name} className="product-details__image" />
        </div>

        <div className="product-details__body">
          <p className="product-details__category">{category}</p>
          <h2 className="product-details__name" id="product-details-title">
            {name}
          </h2>
          <p className="product-details__price">{formatPeso(price)}</p>

          <p className={`product-details__stock product-details__stock--${stockClass}`}>{stockLabel}</p>

          <p className="product-details__description">
            {description || "No description yet."}
          </p>

          {loadError && <p className="product-details__note">Couldn't refresh stock: {loadError}</p>}

          <div className="product-details__actions">
            <button
              className="product-details__add"
              disabled={soldOut || allInCart}
              onClick={() => dispatch({ type: "ADD_TO_CART", payload: product })}
            >
              {soldOut ? "Sold out" : allInCart ? "All in your cart" : "Add to cart"}
            </button>
            {inCart > 0 && <span className="product-details__in-cart">{inCart} in your cart</span>}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetails;
