import { Router } from 'express';
import { ServicesController } from './services.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const controller = new ServicesController();

const auth = [authenticateJWT, requireRole('BUSINESS_OWNER')];

router.get('/',                          ...auth, controller.getOwnServices);
router.post('/',                         ...auth, controller.createService);
router.get('/:id/schedule',              ...auth, controller.getServiceSchedule);
router.put('/:id/schedule',              ...auth, controller.upsertServiceScheduleDay);
router.delete('/:id/schedule/:dayId',    ...auth, controller.removeServiceScheduleDay);
router.patch('/:id/photo',               ...auth, uploadSettings.single('photo'), controller.uploadPhoto);

export default router;
