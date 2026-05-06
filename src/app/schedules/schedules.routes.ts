import { Router } from 'express';
import { SchedulesController } from './schedules.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new SchedulesController();

const auth = [authenticateJWT, requireRole('BUSINESS_OWNER')];

// Ruta pública — debe ir antes de las rutas con auth
router.get('/business/:businessId', controller.getByBusiness);

router.get('/',               ...auth, controller.getMine);
router.put('/',               ...auth, controller.upsertDay);
router.delete('/:id',         ...auth, controller.removeDay);
router.post('/blocked',       ...auth, controller.addBlockedSlot);
router.delete('/blocked/:id', ...auth, controller.removeBlockedSlot);

export default router;
