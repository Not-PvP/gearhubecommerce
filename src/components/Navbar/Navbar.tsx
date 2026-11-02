import React from "react";
import "./Navbar.css";
import { useCard } from "../../state/CardContext";

const Navbar: React.FC = () => {
  const { state, dispatch } = useCard();
  const itemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="navbar">
      <a className="navbar-logo" href="/" aria-label="GearHub home">
        <img
          src="/logo/gearhub-logo.svg"
          alt="GearHub Logo"
          className="navbar-logo-icon"
        />
        <span className="navbar-logo-text-group">
          <span className="navbar-logo-title">
            <span className="title-gear">Gear</span>
            <span className="title-hub">Hub</span>
          </span>
          <span className="navbar-logo-tagline">Gear Up. Level Up.</span>
        </span>
      </a>

      <div className="navbar-search-wrap">
        <div className="navbar-search-bar">
          <img src="/images/search.svg" alt="" aria-hidden="true" className="navbar-search-icon" />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search for gears"
            value={state.filters.searchQuery}
            onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", payload: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
          />
        </div>
      </div>

      <div className="navbar-actions">
        <button
          className={`navbar-icon-btn ${state.isOrderHistoryOpen ? "navbar-icon-btn--active" : ""}`}
          onClick={() =>
            state.user
              ? dispatch({ type: "TOGGLE_ORDER_HISTORY" })
              : dispatch({ type: "OPEN_AUTH", payload: { next: "orders" } })
          }
          aria-label={state.user ? `Account and orders (${state.user.email})` : "Log in"}
          title={state.user ? state.user.email : "Log in"}>
          <img src="/images/user.svg" alt="" aria-hidden="true" className="navbar-user-icon" />
        </button>

        <button
          className={`navbar-icon-btn ${state.isCartOpen ? "navbar-icon-btn--active" : ""}`}
          onClick={() => dispatch({ type: "TOGGLE_CART" })}
          aria-label={itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart"}
        >
          <img src="/images/cart.svg" alt="" aria-hidden="true" className="navbar-cart-icon" />
          {itemCount > 0 && (
            <span className="navbar-cart-badge">{itemCount}</span>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;