import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const parseNumericId = (value: string | string[] | undefined, fieldName: string): number => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalizedValue);

  if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '' || Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return parsed;
};

const serializeProduct = (product: {
  id: number;
  name: string;
  category: string | null;
  price: Prisma.Decimal;
  imageUrl: string | null;
  stockQuantity: number;
}) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: Number(product.price),
  image_url: product.imageUrl,
  stock_quantity: product.stockQuantity,
});

const serializeUser = (user: { id: number; email: string; isAdmin: boolean | null }) => ({
  id: user.id,
  email: user.email,
  is_admin: user.isAdmin,
});

const serializeCartItem = (item: { id: number; userId: number | null; productId: number | null; quantity: number }) => ({
  id: item.id,
  user_id: item.userId,
  product_id: item.productId,
  quantity: item.quantity,
});

app.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    res.json(products.map(serializeProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const id = parseNumericId(req.params.id, 'Product id');
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(serializeProduct(product));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product id' });
  }
});

app.post('/api/users/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        isAdmin: false,
      },
      select: {
        id: true,
        email: true,
        isAdmin: true,
      },
    });

    res.status(201).json(serializeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.json(serializeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.get('/api/cart/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseNumericId(req.params.userId, 'User id');

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { id: 'asc' },
    });

    res.json(
      cartItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product_id: item.productId,
        name: item.product?.name ?? null,
        price: item.product ? Number(item.product.price) : null,
        image_url: item.product?.imageUrl ?? null,
        stock_quantity: item.product?.stockQuantity ?? null,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid user id' });
  }
});

app.post('/api/cart', async (req: Request, res: Response) => {
  try {
    const { userId, productId, quantity } = req.body as {
      userId?: number | string;
      productId?: number | string;
      quantity?: number | string;
    };

    if (userId == null || productId == null || quantity == null) {
      res.status(400).json({ error: 'userId, productId, and quantity are required' });
      return;
    }

    const parsedUserId = parseNumericId(String(userId), 'User id');
    const parsedProductId = parseNumericId(String(productId), 'Product id');
    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      res.status(400).json({ error: 'quantity must be a positive number' });
      return;
    }

    const item = await prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId: parsedUserId,
          productId: parsedProductId,
        },
      },
      update: {
        quantity: { increment: parsedQuantity },
      },
      create: {
        userId: parsedUserId,
        productId: parsedProductId,
        quantity: parsedQuantity,
      },
    });

    res.status(201).json(serializeCartItem(item));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add item to cart' });
  }
});

