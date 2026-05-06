import { Router } from 'express';
import { AppointmentsController } from './appointments.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';

const router = Router();
const appointmentsController = new AppointmentsController();

// Slots public logic
router.get('/slots', appointmentsController.getAvailableSlots);

// Full CRUD
router.get('/', authenticateJWT, appointmentsController.getAll);

router.post(
  '/',
  authenticateJWT,
  requireRole('CLIENT'),
  appointmentsController.bookAppointment
);

router.post(
  '/manual',
  authenticateJWT,
  requireRole('BUSINESS_OWNER'),
  appointmentsController.bookManualAppointment
);

router.put('/:id/status', authenticateJWT, appointmentsController.updateStatus);
router.delete('/:id', authenticateJWT, appointmentsController.deleteAppointment);

export default router;
