import { Router, Request, Response } from 'express';
import { db } from '../db';
import { validateResource } from '../validate';
import { authenticateToken } from '../authMiddleware';
import { saveCartBodySchema, saveCartSchema } from '../schemas';
import { serializeProduct } from '../serializers';

const router = Router();

router.use(authenticateToken);

const loadCart = async (userId: number) => {
  const cartItems = await db.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { id: 'asc' },
  });

  return cartItems
    .filter((item) => item.product)
    .map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      product: serializeProduct(item.product!),
    }));
};

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await loadCart(req.user!.userId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load cart' });
  }
});

router.put('/', validateResource(saveCartSchema), async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { items } = saveCartBodySchema.parse(req.body);

  const quantities = new Map<number, number>();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  try {
    // replace the saved cart, capping each quantity at the current stock
    await db.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: [...quantities.keys()] } } });

      const rows = products
        .map((product) => ({
          userId,
          productId: product.id,
          quantity: Math.min(quantities.get(product.id)!, product.stockQuantity),
        }))
        .filter((row) => row.quantity > 0);

      await tx.cartItem.deleteMany({ where: { userId } });
      if (rows.length > 0) {
        await tx.cartItem.createMany({ data: rows });
      }
    });

    res.json(await loadCart(userId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save cart' });
  }
});

export default router;