app.put('/api/cart/:id', async (req: Request, res: Response) => {
  try {
    const id = parseNumericId(req.params.id, 'Cart item id');
    const { quantity } = req.body as { quantity?: number | string };

    if (quantity == null) {
      res.status(400).json({ error: 'quantity is required' });
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity)) {
      res.status(400).json({ error: 'quantity must be a valid number' });
      return;
    }

    if (parsedQuantity <= 0) {
      try {
        await prisma.cartItem.delete({ where: { id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          res.status(404).json({ error: 'Cart item not found' });
          return;
        }

        throw error;
      }

      res.json({ deleted: true });
      return;
    }

    const item = await prisma.cartItem.update({
      where: { id },
      data: { quantity: parsedQuantity },
    });

    res.json(serializeCartItem(item));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    console.error(error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

app.delete('/api/cart/:id', async (req: Request, res: Response) => {
  try {
    const id = parseNumericId(req.params.id, 'Cart item id');

    try {
      await prisma.cartItem.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        res.status(404).json({ error: 'Cart item not found' });
        return;
      }

      throw error;
    }

    res.json({ deleted: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});

// ---------- Orders ----------

const SHIPPING_FEE = 150;
// 'xendit' = paid online through Xendit's hosted checkout.
// 'card' and 'gcash' stay valid so orders saved before this change still load.
const PAYMENT_METHODS = ['cod', 'xendit', 'card', 'gcash'] as const;
const ADDRESS_FIELDS = ['fullName', 'street', 'city', 'province', 'postalCode', 'phone'] as const;

type ShippingAddress = Record<(typeof ADDRESS_FIELDS)[number], string>;

// Thrown inside the order transaction so it rolls back and the client gets a clear status code.
class OrderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const orderInclude = { order_items: { include: { products: true } } } as const;

type OrderWithItems = Prisma.ordersGetPayload<{ include: typeof orderInclude }>;

const parseAddress = (raw: string): ShippingAddress | string => {
  try {
    return JSON.parse(raw) as ShippingAddress;
  } catch {
    return raw;
  }
};

const serializeOrder = (order: OrderWithItems) => {
  const items = order.order_items.map((item) => ({
    id: String(item.product_id),
    name: item.products?.name ?? 'Removed product',
    image: item.products?.imageUrl ?? '',
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = subtotal > 0 ? SHIPPING_FEE : 0;

  return {
    id: String(order.id),
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    shippingAddress: parseAddress(order.shipping_address),
    paymentMethod: order.payment_method,
    status: order.status,
    createdAt: (order.created_at ?? new Date()).toISOString(),
  };
};

app.post('/api/orders', async (req: Request, res: Response) => {
  const { items, shippingAddress, paymentMethod, status, userId } = req.body as {
    items?: { productId?: number | string; quantity?: number | string }[];
    shippingAddress?: Partial<ShippingAddress>;
    paymentMethod?: string;
    status?: string;
    userId?: number | string;
  };

  // --- validate the request before touching the database ---
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items must be a non-empty array' });
    return;
  }
  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    res.status(400).json({ error: `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}` });
    return;
  }
  const missingField = ADDRESS_FIELDS.find((field) => !shippingAddress?.[field]?.toString().trim());
  if (missingField) {
    res.status(400).json({ error: `shippingAddress.${missingField} is required` });
    return;
  }
  // COD orders start as PENDING; online payments are only saved after Xendit reports them PAID.
  const orderStatus = status === 'PAID' ? 'PAID' : 'PENDING';

  // merge duplicate lines so stock is checked against the real total per product
  const quantities = new Map<number, number>();
  for (const line of items) {
    const productId = Number(line.productId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: 'Each item needs an integer productId and a positive integer quantity' });
      return;
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const productIds = [...quantities.keys()];
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productById = new Map(products.map((product) => [product.id, product]));

      for (const [productId, quantity] of quantities) {
        const product = productById.get(productId);
        if (!product) {
          throw new OrderError(404, `Product ${productId} no longer exists`);
        }

        // conditional decrement: only succeeds if enough stock is left at this moment,
        // so two customers can't both buy the last unit
        const updated = await tx.product.updateMany({
          where: { id: productId, stockQuantity: { gte: quantity } },
          data: { stockQuantity: { decrement: quantity } },
        });
        if (updated.count === 0) {
          throw new OrderError(
            409,
            product.stockQuantity === 0
              ? `${product.name} is out of stock`
              : `Only ${product.stockQuantity} left of ${product.name}`,
          );
        }
      }

      return tx.orders.create({
        data: {
          user_id: userId != null ? Number(userId) : null,
          status: orderStatus,
          payment_method: paymentMethod,
          shipping_address: JSON.stringify(
            Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, String(shippingAddress![field]).trim()])),
          ),
          order_items: {
            // unit price comes from the database, never from the browser
            create: [...quantities].map(([productId, quantity]) => ({
              product_id: productId,
              quantity,
              unit_price: productById.get(productId)!.price,
            })),
          },
        },
        include: orderInclude,
      });
    });

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET /api/orders?ids=3,4,5 — guests have no account yet, so the browser remembers its own order ids
app.get('/api/orders', async (req: Request, res: Response) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 100);

  if (ids.length === 0) {
    res.json([]);
    return;
  }

  try {
    const orders = await prisma.orders.findMany({
      where: { id: { in: ids } },
      include: orderInclude,
      orderBy: { id: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

const ORDER_STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatusValue = (typeof ORDER_STATUSES)[number];
const LOW_STOCK_THRESHOLD = 5;

// The storefront has no login yet, so the dashboard sends the admin's email and password
// in headers on every request and we check them here against the database.
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const email = req.header('x-admin-email');
  const password = req.header('x-admin-password');

  if (!email || !password) {
    res.status(401).json({ error: 'Admin login required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const match = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !match) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (!user.isAdmin) {
      res.status(403).json({ error: 'This account is not an admin' });
      return;
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify admin' });
  }
};

// Lets the dashboard check a login before loading any data.
app.get('/api/admin/me', requireAdmin, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// All customer orders, newest first.
app.get('/api/admin/orders', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.orders.findMany({
      include: orderInclude,
      orderBy: { id: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Change an order's fulfillment status.
// Cancelling puts the ordered items back into stock, in the same transaction.
app.patch('/api/admin/orders/:id/status', requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Order id must be a valid number' });
    return;
  }
  if (!status || !ORDER_STATUSES.includes(status as OrderStatusValue)) {
    res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
    return;
  }
  const nextStatus = status as OrderStatusValue;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({ where: { id }, include: orderInclude });

      if (!order) {
        throw new OrderError(404, 'Order not found');
      }
      if (order.status === 'CANCELLED') {
        throw new OrderError(409, 'A cancelled order cannot be changed');
      }

      if (nextStatus === 'CANCELLED') {
        if (order.status === 'DELIVERED') {
          throw new OrderError(409, 'A delivered order cannot be cancelled');
        }
        for (const item of order.order_items) {
          if (item.product_id != null) {
            await tx.product.update({
              where: { id: item.product_id },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }

      return tx.orders.update({
        where: { id },
        data: { status: nextStatus },
        include: orderInclude,
      });
    });

    res.json(serializeOrder(updated));
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Products at or below the threshold (default 5), lowest stock first.
app.get('/api/admin/low-stock', requireAdmin, async (req: Request, res: Response) => {
  const requested = Number(req.query.threshold);
  const threshold = Number.isInteger(requested) && requested >= 0 ? requested : LOW_STOCK_THRESHOLD;

  try {
    const products = await prisma.product.findMany({
      where: { stockQuantity: { lte: threshold } },
      orderBy: [{ stockQuantity: 'asc' }, { id: 'asc' }],
    });
    res.json(products.map(serializeProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch low-stock products' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});