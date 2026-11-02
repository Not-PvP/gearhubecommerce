import { Product, Order, LoadStatus, CartItem, User, AfterLogin } from "../types/types";

export type Action =
  | { type: "ADD_TO_CART"; payload: { product: Product; quantity: number } }
  | { type: "REMOVE_FROM_CART"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_CATEGORY"; payload: string }
  | { type: "SET_MAX_PRICE"; payload: number }
  | { type: "SET_SORT"; payload: "default" | "price-asc" | "price-desc" }
  | { type: "TOGGLE_CART"; payload?: boolean }
  | { type: "TOGGLE_ITEM_SELECTED"; payload: string }
  | { type: "TOGGLE_CHECKOUT"; payload?: boolean }
  | { type: "TOGGLE_ORDER_HISTORY"; payload?: boolean }
  | { type: "SET_PRODUCTS"; payload: Product[] }
  | { type: "SET_PRODUCTS_STATUS"; payload: { status: LoadStatus; error?: string } }
  | { type: "SET_ORDERS"; payload: Order[] }
  | { type: "PLACE_ORDER"; payload: Order }
  | { type: "SET_AUTH"; payload: { user: User; token: string } }
  | { type: "LOGOUT" }
  | { type: "SET_CART"; payload: CartItem[] }
  | { type: "OPEN_AUTH"; payload?: { reason?: string; next?: AfterLogin } }
  | { type: "CLOSE_AUTH" };
