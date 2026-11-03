import { State } from "../types/types";
import { Action } from "./actions";

export const initialState: State = {
  products: [],
  productsStatus: "loading",
  productsError: "",
  cart: [],
  orders: [],
  filters: {
    searchQuery: "",
    category: "",
    maxPrice: Infinity,
    sortBy: "default",
  },
  isCartOpen: false,
  openProductId: null,
  isCheckoutOpen: false,
  isOrderHistoryOpen: false,
  user: null,
  token: null,
  authPrompt: { open: false, reason: "", next: null },
  lastAdded: null,
};

export function cardReducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TO_CART": {
      // gets the product and the amount from action
      const { product, quantity } = action.payload;

      // if no stock or amount leave the state unchanged
      if (product.stock <= 0 || quantity <= 0) {
        return state;
      }

      // is the product already in the cart?
      const existing = state.cart.find((item) => item.id === product.id);

      // if may jn sa cart pila kabilog? - 0 siya if waay
      const currentQuantity = existing?.quantity ?? 0;
      // pira kabilog lng pwede iadd nga di dapat mag sobra sa available stock (sagap min (ex. 2, stock 5 - curr 2)) = 2
      const addedQuantity = Math.min(quantity, product.stock - currentQuantity);

      // if di pwede ka add leave the state unchanged
      if (addedQuantity <= 0) {
        return state;
      }

      // ano to siya nga product gin addan? para iupdate ana quantity
      const lastAdded = {
        product,
        count: (state.lastAdded?.count ?? 0) + addedQuantity,
      };

      // kung ara sa cart copy lng to ah tas update lng lastadded, tas himo lng bag o listahan kung nag increase quantity
      if (existing) {
        return {
          ...state,
          lastAdded,
          cart: state.cart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + addedQuantity }
              : item,
          ),
        };
      }

      // if wara sa cart copy lng state tas add lng product sa cart list with its quantity
      return {
        ...state,
        lastAdded,
        cart: [...state.cart, { ...product, quantity: addedQuantity, selected: true }],
      };
    }

    case "REMOVE_FROM_CART": {
      return {
        ...state,
        // kung magmatch id ti remove ih
        cart: state.cart.filter((item) => item.id !== action.payload),
      };
    }

    // minus or add quanity sa cart mismo
    case "UPDATE_QUANTITY": {
      const { id, quantity } = action.payload;

      // if 0 ti remove na gid item ibig sabihin
      if (quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((item) => item.id !== id),
        };
      }

      return {
        ...state,
        cart: state.cart.map((item) =>
          // prevent item from exceeding
          item.id === id ? { ...item, quantity: Math.min(quantity, item.stock) } : item,
        ),
      };
    }

    case "CLEAR_CART": {
      return {
        ...state,
        cart: [],
      };
    }

    case "SET_SEARCH_QUERY": {
      return {
        ...state,
        filters: { ...state.filters, searchQuery: action.payload },
      };
    }

    case "SET_CATEGORY": {
      return {
        ...state,
        filters: { ...state.filters, category: action.payload },
      };
    }

    case "SET_MAX_PRICE": {
      return {
        ...state,
        filters: { ...state.filters, maxPrice: action.payload },
      };
    }

    case "SET_SORT": {
      return {
        ...state,
        filters: { ...state.filters, sortBy: action.payload },
      };
    }

    case "TOGGLE_CART": {
      const isCartOpen =
        action.payload !== undefined ? action.payload : !state.isCartOpen;
      return {
        ...state,
        isCartOpen,
        openProductId: isCartOpen ? null : state.openProductId,
      };
    }

    case "OPEN_PRODUCT_DETAILS": {
      return { ...state, openProductId: action.payload };
    }

    case "CLOSE_PRODUCT_DETAILS": {
      return { ...state, openProductId: null };
    }

    case "TOGGLE_CHECKOUT": {
      return {
        ...state,
        isCheckoutOpen:
          action.payload !== undefined ? action.payload : !state.isCheckoutOpen,
      };
    }

    case "TOGGLE_ORDER_HISTORY": {
      return {
        ...state,
        isOrderHistoryOpen:
          action.payload !== undefined ? action.payload : !state.isOrderHistoryOpen,
      };
    }

    case "SET_PRODUCTS": {
      return { ...state, products: action.payload, productsStatus: "ready", productsError: "" };
    }

    case "SET_PRODUCTS_STATUS": {
      return {
        ...state,
        productsStatus: action.payload.status,
        productsError: action.payload.error ?? "",
      };
    }

    case "SET_ORDERS": {
      return { ...state, orders: action.payload };
    }

    case "PLACE_ORDER": {
      const order = action.payload;
      // anuto nga product kag pila
      const orderedQty = new Map(order.items.map((item) => [item.id, item.quantity]));

      return {
        ...state,
        products: state.products.map((product) =>
          orderedQty.has(product.id)
            ? { ...product, stock: Math.max(0, product.stock - orderedQty.get(product.id)!) }
            : product,
        ),
        // adds new order tas avoid lng duplication
        orders: [order, ...state.orders.filter((existing) => existing.id !== order.id)],
        // remove and gin order sa cart kay magto na to sa order
        cart: state.cart.filter((item) => !orderedQty.has(item.id)),
        isCheckoutOpen: true,
        isCartOpen: false,
      };
    }

    case "TOGGLE_ITEM_SELECTED": {
      return {
        ...state,
        cart: state.cart.map((item) =>
          item.id === action.payload
            ? { ...item, selected: !item.selected }
            : item,
        ),
      };
    }

    // saves signed-in user kag anda token
    case "SET_AUTH": {
      return { ...state, user: action.payload.user, token: action.payload.token };
    }

    // clears all
    case "LOGOUT": {
      return {
        ...state,
        user: null,
        token: null,
        cart: [],
        orders: [],
        isCheckoutOpen: false,
        isOrderHistoryOpen: false,
      };
    }

    case "SET_CART": {
      return { ...state, cart: action.payload };
    }

    // open log in prompt
    case "OPEN_AUTH": {
      return {
        ...state,
        authPrompt: {
          open: true,
          reason: action.payload?.reason ?? "",
          next: action.payload?.next ?? null,
        },
      };
    }

    case "CLOSE_AUTH": {
      return { ...state, authPrompt: { open: false, reason: "", next: null } };
    }

    default:
      return state;
  }
}