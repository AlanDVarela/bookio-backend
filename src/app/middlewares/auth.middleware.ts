import { Request, Response, NextFunction } from 'express';
import { admin } from '../../config/firebase.config';
import { prisma } from '../../database/prisma';

//Middleware para autenticar JWT y verificar roles
//Autenticacion por medio de Firebase

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'CLIENT' | 'BUSINESS_OWNER';
  };
}

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await admin().auth().verifyIdToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.uid },
      select: { id: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not registered' });
      return;
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err: any) {
    if (err.code?.startsWith('auth/')) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireRole = (role: 'CLIENT' | 'BUSINESS_OWNER') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: `Forbidden: Requires ${role} role` });
      return;
    }
    next();
  };
};
