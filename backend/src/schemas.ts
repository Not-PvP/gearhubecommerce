import { z } from 'zod';

// Shared by productIdSchema, orderIdSchema, and updateOrderStatusSchema to validate route IDs.
const idParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a numeric string'),
});

// Validates optional search/category query parameters for GET /api/products.
export const listProductsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
  }),
});

// Validates the :id parameter for GET /api/products/:id.
export const productIdSchema = z.object({
  params: idParamsSchema,
});

// Validates registration fields in POST /api/auth/register; also used to parse its body.
export const registerBodySchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

// Validates login fields in POST /api/auth/login; also used to parse its body.
export const loginBodySchema = z.object({
  email: z.string().trim().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

// Request wrappers passed to validateResource by the auth routes.
export const registerSchema = z.object({ body: registerBodySchema });
export const loginSchema = z.object({ body: loginBodySchema });

// Validates each product ID and quantity in PUT /api/cart and POST /api/orders.
export const lineItemSchema = z.object({
  // the frontend sends ids as strings, so coerce to numbers
  productId: z.coerce.number().int('productId must be a whole number.').positive('productId must be positive.'),
  quantity: z.coerce.number().int('quantity must be a whole number.').positive('quantity must be at least 1.'),
});

// Validates the items array in PUT /api/cart; cart.ts parses the body with this schema.
export const saveCartBodySchema = z.object({
  items: z.array(lineItemSchema),
});

// Request wrapper passed to validateResource by PUT /api/cart.
export const saveCartSchema = z.object({ body: saveCartBodySchema });

// Validates the shipping address in POST /api/orders.
export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(255, 'Full name is too long.'),
  street: z.string().trim().min(1, 'Street address is required.'),
  city: z.string().trim().min(1, 'City is required.').max(100, 'City is too long.'),
  province: z.string().trim().min(1, 'Province is required.').max(100, 'Province is too long.'),
  postalCode: z.string().trim().regex(/^\d{4}$/, 'Postal code must be 4 digits.'),
  phone: z.string().trim().regex(/^09\d{9}$/, 'Phone must be 11 digits starting with 09.'),
});

// Allowed payment methods for order creation.
export const PAYMENT_METHODS = ['cod', 'xendit'] as const;
// Allowed order statuses used to validate admin status updates.
export const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// Validates the order body in POST /api/orders; orders.ts also parses the body with it.
export const createOrderBodySchema = z
  .object({
    items: z.array(lineItemSchema).min(1, 'The order has no items.'),
    shippingAddress: shippingAddressSchema,
    paymentMethod: z.enum(PAYMENT_METHODS, 'paymentMethod must be cod or xendit.'),
    invoiceId: z.string().trim().min(1).max(100).optional(),
  })
  .refine((body) => body.paymentMethod !== 'xendit' || body.invoiceId, {
    message: 'invoiceId is required for online payments.',
    path: ['invoiceId'],
  });

// Request wrapper passed to validateResource by POST /api/orders.
export const createOrderSchema = z.object({ body: createOrderBodySchema });

// Validates the :id parameter for PATCH /api/orders/:id/cancel.
export const orderIdSchema = z.object({ params: idParamsSchema });

// Validates the requested status in PATCH /api/admin/orders/:id/status.
export const updateOrderStatusBodySchema = z.object({ // make sure an admin submits one of the allowed order statuses
  status: z.enum(ORDER_STATUSES, `status must be one of: ${ORDER_STATUSES.join(', ')}.`),
});

// Request wrapper passed to validateResource by the admin status-update route.
export const updateOrderStatusSchema = z.object({ // 
  params: idParamsSchema,
  body: updateOrderStatusBodySchema,
});

// Validates the optional threshold query parameter for GET /api/admin/low-stock.
export const lowStockSchema = z.object({
  query: z.object({
    threshold: z.coerce.number().int().min(0, 'threshold cannot be negative.').optional(),
  }),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;