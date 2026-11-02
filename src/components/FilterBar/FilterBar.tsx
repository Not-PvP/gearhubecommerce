import React, { useEffect, useRef, useState } from "react";
import "./FilterBar.css";
import { useCard } from "../../state/CardContext";
import { filterProducts, formatPeso, PRICE_SLIDER_MAX } from "../../utils/catalog";

const sortOptions = [
  { value: "default", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, ref]);
}

const FilterBar: React.FC = () => {
  const { state, dispatch } = useCard();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const closeFilter = React.useCallback(() => setIsFilterOpen(false), []);
  const closeSort = React.useCallback(() => setIsSortOpen(false), []);
  useDismiss(isFilterOpen, closeFilter, filterRef);
  useDismiss(isSortOpen, closeSort, sortRef);

  const { sortBy, maxPrice, category, searchQuery } = state.filters;
  const isPriceFiltered = maxPrice !== Infinity;
  const query = searchQuery.trim();

  const handleSortSelect = (value: string) => {
    dispatch({
      type: "SET_SORT",
      payload: value as "default" | "price-asc" | "price-desc",
    });
    setIsSortOpen(false);
  };

  const currentSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label ?? "Featured";

  const sliderValue = isPriceFiltered ? maxPrice : PRICE_SLIDER_MAX;
  const progress = (sliderValue / PRICE_SLIDER_MAX) * 100;

  const resultCount = filterProducts(state.products, state.filters).length;
  const isLoaded = state.productsStatus === "ready";

  const title = query ? `Results for “${query}”` : category || "All gear";

  const clearAll = () => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
    dispatch({ type: "SET_CATEGORY", payload: "" });
    dispatch({ type: "SET_MAX_PRICE", payload: Infinity });
  };

  const hasActiveFilters = Boolean(query || category || isPriceFiltered);

  return (
    <div className="filter-bar">
      <div className="filter-bar__heading">
        <h2 className="filter-bar__title">{title}</h2>
        {isLoaded && (
          <p className="filter-bar__count" aria-live="polite">
            {resultCount} {resultCount === 1 ? "product" : "products"}
            {query && category ? ` in ${category}` : ""}
            {isPriceFiltered ? ` under ${formatPeso(maxPrice)}` : ""}
          </p>
        )}
      </div>

      <div className="filter-bar__controls">
        {hasActiveFilters && (
          <button className="filter-bar__clear" onClick={clearAll}>
            Clear filters
          </button>
        )}

        <div className="filter-wrap" ref={filterRef}>
          <button
            className={`filter-button ${isPriceFiltered ? "filter-button--active" : ""}`}
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-expanded={isFilterOpen}
            aria-haspopup="dialog"
          >
            <img src="/images/filter.svg" alt="" aria-hidden="true" />
            Price
            {isPriceFiltered && <span className="filter-button__badge">1</span>}
          </button>

          {isFilterOpen && (
            <div className="filter-panel" role="dialog" aria-label="Price filter">
              <div className="filter-panel-group">
                <div className="filter-panel-head">
                  <label className="filter-panel-label" htmlFor="max-price">
                    Max price
                  </label>
                  <span className="filter-panel-value">
                    {isPriceFiltered ? formatPeso(maxPrice) : "Any"}
                  </span>
                </div>
                <input
                  id="max-price"
                  type="range"
                  min={0}
                  max={PRICE_SLIDER_MAX}
                  step={1000}
                  value={sliderValue}
                  aria-valuetext={isPriceFiltered ? formatPeso(maxPrice) : "Any price"}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    dispatch({
                      type: "SET_MAX_PRICE",
                      payload: value >= PRICE_SLIDER_MAX ? Infinity : value,
                    });
                  }}
                  style={{ "--progress": `${progress}%` } as React.CSSProperties}
                />
                <div className="filter-panel-scale" aria-hidden="true">
                  <span>₱0</span>
                  <span>Any</span>
                </div>
              </div>

              <div className="filter-panel-actions">
                <button
                  className="filter-panel-clear"
                  onClick={() => dispatch({ type: "SET_MAX_PRICE", payload: Infinity })}
                  disabled={!isPriceFiltered}
                >
                  Reset
                </button>
                <button className="filter-panel-apply" onClick={() => setIsFilterOpen(false)}>
                  Show {resultCount} {resultCount === 1 ? "product" : "products"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sort-wrap" ref={sortRef}>
          <button
            className="sort-button"
            onClick={() => setIsSortOpen((prev) => !prev)}
            aria-expanded={isSortOpen}
            aria-haspopup="listbox"
          >
            <span className="sort-button__prefix">Sort:</span> {currentSortLabel}
            <img
              src="/images/arrow-down.svg"
              alt=""
              aria-hidden="true"
              className={`sort-icon ${isSortOpen ? "open" : ""}`}
            />
          </button>

          {isSortOpen && (
            <div className="sort-menu" role="listbox" aria-label="Sort products">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === sortBy}
                  className={
                    opt.value === sortBy ? "sort-menu-item sort-menu-item-active" : "sort-menu-item"
                  }
                  onClick={() => handleSortSelect(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
