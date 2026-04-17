import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

// Called once after Firebase sign-up (email/password or Google) to persist the user in our DB
router.post('/register', (req, res) => controller.register(req, res));

// Specific endpoints expected by Frontend 
router.post('/login', (req, res) => controller.login(req, res));
router.post('/register/client', (req, res) => controller.registerClient(req, res));
router.post('/register/business', (req, res) => controller.registerBusiness(req, res));

// Returns the current user's profile (requires valid Firebase token)
router.get('/me', authenticateJWT, (req, res) => controller.me(req as any, res));

export default router;
