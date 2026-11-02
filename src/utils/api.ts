import { CartItem, Order, PaymentMethod, Product, ShippingAddress, User } from "../types/types";

const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

interface ApiProduct {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

interface ApiUser {
  id: number;
  email: string;
  is_admin: boolean | null;
}

interface ApiCartLine {
  product_id: number;
  quantity: number;
  product: ApiProduct;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const isAuthError = (error: unknown) =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(`Can't reach the GearHub server at ${API_URL}. Is the backend running?`, 0);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.details?.[0]?.message || body.error || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

const toProduct = (p: ApiProduct): Product => ({
  id: String(p.id),
  name: p.name,
  category: p.category ?? "",
  description: p.description ?? "",
  price: p.price,
  image: p.image_url ?? "",
  stock: p.stock_quantity,
});

const toUser = (u: ApiUser): User => ({ id: u.id, email: u.email, isAdmin: Boolean(u.is_admin) });

const toCartItem = (line: ApiCartLine): CartItem => ({
  ...toProduct(line.product),
  quantity: line.quantity,
  selected: true,
});

export async function fetchProducts(): Promise<Product[]> {
  const products = await request<ApiProduct[]>("/api/products");
  return products.map(toProduct);
}

export async function fetchProduct(id: string): Promise<Product> {
  return toProduct(await request<ApiProduct>(`/api/products/${encodeURIComponent(id)}`));
}

export interface Session {
  user: User;
  token: string;
}

async function authenticate(path: string, email: string, password: string): Promise<Session> {
  const body = await request<{ user: ApiUser; token: string }>(path, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { user: toUser(body.user), token: body.token };
}

export const login = (email: string, password: string) => authenticate("/api/auth/login", email, password);

export const register = (email: string, password: string) =>
  authenticate("/api/auth/register", email, password);

export async function fetchMe(token: string): Promise<User> {
  return toUser(await request<ApiUser>("/api/auth/me", undefined, token));
}

const TOKEN_KEY = "gearhub:token";

export function getSavedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
  }
}

export async function fetchCart(token: string): Promise<CartItem[]> {
  const lines = await request<ApiCartLine[]>("/api/cart", undefined, token);
  return lines.map(toCartItem);
}

export async function saveCart(token: string, cart: CartItem[]): Promise<CartItem[]> {
  const lines = await request<ApiCartLine[]>(
    "/api/cart",
    {
      method: "PUT",
      body: JSON.stringify({
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
      }),
    },
    token,
  );
  return lines.map(toCartItem);
}

export interface NewOrder {
  items: { productId: string; quantity: number }[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  invoiceId?: string;
}

export function createOrder(token: string, order: NewOrder): Promise<Order> {
  return request<Order>(
    "/api/orders",
    {
      method: "POST",
      body: JSON.stringify(order),
    },
    token,
  );
}

export function fetchMyOrders(token: string): Promise<Order[]> {
  return request<Order[]>("/api/orders", undefined, token);
}

export function cancelOrder(token: string, orderId: string): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "PATCH" }, token);
}
