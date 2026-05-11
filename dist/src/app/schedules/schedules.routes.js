"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schedules_controller_1 = require("./schedules.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const controller = new schedules_controller_1.SchedulesController();
const auth = [auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER')];
// Ruta pública — debe ir antes de las rutas con auth
router.get('/business/:businessId', controller.getByBusiness);
router.get('/', ...auth, controller.getMine);
router.put('/', ...auth, controller.upsertDay);
router.delete('/:id', ...auth, controller.removeDay);
router.post('/blocked', ...auth, controller.addBlockedSlot);
router.delete('/blocked/:id', ...auth, controller.removeBlockedSlot);
exports.default = router;
