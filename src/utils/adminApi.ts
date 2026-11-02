import { Order, OrderStatus } from "../types/types";

// If your utils/api.ts already exports the API base URL, import it here instead.
const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export interface AdminCredentials {
  email: string;
  password: string;
}

// /api/admin/low-stock returns products in the same shape as /api/products
export interface LowStockProduct {
  id: number;
  name: string;
  category: string | null;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

async function adminFetch<T>(
  path: string,
  creds: AdminCredentials,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-email": creds.email,
      "x-admin-password": creds.password,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return body as T;
}

export const verifyAdmin = (creds: AdminCredentials) =>
  adminFetch<{ ok: boolean }>("/api/admin/me", creds);

export const fetchAdminOrders = (creds: AdminCredentials) =>
  adminFetch<Order[]>("/api/admin/orders", creds);

export const fetchLowStock = (creds: AdminCredentials) =>
  adminFetch<LowStockProduct[]>("/api/admin/low-stock", creds);

export const updateOrderStatus = (
  creds: AdminCredentials,
  orderId: string,
  status: OrderStatus,
) =>
  adminFetch<Order>(`/api/admin/orders/${orderId}/status`, creds, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });