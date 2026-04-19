import { Router } from 'express';
import { BusinessesController } from './businesses.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const businessesController = new BusinessesController();


//Rutas publicas
router.get('/recommended', businessesController.getRecommended);
router.get('/', businessesController.getAll);

//Rutas privadas Business_Owner — deben ir ANTES de /:id para que Express no las capture como parámetro
router.get('/mine',        authenticateJWT, requireRole('BUSINESS_OWNER'), businessesController.getMine);
router.get('/metrics',     authenticateJWT, requireRole('BUSINESS_OWNER'), businessesController.getMetrics);
router.get('/reservations',authenticateJWT, requireRole('BUSINESS_OWNER'), businessesController.getReservations);

router.get('/:id', businessesController.getById);
router.get('/:id/services', businessesController.getBusinessServices);
router.post(
  '/',
  authenticateJWT,
  requireRole('BUSINESS_OWNER'),
  uploadSettings.single('logo'),
  businessesController.registerBusiness
);

router.post(
  '/:id/photos',
  authenticateJWT,
  requireRole('BUSINESS_OWNER'),
  uploadSettings.array('photos', 5),
  businessesController.uploadPhotos
);

export default router;
