import ProductCard from "../ProductCard/ProductCard";
import ProductDetails from "../ProductDetails/ProductDetails";
import "./ProductGrid.css";
import { useCard } from "../../state/CardContext";
import { filterProducts } from "../../utils/catalog";

function ProductGrid() {
  const { state, dispatch, reloadProducts } = useCard();
  const { products, filters, productsStatus, productsError } = state;
  const sortedProducts = filterProducts(products, filters);

  const clearFilters = () => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
    dispatch({ type: "SET_CATEGORY", payload: "" });
    dispatch({ type: "SET_MAX_PRICE", payload: Infinity });
  };

  if (productsStatus === "loading") {
    return (
      <div className="product-grid" aria-busy="true" aria-label="Loading products">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="product-grid__skeleton" key={index} />
        ))}
      </div>
    );
  }

  if (productsStatus === "error") {
    return (
      <div className="product-grid__status" role="alert">
        <p className="product-grid__status-title">Couldn't load products</p>
        <p className="product-grid__status-text">{productsError}</p>
        <button className="product-grid__retry" onClick={reloadProducts}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {sortedProducts.length === 0 ? (
        <div className="product-grid__empty">
          <p className="product-grid__status-title">No gear matches these filters</p>
          <p className="product-grid__status-text">
            Try a different search, another category or a higher max price.
          </p>
          <button className="product-grid__retry" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        sortedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onOpen={() => dispatch({ type: "OPEN_PRODUCT_DETAILS", payload: product.id })}
          />
        ))
      )}
      {state.openProductId && (
        <ProductDetails
          productId={state.openProductId}
          onClose={() => dispatch({ type: "CLOSE_PRODUCT_DETAILS" })}
        />
      )}
    </div>
  );
}

export default ProductGrid;
