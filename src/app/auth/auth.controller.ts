import { Request, Response } from 'express';
import { admin } from '../../config/firebase.config';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    const { idToken, role, name, phone } = req.body;

    if (!idToken || !role) {
      res.status(400).json({ error: 'idToken and role are required' });
      return;
    }

    if (role !== 'CLIENT' && role !== 'BUSINESS_OWNER') {
      res.status(400).json({ error: 'role must be CLIENT or BUSINESS_OWNER' });
      return;
    }

    try {
      const decoded = await admin().auth().verifyIdToken(idToken);

      const { user, created } = await authService.registerUser({
        firebaseUid: decoded.uid,
        email: decoded.email!,
        name: name ?? decoded.name ?? decoded.email!.split('@')[0],
        role,
        phone,
        avatarUrl: decoded.picture,
      });

      res.status(created ? 201 : 200).json({ user });
    } catch (err: any) {
      if (err.code?.startsWith('auth/')) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      console.error('register error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async me(req: AuthenticatedRequest, res: Response) {
    const profile = await authService.getProfile(req.user!.id);
    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: profile });
  }
}
