import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { validateResource } from '../validate';
import { listProductsSchema, productIdSchema } from '../schemas';
import { serializeProduct } from '../serializers';

const router = Router();

// kung magbuol kaw products pero validateya anay request antis mag query sa db
router.get('/', validateResource(listProductsSchema), async (req: Request, res: Response) => { // route handler
  const { search, category } = req.query as { search?: string; category?: string };

  try {
    const where: Prisma.ProductWhereInput = {};
    if (search) where.name = { contains: search, mode: 'insensitive' }; // kung need mo compare depende sa gintype ka user
    if (category) where.category = category; // kung mag filter kaw by category (may jn na mn siya sa iya ka frontend pero like usable ya kung sa backend sila directly mangayo bala)

    const products = await db.product.findMany({ where, orderBy: { id: 'asc' } });
    res.json(products.map(serializeProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// kung ang user magclick bala ka product card para makita product details
router.get('/:id', validateResource(productIdSchema), async (req: Request, res: Response) => {
  try {
    const product = await db.product.findUnique({ where: { id: Number(req.params.id) } });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(serializeProduct(product));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

export default router;
