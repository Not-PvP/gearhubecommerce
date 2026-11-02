import { Filters, Product } from "../types/types";

export const CATEGORIES: string[] = [
  "Mouse",
  "Keyboard",
  "Laptop",
  "Headphones",
  "Cameras",
  "Driving",
  "Monitor",
  "Components",
];

export const PRICE_SLIDER_MAX = 250000;

export const formatPeso = (amount: number) => `₱${amount.toLocaleString()}`;

export function filterProducts(products: Product[], filters: Filters): Product[] {
  const { searchQuery, category, maxPrice, sortBy } = filters;
  const query = searchQuery.trim().toLowerCase();

  const filtered = products
    .filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query),
    )
    .filter((product) => (category ? product.category === category : true))
    .filter((product) => product.price <= maxPrice);

  return [...filtered].sort((a, b) => {
    if (a.stock === 0 && b.stock > 0) return 1;
    if (a.stock > 0 && b.stock === 0) return -1;

    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    return 0;
  });
}
