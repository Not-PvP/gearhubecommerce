import { Router, Request, Response } from 'express';
import { db } from '../db';
import { validateResource } from '../validate';
import { authenticateToken } from '../authMiddleware';
import { createOrderBodySchema, createOrderSchema, orderIdSchema } from '../schemas';
import { SHIPPING_FEE, orderInclude, serializeOrder } from '../serializers';
import { HttpError } from '../errors';
import { verifyXenditPayment } from '../payments';

const router = Router();

router.use(authenticateToken);

router.post('/', validateResource(createOrderSchema), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items, shippingAddress, paymentMethod, invoiceId } = createOrderBodySchema.parse(req.body);

  const quantities = new Map<number, number>();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  try {
    let status = 'PENDING';

    // online payment: confirm with Xendit that it's paid for the right amount
    if (paymentMethod === 'xendit') {
      const products = await db.product.findMany({ where: { id: { in: [...quantities.keys()] } } });
      const subtotal = products.reduce(
        (sum, product) => sum + Number(product.price) * (quantities.get(product.id) ?? 0),
        0,
      );
      await verifyXenditPayment(invoiceId!, subtotal + SHIPPING_FEE);
      status = 'PAID';
    }

    // one transaction: if any step fails, nothing is saved
    const order = await db.$transaction(async (tx) => {
      const productIds = [...quantities.keys()];
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productById = new Map(products.map((product) => [product.id, product]));

      for (const [productId, quantity] of quantities) {
        const product = productById.get(productId);
        if (!product) {
          throw new HttpError(404, `Product ${productId} no longer exists`);
        }

        // only decrements if enough stock is left, so the last item can't be sold twice
        const updated = await tx.product.updateMany({
          where: { id: productId, stockQuantity: { gte: quantity } },
          data: { stockQuantity: { decrement: quantity } },
        });
        if (updated.count === 0) {
          throw new HttpError(
            409,
            product.stockQuantity === 0
              ? `${product.name} is out of stock`
              : `Only ${product.stockQuantity} left of ${product.name}`,
          );
        }
      }

      await tx.cartItem.deleteMany({ where: { userId, productId: { in: productIds } } });

      return tx.order.create({
        data: {
          userId,
          status,
          paymentMethod,
          shippingAddress: JSON.stringify(shippingAddress),
          items: {
            create: [...quantities].map(([productId, quantity]) => ({
              productId,
              quantity,
              // price comes from the database, not the browser
              unitPrice: productById.get(productId)!.price,
            })),
          },
        },
        include: orderInclude,
      });
    });

    res.status(201).json(serializeOrder(order));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const orders = await db.order.findMany({
      where: { userId: req.user!.userId },
      include: orderInclude,
      orderBy: { id: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// customers can only cancel before the order is paid or shipped
const CUSTOMER_CANCELLABLE = ['PENDING'];

router.patch('/:id/cancel', validateResource(orderIdSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const userId = req.user!.userId;

  try {
    const cancelled = await db.$transaction(async (tx) => {
      // userId in the filter: customers can only cancel their own orders
      const order = await tx.order.findFirst({ where: { id, userId }, include: orderInclude });

      if (!order) {
        throw new HttpError(404, 'Order not found');
      }
      if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
        throw new HttpError(
          409,
          order.status === 'CANCELLED'
            ? 'This order is already cancelled.'
            : `This order is ${order.status.toLowerCase()} and can no longer be cancelled.`,
        );
      }

      for (const item of order.items) {
        if (item.productId != null) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: orderInclude,
      });
    });

    res.json(serializeOrder(cancelled));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
