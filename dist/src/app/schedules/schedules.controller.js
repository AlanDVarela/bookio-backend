"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesController = void 0;
const prisma_1 = require("../../database/prisma");
class SchedulesController {
    // GET /schedules/business/:businessId — horario público de un negocio
    async getByBusiness(req, res) {
        try {
            const businessId = req.params.businessId;
            // LOG 1: Verificar si el ID llega correctamente desde la URL
            console.log("--- Debug Schedules ---");
            console.log("Buscando para Business ID:", businessId);
            const [schedules, blockedSlots] = await Promise.all([
                prisma_1.prisma.schedule.findMany({
                    where: { business_id: businessId },
                    orderBy: { day_of_week: 'asc' },
                }),
                prisma_1.prisma.blockedSlot.findMany({
                    where: { business_id: businessId },
                    orderBy: { date: 'asc' },
                }),
            ]);
            // LOG 2: Verificar qué devolvió la base de datos
            console.log("Horarios encontrados:", schedules.length);
            console.log("Bloqueos encontrados:", blockedSlots.length);
            console.log("-----------------------");
            return res.status(200).json({ schedules, blockedSlots });
        }
        catch (error) {
            // LOG 3: Ver el error real si algo explota
            console.error("ERROR en getByBusiness:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // GET /schedules — horario semanal + bloqueos del negocio autenticado
    async getMine(req, res) {
        try {
            const ownerId = req.user?.id;
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business)
                return res.status(404).json({ error: 'Business not found' });
            const [schedules, blockedSlots] = await Promise.all([
                prisma_1.prisma.schedule.findMany({
                    where: { business_id: business.id },
                    orderBy: { day_of_week: 'asc' },
                }),
                prisma_1.prisma.blockedSlot.findMany({
                    where: { business_id: business.id },
                    orderBy: { date: 'asc' },
                }),
            ]);
            return res.status(200).json({ schedules, blockedSlots });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // PUT /schedules — upsert de un día (crea o actualiza)
    async upsertDay(req, res) {
        try {
            const { dayOfWeek, startTime, endTime } = req.body;
            const ownerId = req.user?.id;
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business)
                return res.status(404).json({ error: 'Business not found' });
            const schedule = await prisma_1.prisma.schedule.upsert({
                where: {
                    business_id_day_of_week: {
                        business_id: business.id,
                        day_of_week: dayOfWeek,
                    },
                },
                create: {
                    business_id: business.id,
                    day_of_week: dayOfWeek,
                    start_time: startTime,
                    end_time: endTime,
                },
                update: { start_time: startTime, end_time: endTime },
            });
            return res.status(200).json({ schedule });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // DELETE /schedules/:id — elimina un día (cerrado ese día)
    async removeDay(req, res) {
        try {
            const id = req.params.id;
            const ownerId = req.user?.id;
            const schedule = await prisma_1.prisma.schedule.findUnique({ where: { id } });
            if (!schedule)
                return res.status(404).json({ error: 'Schedule not found' });
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business || schedule.business_id !== business.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await prisma_1.prisma.schedule.delete({ where: { id } });
            return res.status(200).json({ message: 'Day removed' });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // POST /schedules/blocked — crear bloqueo
    async addBlockedSlot(req, res) {
        try {
            const { date, startTime, endTime, reason } = req.body;
            const ownerId = req.user?.id;
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business)
                return res.status(404).json({ error: 'Business not found' });
            const blockedSlot = await prisma_1.prisma.blockedSlot.create({
                data: {
                    business_id: business.id,
                    date: date,
                    start_time: startTime || null,
                    end_time: endTime || null,
                    reason: reason || null,
                },
            });
            return res.status(201).json({ blockedSlot });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    // DELETE /schedules/blocked/:id — eliminar bloqueo
    async removeBlockedSlot(req, res) {
        try {
            const id = req.params.id;
            const ownerId = req.user?.id;
            const slot = await prisma_1.prisma.blockedSlot.findUnique({ where: { id } });
            if (!slot)
                return res.status(404).json({ error: 'Blocked slot not found' });
            const business = await prisma_1.prisma.business.findFirst({ where: { owner_id: ownerId } });
            if (!business || slot.business_id !== business.id) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await prisma_1.prisma.blockedSlot.delete({ where: { id } });
            return res.status(200).json({ message: 'Blocked slot removed' });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
exports.SchedulesController = SchedulesController;
