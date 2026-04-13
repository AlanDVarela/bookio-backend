import { Request, Response, NextFunction } from 'express';
// Note: In a real app we might use "jsonwebtoken" to decode and verify,
// or a Supabase/Firebase SDK to check the token's validity.
// For this blueprint, we mock the basic parsing logic.

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'CLIENT' | 'BUSINESS_OWNER';
  };
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // MOCK VALIDATION: In a real scenario, use Supabase verify method or jwt.verify
    // decodedToken = jwt.verify(token, env.JWT_SECRET)
    // Here we decode a mock token for development purposes:
    try {
      // Allow a special bypass token for testing
      if (token === 'mock-owner-token') {
        req.user = { id: 'mock-owner-id', role: 'BUSINESS_OWNER' };
        return next();
      }
      if (token === 'mock-client-token') {
        req.user = { id: 'mock-client-id', role: 'CLIENT' };
        return next();
      }

      // Normally we decode JWT and parse.
      // throw new Error("Invalid token")
      res.status(401).json({ error: 'Unauthorized: Invalid Token Mock' });
    } catch (e) {
      res.status(403).json({ error: 'Forbidden' });
    }
  } else {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
};

export const requireRole = (role: 'CLIENT' | 'BUSINESS_OWNER') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Forbidden: Requires ${role} role` });
    }
    next();
  };
};
