"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsController = void 0;
const appointments_service_1 = require("./appointments.service");
const prisma_1 = require("../../database/prisma");
const appointmentsService = new appointments_service_1.AppointmentsService();
class AppointmentsController {
    //Obtener citas en un dia disponibles
    async getAvailableSlots(req, res) {
        try {
            const { businessId, dateStr, serviceDuration, serviceId } = req.query;
            if (!businessId || !dateStr || !serviceDuration) {
                return res.status(400).json({ error: 'Missing required query parameters' });
            }
            const slots = await appointmentsService.getAvailableSlots(businessId, dateStr, parseInt(serviceDuration, 10), serviceId);
            return res.status(200).json({ availableSlots: slots });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // Crear cita
    async bookAppointment(req, res) {
        try {
            const clientId = req.user?.id;
            if (!clientId) {
                return res.status(401).json({ error: 'Unauthorized: missing user ID' });
            }
            const { businessId, serviceId, startDatetime } = req.body;
            const service = await prisma_1.prisma.service.findUnique({ where: { id: serviceId } });
            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }
            const startObj = new Date(startDatetime);
            const endObj = new Date(startObj.getTime() + service.duration_minutes * 60000);
            const appointment = await appointmentsService.createAppointment({
                businessId,
                clientId,
                serviceId,
                startDatetime: startObj,
                endDatetime: endObj,
            });
            return res.status(201).json({ message: 'Appointment booked successfully', appointment });
        }
        catch (error) {
            console.error(error);
            if (error.message?.includes('Conflict')) {
                return res.status(409).json({ error: error.message });
            }
            if (error.message?.includes('Past')) {
                return res.status(400).json({ error: 'No puedes reservar en un horario que ya pasó.' });
            }
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // Crear cita manual (Solo para dueños)
    async bookManualAppointment(req, res) {
        try {
            // Idealmente, se valida con un middleware que req.user.role === 'BUSINESS_OWNER'
            const { businessId, serviceId, startDatetime, clientName, clientPhone } = req.body;
            if (!clientName) {
                return res.status(400).json({ error: 'clientName is required for manual appointments' });
            }
            const service = await prisma_1.prisma.service.findUnique({ where: { id: serviceId } });
            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }
            const startObj = new Date(startDatetime);
            const endObj = new Date(startObj.getTime() + service.duration_minutes * 60000);
            const appointment = await appointmentsService.createManualAppointment({
                businessId,
                serviceId,
                startDatetime: startObj,
                endDatetime: endObj,
                clientName,
                clientPhone,
            });
            return res.status(201).json({ message: 'Manual appointment booked successfully', appointment });
        }
        catch (error) {
            console.error(error);
            if (error.message?.includes('Conflict')) {
                return res.status(409).json({ error: error.message });
            }
            if (error.message?.includes('Past')) {
                return res.status(400).json({ error: 'No puedes reservar en un horario que ya pasó.' });
            }
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // Obtener todas las citas
    async getAll(req, res) {
        try {
            const { businessId, clientId, status } = req.query; // status: 'upcoming' | 'past' | 'cancelled'
            const where = {};
            if (businessId)
                where.business_id = businessId;
            if (clientId)
                where.client_id = clientId;
            const now = new Date();
            if (status === 'upcoming') {
                where.start_datetime = { gte: now };
                where.status = { not: 'CANCELLED' };
            }
            else if (status === 'past') {
                where.start_datetime = { lt: now };
                where.status = { not: 'CANCELLED' };
            }
            else if (status === 'cancelled') {
                where.status = 'CANCELLED';
            }
            const appointments = await prisma_1.prisma.appointment.findMany({
                where,
                orderBy: { start_datetime: 'asc' },
                include: {
                    client: true,
                    service: true,
                    business: true,
                }
            });
            res.status(200).json({ appointments });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // Actualizar cita 
    async updateStatus(req, res) {
        try {
            const id = req.params.id;
            const { status } = req.body; // PENDING | CONFIRMED | CANCELLED
            const appointment = await appointmentsService.updateAppointmentStatus(id, status);
            res.status(200).json({ message: 'Status updated', appointment });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // Borrar cita
    async deleteAppointment(req, res) {
        try {
            const id = req.params.id;
            await appointmentsService.deleteAppointment(id);
            res.status(200).json({ message: 'Appointment deleted successfully' });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
exports.AppointmentsController = AppointmentsController;
