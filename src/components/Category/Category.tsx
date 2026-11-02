import React from "react";
import "./Category.css";
import { useCard } from "../../state/CardContext";
import { CATEGORIES } from "../../utils/catalog";

const CategoryPills: React.FC = () => {
  const { state, dispatch } = useCard();
  const activeCategory = state.filters.category;

  const select = (category: string) => {
    dispatch({
      type: "SET_CATEGORY",
      payload: activeCategory === category ? "" : category,
    });
  };

  const countFor = (category: string) =>
    state.products.filter((product) => (category ? product.category === category : true)).length;

  const showCounts = state.productsStatus === "ready";

  return (
    <nav className="category-pills" aria-label="Categories">
      {["", ...CATEGORIES].map((category) => {
        const isActive = activeCategory === category;
        return (
          <button
            key={category || "all"}
            className={isActive ? "category-pill category-pill-active" : "category-pill"}
            onClick={() => select(category)}
            aria-pressed={isActive}
          >
            {category || "All"}
            {showCounts && <span className="category-pill__count">{countFor(category)}</span>}
          </button>
        );
      })}
    </nav>
  );
};

export default CategoryPills;
