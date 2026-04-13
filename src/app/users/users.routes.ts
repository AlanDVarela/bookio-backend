import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const usersController = new UsersController();

router.get('/', authenticateJWT, usersController.getAll);
router.get('/:id', authenticateJWT, usersController.getById);

router.patch('/:id/avatar', authenticateJWT, uploadSettings.single('photo'), usersController.uploadAvatar);

export default router;
