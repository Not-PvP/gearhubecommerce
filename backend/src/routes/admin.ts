import { Router, Request, Response } from 'express';
import { db } from '../db';
import { validateResource } from '../validate';
import { authenticateToken, requireAdmin } from '../authMiddleware';
import { lowStockSchema, updateOrderStatusBodySchema, updateOrderStatusSchema } from '../schemas';
import { orderInclude, serializeOrder, serializeProduct } from '../serializers';
import { HttpError } from '../errors';

const router = Router();

const LOW_STOCK_THRESHOLD = 5;

router.use(authenticateToken, requireAdmin);

router.get('/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await db.order.findMany({
      include: orderInclude,
      orderBy: { id: 'desc' },
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.patch('/orders/:id/status', validateResource(updateOrderStatusSchema), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status: nextStatus } = updateOrderStatusBodySchema.parse(req.body);

  try {
    const updated = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: orderInclude });

      if (!order) {
        throw new HttpError(404, 'Order not found');
      }
      if (order.status === 'CANCELLED') {
        throw new HttpError(409, 'A cancelled order cannot be changed');
      }

      if (nextStatus === 'CANCELLED') {
        if (order.status === 'DELIVERED') {
          throw new HttpError(409, 'A delivered order cannot be cancelled');
        }
        // cancelling puts the items back in stock
        for (const item of order.items) {
          if (item.productId != null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: nextStatus },
        include: orderInclude,
      });
    });

    res.json(serializeOrder(updated));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.get('/low-stock', validateResource(lowStockSchema), async (req: Request, res: Response) => {
  const requested = Number(req.query.threshold);
  const threshold = Number.isInteger(requested) && requested >= 0 ? requested : LOW_STOCK_THRESHOLD;

  try {
    const products = await db.product.findMany({
      where: { stockQuantity: { lte: threshold } },
      orderBy: [{ stockQuantity: 'asc' }, { id: 'asc' }],
    });
    res.json(products.map(serializeProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch low-stock products' });
  }
});

export default router;
