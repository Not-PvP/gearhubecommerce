import { JwtPayload } from 'jsonwebtoken';

export interface AuthPayload extends JwtPayload {
  userId: number;
  email: string;
}

declare global {
  namespace Express {
    export interface Request {
      user?: AuthPayload;
    }
  }
}
