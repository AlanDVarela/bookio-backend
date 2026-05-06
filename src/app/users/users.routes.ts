import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const usersController = new UsersController();

// GET - Consultas
router.get('/', authenticateJWT, usersController.getAll);
router.get('/:id', authenticateJWT, usersController.getById);

// PUT - Actualización de perfil 
router.put('/profile', authenticateJWT, usersController.updateProfile);

// PATCH 
router.patch('/:id/avatar', authenticateJWT, uploadSettings.single('photo'), usersController.uploadAvatar);

// DELETE - Eliminar cuenta
router.delete('/:id', authenticateJWT, usersController.deleteAccount);

export default router;