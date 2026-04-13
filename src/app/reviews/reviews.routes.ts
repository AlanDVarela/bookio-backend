import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new ReviewsController();

// crear review
router.post('/', authenticateJWT, requireRole('CLIENT'), controller.createReview);

// obtener reviews
router.get('/business/:businessId', controller.getBusinessReviews);

export default router;
