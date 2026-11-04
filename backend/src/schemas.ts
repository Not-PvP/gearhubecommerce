import { z } from 'zod';

const idParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a numeric string'),
});

// namean ya muni included sa request
export const listProductsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
  }),
});

export const productIdSchema = z.object({
  params: idParamsSchema,
});

export const registerBodySchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const loginBodySchema = z.object({
  email: z.string().trim().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const registerSchema = z.object({ body: registerBodySchema });
export const loginSchema = z.object({ body: loginBodySchema });

export const lineItemSchema = z.object({
  // the frontend sends ids as strings, so coerce to numbers
  productId: z.coerce.number().int('productId must be a whole number.').positive('productId must be positive.'),
  quantity: z.coerce.number().int('quantity must be a whole number.').positive('quantity must be at least 1.'),
});

export const saveCartBodySchema = z.object({
  items: z.array(lineItemSchema),
});

export const saveCartSchema = z.object({ body: saveCartBodySchema });

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(255, 'Full name is too long.'),
  street: z.string().trim().min(1, 'Street address is required.'),
  city: z.string().trim().min(1, 'City is required.').max(100, 'City is too long.'),
  province: z.string().trim().min(1, 'Province is required.').max(100, 'Province is too long.'),
  postalCode: z.string().trim().regex(/^\d{4}$/, 'Postal code must be 4 digits.'),
  phone: z.string().trim().regex(/^09\d{9}$/, 'Phone must be 11 digits starting with 09.'),
});

export const PAYMENT_METHODS = ['cod', 'xendit'] as const;
export const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

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

export const createOrderSchema = z.object({ body: createOrderBodySchema });

export const orderIdSchema = z.object({ params: idParamsSchema });

export const updateOrderStatusBodySchema = z.object({
  status: z.enum(ORDER_STATUSES, `status must be one of: ${ORDER_STATUSES.join(', ')}.`),
});

export const updateOrderStatusSchema = z.object({
  params: idParamsSchema,
  body: updateOrderStatusBodySchema,
});

export const lowStockSchema = z.object({
  query: z.object({
    threshold: z.coerce.number().int().min(0, 'threshold cannot be negative.').optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderBodySchema>;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
