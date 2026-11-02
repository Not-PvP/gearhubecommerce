import { CheckoutPaymentMethod } from "../utils/paymentMethods";

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  stock: number;
}

export interface CartItem extends Product {
  quantity: number;
  selected: boolean;
}

export interface Filters {
  searchQuery: string;
  category: string;
  maxPrice: number;
  sortBy: "default" | "price-asc" | "price-desc";
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

export type PaymentMethod = CheckoutPaymentMethod;

export type StoredPaymentMethod = CheckoutPaymentMethod | "card" | "gcash";

export interface OrderItem {
  id: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: StoredPaymentMethod;
  status: OrderStatus;
  createdAt: string;
}

export type LoadStatus = "loading" | "ready" | "error";

export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
}

export type AfterLogin = "checkout" | "orders" | null;

export interface AuthPrompt {
  open: boolean;
  reason: string;
  next: AfterLogin;
}

export interface State {
  products: Product[];
  productsStatus: LoadStatus;
  productsError: string;
  cart: CartItem[];
  orders: Order[];
  filters: Filters;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isOrderHistoryOpen: boolean;
  user: User | null;
  token: string | null;
  authPrompt: AuthPrompt;
  lastAdded: { product: Product; count: number } | null;
}