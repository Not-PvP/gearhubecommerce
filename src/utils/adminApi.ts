import { Order, OrderStatus } from "../types/types";
import { login } from "./api";

const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export interface LowStockProduct {
  id: number;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

async function adminFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.details?.[0]?.message ?? body?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export async function adminLogin(email: string, password: string): Promise<string> {
  const { user, token } = await login(email, password);
  if (!user.isAdmin) {
    throw new Error("This account is not an admin.");
  }
  return token;
}

export const fetchAdminOrders = (token: string) => adminFetch<Order[]>("/api/admin/orders", token);

export const fetchLowStock = (token: string) => adminFetch<LowStockProduct[]>("/api/admin/low-stock", token);

export const updateOrderStatus = (token: string, orderId: string, status: OrderStatus) =>
  adminFetch<Order>(`/api/admin/orders/${orderId}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
