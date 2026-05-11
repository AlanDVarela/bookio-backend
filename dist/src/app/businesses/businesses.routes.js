"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businesses_controller_1 = require("./businesses.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
const businessesController = new businesses_controller_1.BusinessesController();
//Rutas publicas
router.get('/recommended', businessesController.getRecommended);
router.get('/', businessesController.getAll);
//Rutas privadas Business_Owner
router.get('/mine', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), businessesController.getMine);
router.put('/mine', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), businessesController.updateMine);
router.patch('/mine/logo', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), upload_middleware_1.uploadSettings.single('logo'), businessesController.uploadLogo);
router.put('/mine/photos', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), upload_middleware_1.uploadSettings.array('photos', 5), businessesController.updatePhotos);
router.get('/metrics', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), businessesController.getMetrics);
router.get('/reservations', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), businessesController.getReservations);
router.get('/:id', businessesController.getById);
router.get('/:id/services', businessesController.getBusinessServices);
router.post('/', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), upload_middleware_1.uploadSettings.single('logo'), businessesController.registerBusiness);
router.post('/:id/photos', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), upload_middleware_1.uploadSettings.array('photos', 5), businessesController.uploadPhotos);
exports.default = router;
