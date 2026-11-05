import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { AuthPayload } from './types/express';

export const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    // in production a missing secret would let anyone forge tokens, so refuse to run
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
    }
    console.warn('JWT_SECRET is not set in backend/.env; using an insecure fallback secret (development only).');
  }
  return process.env.JWT_SECRET || 'fallback_secret';
};

// token check!
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');

  // format: 'Bearer <token>'
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) { // if no bearer token
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try { // verifies the token kag mapatuloy siya by putting the user ID sa req.user
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === 'string' || typeof decoded.userId !== 'number') {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }

    // routes can now use req.user.userId
    req.user = decoded as AuthPayload;

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // check the database, not the token, so removing admin access works right away
    const user = await db.user.findUnique({ where: { id: req.user!.userId } });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'This account is not an admin.' });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify admin' });
  }
};

// admins manage the store; they don't shop in it
export const requireCustomer = async (req: Request, res: Response, next: NextFunction) => { // gina ensure nga ang account bukot admin
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.userId } });

    if (user?.isAdmin) {
      return res.status(403).json({ error: 'Admin accounts cannot place orders or use a cart.' });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify account' });
  }
};
