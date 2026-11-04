// mag convert prisma objects to json
import { Prisma } from '@prisma/client';
import { ShippingAddress } from './schemas';

export const SHIPPING_FEE = 150;

export const serializeProduct = (product: {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: Prisma.Decimal;
  imageUrl: string | null;
  stockQuantity: number;
}) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  description: product.description,
  price: Number(product.price),
  image_url: product.imageUrl,
  stock_quantity: product.stockQuantity,
});

export const serializeUser = (user: { id: number; email: string; isAdmin: boolean | null }) => ({
  id: user.id,
  email: user.email,
  is_admin: Boolean(user.isAdmin),
});

// related abi ang order sa order items, kag ang kada item related to a product
export const orderInclude = { items: { include: { product: true } } } as const; // tells prsima to fetch related items nd prods along w/ order it can like like name, image chuchu

// tells ts its value has the shape of an order returned by prisma w/ the related items
export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>; // type checking

export const serializeOrder = (order: OrderWithItems) => {
  const items = order.items.map((item) => ({
    id: String(item.productId),
    name: item.product?.name ?? 'Removed product',
    image: item.product?.imageUrl ?? '',
    unitPrice: Number(item.unitPrice),
    quantity: item.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = subtotal > 0 ? SHIPPING_FEE : 0;
  // the address is stored in separate columns; the frontend gets it back as one object
  const shippingAddress: ShippingAddress = {
    fullName: order.fullName,
    street: order.street,
    city: order.city,
    province: order.province,
    postalCode: order.postalCode,
    phone: order.phone,
  };
  // may compuations because? para ni sa frontend nga idisplay
  
  return {
    id: String(order.id),
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    shippingAddress,
    paymentMethod: order.paymentMethod,
    status: order.status,
    createdAt: (order.createdAt ?? new Date()).toISOString(),
  };
};
