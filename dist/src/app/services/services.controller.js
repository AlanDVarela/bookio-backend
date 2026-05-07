"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesController = void 0;
const prisma_1 = require("../../database/prisma");
const services_service_1 = require("./services.service");
const servicesService = new services_service_1.ServicesService();
//Servicio y rutas para business
class ServicesController {
    async getOwnServices(req, res) {
        try {
            const ownerId = req.user?.id;
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business) {
                return res.status(404).json({ error: 'Business not found for this owner' });
            }
            const services = await servicesService.getServicesByBusinessId(business.id);
            return res.status(200).json({ services });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async createService(req, res) {
        try {
            const { name, durationMinutes, price } = req.body;
            const ownerId = req.user?.id;
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business) {
                return res.status(404).json({ error: 'Business not found for this owner' });
            }
            const service = await servicesService.createService({
                businessId: business.id,
                name,
                durationMinutes,
                price,
            });
            return res.status(201).json({ service });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async getServiceSchedule(req, res) {
        try {
            const id = req.params.id;
            const ownerId = req.user?.id;
            const service = await prisma_1.prisma.service.findUnique({ where: { id }, include: { business: true } });
            if (!service || service.business.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const schedules = await prisma_1.prisma.serviceSchedule.findMany({
                where: { service_id: id },
                orderBy: { day_of_week: 'asc' },
            });
            return res.status(200).json({ schedules });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async upsertServiceScheduleDay(req, res) {
        try {
            const id = req.params.id;
            const { dayOfWeek, startTime, endTime } = req.body;
            const ownerId = req.user?.id;
            const service = await prisma_1.prisma.service.findUnique({ where: { id }, include: { business: true } });
            if (!service || service.business.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const schedule = await prisma_1.prisma.serviceSchedule.upsert({
                where: { service_id_day_of_week: { service_id: id, day_of_week: dayOfWeek } },
                create: { service_id: id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime },
                update: { start_time: startTime, end_time: endTime },
            });
            return res.status(200).json({ schedule });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async removeServiceScheduleDay(req, res) {
        try {
            const { id, dayId } = req.params;
            const ownerId = req.user?.id;
            const serviceSchedule = await prisma_1.prisma.serviceSchedule.findUnique({ where: { id: dayId } });
            if (!serviceSchedule || serviceSchedule.service_id !== id) {
                return res.status(404).json({ error: 'Not found' });
            }
            const service = await prisma_1.prisma.service.findUnique({ where: { id }, include: { business: true } });
            if (!service || service.business.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await prisma_1.prisma.serviceSchedule.delete({ where: { id: dayId } });
            return res.status(200).json({ message: 'Removed' });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async uploadPhoto(req, res) {
        try {
            const id = req.params.id;
            const ownerId = req.user?.id;
            const service = await servicesService.getServiceById(id);
            if (!service || service.business.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }
            const { uploadServicePhoto } = require('../middlewares/s3.service');
            const photoUrl = await uploadServicePhoto(req.file.buffer, req.file.mimetype);
            const updated = await servicesService.updatePhoto(id, photoUrl);
            return res.status(200).json({ message: 'Service photo updated correctly', photo_url: updated.photo_url });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error uploading service photo' });
        }
    }
    async updateService(req, res) {
        try {
            const id = req.params.id;
            const ownerId = req.user?.id;
            const { name, durationMinutes, price } = req.body;
            const service = await servicesService.getServiceById(id);
            if (!service || service.business.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const updated = await servicesService.updateService(id, {
                name,
                durationMinutes,
                price,
            });
            return res.status(200).json({ message: 'Service updated successfully', service: updated });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
exports.ServicesController = ServicesController;
