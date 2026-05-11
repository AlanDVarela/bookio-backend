"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointments_controller_1 = require("./appointments.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const appointmentsController = new appointments_controller_1.AppointmentsController();
// Slots public logic
router.get('/slots', appointmentsController.getAvailableSlots);
// Full CRUD
router.get('/', auth_middleware_1.authenticateJWT, appointmentsController.getAll);
router.post('/', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('CLIENT'), appointmentsController.bookAppointment);
router.post('/manual', auth_middleware_1.authenticateJWT, (0, auth_middleware_1.requireRole)('BUSINESS_OWNER'), appointmentsController.bookManualAppointment);
router.put('/:id/status', auth_middleware_1.authenticateJWT, appointmentsController.updateStatus);
router.delete('/:id', auth_middleware_1.authenticateJWT, appointmentsController.deleteAppointment);
exports.default = router;
