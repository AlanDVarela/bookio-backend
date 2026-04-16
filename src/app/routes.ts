import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import usersRoutes from './users/users.routes';
import businessesRoutes from './businesses/businesses.routes';
import appointmentsRoutes from './appointments/appointments.routes';
import servicesRoutes from './services/services.routes';
import schedulesRoutes from './schedules/schedules.routes';
import reviewsRoutes from './reviews/reviews.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/businesses', businessesRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/services', servicesRoutes);
router.use('/schedules', schedulesRoutes);
router.use('/reviews', reviewsRoutes);

export default router;
