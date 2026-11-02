import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  ReactNode,
  Dispatch,
} from "react";
import { cardReducer, initialState } from "./CardReducer";
import { Action } from "./actions";
import { CartItem, State } from "../types/types";
import {
  Session,
  fetchCart,
  fetchMe,
  fetchMyOrders,
  fetchProducts,
  getSavedToken,
  isAuthError,
  login as apiLogin,
  register as apiRegister,
  saveCart,
  saveToken,
} from "../utils/api";

interface CardContextValue {
  state: State;
  dispatch: Dispatch<Action>;
  reloadProducts: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const CardContext = createContext<CardContextValue | undefined>(undefined);

const CART_SAVE_DELAY_MS = 400;

const cartKey = (cart: CartItem[]) =>
  cart
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join(",");

const mergeCarts = (saved: CartItem[], guest: CartItem[]): CartItem[] => {
  const merged = saved.map((item) => ({ ...item }));
  for (const guestItem of guest) {
    const existing = merged.find((item) => item.id === guestItem.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + guestItem.quantity, existing.stock);
    } else {
      merged.push({ ...guestItem });
    }
  }
  return merged;
};

const keepSelection = (fresh: CartItem[], current: CartItem[]): CartItem[] =>
  fresh.map((item) => ({
    ...item,
    selected: current.find((c) => c.id === item.id)?.selected ?? true,
  }));

export function CardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cardReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [cartReady, setCartReady] = useState(false);
  const lastSavedKey = useRef("");

  const reloadProducts = useCallback(() => {
    dispatch({ type: "SET_PRODUCTS_STATUS", payload: { status: "loading" } });
    fetchProducts()
      .then((products) => dispatch({ type: "SET_PRODUCTS", payload: products }))
      .catch((error: Error) =>
        dispatch({ type: "SET_PRODUCTS_STATUS", payload: { status: "error", error: error.message } }),
      );
  }, []);

  const startSession = useCallback(async ({ user, token }: Session) => {
    saveToken(token);
    setCartReady(false);
    dispatch({ type: "SET_AUTH", payload: { user, token } });

    try {
      const [savedCart, orders] = await Promise.all([fetchCart(token), fetchMyOrders(token)]);
      // items added before logging in get merged into the saved cart
      const merged = mergeCarts(savedCart, stateRef.current.cart);

      lastSavedKey.current = cartKey(savedCart);
      dispatch({ type: "SET_CART", payload: merged });
      dispatch({ type: "SET_ORDERS", payload: orders });
      setCartReady(true);
    } catch (error) {
      console.error("Failed to load your cart and orders:", error);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => startSession(await apiLogin(email, password)),
    [startSession],
  );

  const register = useCallback(
    async (email: string, password: string) => startSession(await apiRegister(email, password)),
    [startSession],
  );

  const logout = useCallback(() => {
    saveToken(null);
    setCartReady(false);
    lastSavedKey.current = "";
    dispatch({ type: "LOGOUT" });
  }, []);

  useEffect(() => {
    reloadProducts();

    const token = getSavedToken();
    if (!token) return;
    fetchMe(token)
      .then((user) => startSession({ user, token }))
      .catch((error) => {
        if (isAuthError(error)) saveToken(null);
        else console.error("Failed to restore login:", error);
      });
  }, [reloadProducts, startSession]);

  const { cart, token } = state;
  useEffect(() => {
    if (!token || !cartReady) return;
    const key = cartKey(cart);
    if (key === lastSavedKey.current) return;

    const timer = setTimeout(() => {
      saveCart(token, cart)
        .then((saved) => {
          const savedKey = cartKey(saved);
          lastSavedKey.current = savedKey;
          if (savedKey !== key && cartKey(stateRef.current.cart) === key) {
            dispatch({ type: "SET_CART", payload: keepSelection(saved, stateRef.current.cart) });
          }
        })
        .catch((error) => {
          if (isAuthError(error)) logout();
          else console.error("Failed to save cart:", error);
        });
    }, CART_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [cart, token, cartReady, logout]);

  return (
    <CardContext.Provider value={{ state, dispatch, reloadProducts, login, register, logout }}>
      {children}
    </CardContext.Provider>
  );
}

export function useCard() {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error("useCard must be used within a CardProvider");
  }
  return context;
}
