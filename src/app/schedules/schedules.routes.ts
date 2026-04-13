import { Router } from 'express';
import { SchedulesController } from './schedules.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const controller = new SchedulesController();

router.post('/', authenticateJWT, requireRole('BUSINESS_OWNER'), controller.createSchedule);

export default router;
