import { Router } from 'express';
import { BusinessesController } from './businesses.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { uploadSettings } from '../middlewares/upload.middleware';

const router = Router();
const businessesController = new BusinessesController();


//Rutas publicas
router.get('/recommended', businessesController.getRecommended);
router.get('/', businessesController.getAll);

//Rutas privadas Business_Owner
router.get('/mine',        authenticateJWT, requireRole('BUSINESS_OWNER'), businessesController.getMine);
router.put('/mine',        authenticateJWT, requireRole('BUSINESS_OWNER'), businessesController.updateMine);
router.patch('/mine/logo', authenticateJWT, requireRole('BUSINESS_OWNER'), uploadSettings.single('logo'), businessesController.uploadLogo);
router.put('/mine/photos', authenticateJWT, requireRole('BUSINESS_OWNER'), uploadSettings.array('photos', 5), businessesController.updatePhotos);
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
