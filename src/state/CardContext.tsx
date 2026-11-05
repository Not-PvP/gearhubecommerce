import {
  // share dta with comp togther with useContext
  createContext,
  // keeps function stable between renders
  useCallback,
  useContext,
  // runs when the components start
  useEffect,
  // conect data to reducer
  useReducer,
  // stores value
  useRef,
  //keeps extra context-related values (whether the cart has finished loading)
  useState,
  // types R + D
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
  state: State; // the app shared data
  dispatch: Dispatch<Action>; // a way to send action to the reducer
  // the rest are funtions for common app tasks
  reloadProducts: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  startSession: (session: Session) => Promise<void>;
}

const CardContext = createContext<CardContextValue | undefined>(undefined); // ga create kita shared channel

const CART_SAVE_DELAY_MS = 400; // the app waits before saving cart changes

const cartKey = (cart: CartItem[]) => // id and quatity to string (used to check whether the cart changed)
  cart
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join(",");

// diba may ginadd to cart pero wara ka log in or sign in, butang na to ya kung need na ilogin bag o i checkout
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

// para di mayawan ang user ka select or unselect ka item kung gaupdate anda cart (pero all checked siya kung ireferesh ka user)
const keepSelection = (fresh: CartItem[], current: CartItem[]): CartItem[] =>
  fresh.map((item) => ({
    ...item,
    selected: current.find((c) => c.id === item.id)?.selected ?? true,
  }));

// makes the context available to its child components (gasupply data)
export function CardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cardReducer, initialState); // himo shared state and dispatch function (data kag gasend kung ano changes sa data kag diri na ga work and reducers)
  const stateRef = useRef(state); // stores latest app state (always shows the latest cart); lets the app check kung may changes nga natabo
  stateRef.current = state;

  const [cartReady, setCartReady] = useState(false); // track whether signed in user carts has loaded
  const lastSavedKey = useRef(""); // remembers the last cart version (tell whther the card need saving)

  const reloadProducts = useCallback(() => {
    dispatch({ type: "SET_PRODUCTS_STATUS", payload: { status: "loading" } });
    // asks frontend API helper to get  products from the backed
    fetchProducts()
      // kung mag succeed, send nato sa reducer
      .then((products) => dispatch({ type: "SET_PRODUCTS", payload: products }))
      // magfail, reducer record the error
      .catch((error: Error) =>
        dispatch({ type: "SET_PRODUCTS_STATUS", payload: { status: "error", error: error.message } }),
      );
  }, []);

  // after login or register
  const startSession = useCallback(async ({ user, token }: Session) => {
    saveToken(token);
    setCartReady(false);
    dispatch({ type: "SET_AUTH", payload: { user, token } });

    // admin accounts only manage the store, so they don't get a cart or order history
    if (user.isAdmin) {
      lastSavedKey.current = "";
      dispatch({ type: "SET_CART", payload: [] });
      dispatch({ type: "SET_ORDERS", payload: [] });
      return;
    }

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

  const login = useCallback( // saves the token and user in app state
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

  // kung mag umpisa ang app
  useEffect(() => {
    reloadProducts(); // ginaload products ih

    const token = getSavedToken(); // nasave prev login token?
    if (!token) return; // waay? ti untat
    fetchMe(token) // kung may ara kay sin o to?
      .then((user) => startSession({ user, token })) // kung valid, kuhaa! gaga, start na session
      .catch((error) => {
        if (isAuthError(error)) saveToken(null);
        else console.error("Failed to restore login:", error);
      });
  }, [reloadProducts, startSession]);

  const { cart, token } = state;
  useEffect(() => {
    if (!token || !cartReady) return; // kung wara signin/wara pa tapos loading ang saved cart
    const key = cartKey(cart);
    if (key === lastSavedKey.current) return; // need ba saving? kung ga match mn ti way saving

    // kung waay ga match ti wait anay bag o update cart so ang sunod2 nga edits madungan save
    const timer = setTimeout(() => {
      saveCart(token, cart)
        .then((saved) => {
          const savedKey = cartKey(saved);
          lastSavedKey.current = savedKey;
          // ja na masulod si stateRef
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
    <CardContext.Provider value={{ state, dispatch, reloadProducts, login, register, logout, startSession }}>
      {children}
    </CardContext.Provider>
  );
}

// helper comp to get the shared info
export function useCard() {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error("useCard must be used within a CardProvider");
  }
  return context;
}
