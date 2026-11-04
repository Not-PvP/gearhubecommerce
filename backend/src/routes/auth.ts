import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { validateResource } from '../validate';
import { authenticateToken, getJwtSecret } from '../authMiddleware';
import { loginBodySchema, loginSchema, registerBodySchema, registerSchema } from '../schemas';
import { serializeUser } from '../serializers';

const router = Router();

const TOKEN_EXPIRES_IN = '1d';

const signToken = (user: { id: number; email: string }) =>
  jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: TOKEN_EXPIRES_IN });

// ginavalidate ka registration ang request kag ginacheck kung gamit na ang email
router.post('/register', validateResource(registerSchema), async (req: Request, res: Response) => {
  const { email, password } = registerBodySchema.parse(req.body);

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // para manghash password
    const saltRounds = 10;
    // never store the plain password
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await db.user.create({
      data: { email, passwordHash, isAdmin: false },
    });

    res.status(201).json({
      message: 'User registered successfully!',
      user: serializeUser(user),
      token: signToken(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// mag sign in
router.post('/login', validateResource(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = loginBodySchema.parse(req.body);

  try {
    const user = await db.user.findUnique({ where: { email } }); // look for the email

    // same error for wrong email or wrong password
    const isValidPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({ message: 'Login successful', user: serializeUser(user), token: signToken(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully. Please remove the token from your client.' });
});

router.get('/me', authenticateToken, async (req: Request, res: Response) => { // validates the token halin sa fethme sa api.ts
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.userId } });

    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    res.json(serializeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load account' });
  }
});

export default router;
