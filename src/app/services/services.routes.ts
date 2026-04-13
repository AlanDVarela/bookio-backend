import { Router } from 'express';
import { ServicesController } from './services.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const controller = new ServicesController();

router.post('/', authenticateJWT, requireRole('BUSINESS_OWNER'), controller.createService);
router.patch('/:id/photo', authenticateJWT, requireRole('BUSINESS_OWNER'), uploadSettings.single('photo'), controller.uploadPhoto);

export default router;
