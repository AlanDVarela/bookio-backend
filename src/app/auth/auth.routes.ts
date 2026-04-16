import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

// Called once after Firebase sign-up (email/password or Google) to persist the user in our DB
router.post('/register', (req, res) => controller.register(req, res));

// Returns the current user's profile (requires valid Firebase token)
router.get('/me', authenticateJWT, (req, res) => controller.me(req as any, res));

export default router;
