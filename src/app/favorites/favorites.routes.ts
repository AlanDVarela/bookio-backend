import { Router } from 'express';
import { FavoritesController } from './favorites.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new FavoritesController();

router.get('/', authenticateJWT, requireRole('CLIENT'), controller.getFavorites);
router.delete('/:id', authenticateJWT, requireRole('CLIENT'), controller.removeFavorite);
router.post('/', authenticateJWT, requireRole('CLIENT'), controller.addFavorite);

export default router;
