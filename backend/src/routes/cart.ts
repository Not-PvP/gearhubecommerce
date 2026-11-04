import { Router, Request, Response } from 'express';
import { db } from '../db';
import { validateResource } from '../validate';
import { authenticateToken, requireCustomer } from '../authMiddleware';
import { saveCartBodySchema, saveCartSchema } from '../schemas';
import { serializeProduct } from '../serializers';

const router = Router();

router.use(authenticateToken); // gapa require ka valid token para sa kada route

const loadCart = async (userId: number) => { // ginapnagita ang items sa cart kang user kag gina convert to front shape
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

// handles fetchCart() and returns ang na save nga cart kang user nga naka sign-in
router.get('/', async (req: Request, res: Response) => { // gina load na cart kang user nga naka sign in
  try {
    res.json(await loadCart(req.user!.userId)); // bul on id ka naverify nga token, loads the users cart kag ibalik siya as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load cart' });
  }
});

// handles saveCart() kag gina update ang saved cart
router.put('/', requireCustomer, validateResource(saveCartSchema), async (req: Request, res: Response) => { //gina ensure that the account is a customer kag gina check ang request data
  const userId = req.user!.userId; // bul on id halin sa verified token kag ginaread na ang ginsubmit nga cart items from the request body
  const { items } = saveCartBodySchema.parse(req.body);

  // kung mag  appear ang product more than 1 ti ma add quantities ya
  const quantities = new Map<number, number>(); 
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  try {
    // replace the saved cart, capping each quantity at the current stock (du delete ya  previous nga cart kag add na ang updated cart)
    await db.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: [...quantities.keys()] } } }); // sagapun ya product sa db

      const rows = products // himo siya  rows to save pero ginalimit ya quantity depende sa stock
        .map((product) => ({
          userId,
          productId: product.id,
          quantity: Math.min(quantities.get(product.id)!, product.stockQuantity),
        }))
        .filter((row) => row.quantity > 0);

      await tx.cartItem.deleteMany({ where: { userId } }); // muy ga delete
      if (rows.length > 0) {
        await tx.cartItem.createMany({ data: rows }); // muya ma create kag mangin updated cart
      }
    });

    res.json(await loadCart(userId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save cart' });
  }
});

export default router;
