import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new ReviewsController();

router.post('/', authenticateJWT, requireRole('CLIENT'), controller.createReview);
router.put('/:id', authenticateJWT, requireRole('CLIENT'), controller.updateReview);
router.delete('/:id', authenticateJWT, requireRole('CLIENT'), controller.deleteReview);
router.get('/business/:businessId', controller.getBusinessReviews);

export default router;
