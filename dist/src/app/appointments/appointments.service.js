"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsService = void 0;
const prisma_1 = require("../../database/prisma");
const queue_service_1 = require("../../services/queue.service");
class AppointmentsService {
    /**
     * Obtiene los slots disponibles para un negocio en una fecha dada basado en sus Schedules y citas existentes.
     */
    async getAvailableSlots(businessId, dateStr, serviceDurationMinutes, serviceId) {
        const targetDate = new Date(dateStr);
        const dayOfWeek = targetDate.getUTCDay();
        const schedule = await prisma_1.prisma.schedule.findUnique({
            where: {
                business_id_day_of_week: {
                    business_id: businessId,
                    day_of_week: dayOfWeek,
                },
            },
        });
        if (!schedule)
            return [];
        // Calcular ventana efectiva: intersección entre horario del negocio y horario del servicio
        let effectiveStart = schedule.start_time;
        let effectiveEnd = schedule.end_time;
        if (serviceId) {
            const serviceSchedules = await prisma_1.prisma.serviceSchedule.findMany({
                where: { service_id: serviceId },
            });
            if (serviceSchedules.length > 0) {
                const serviceDay = serviceSchedules.find((s) => s.day_of_week === dayOfWeek);
                if (!serviceDay)
                    return []; // Servicio no disponible este día
                // max(business.start, service.start)
                effectiveStart = serviceDay.start_time > schedule.start_time ? serviceDay.start_time : schedule.start_time;
                // min(business.end, service.end)
                effectiveEnd = serviceDay.end_time < schedule.end_time ? serviceDay.end_time : schedule.end_time;
                if (effectiveStart >= effectiveEnd)
                    return [];
            }
            // Si el servicio no tiene entradas, hereda el horario completo del negocio
        }
        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const [appointments, blockedSlots] = await Promise.all([
            prisma_1.prisma.appointment.findMany({
                where: {
                    business_id: businessId,
                    status: { in: ['CONFIRMED', 'PENDING'] },
                    start_datetime: { gte: startOfDay, lt: endOfDay },
                },
                orderBy: { start_datetime: 'asc' },
            }),
            prisma_1.prisma.blockedSlot.findMany({
                where: { business_id: businessId, date: dateStr },
            }),
        ]);
        // Si hay un bloqueo de día completo, no hay slots disponibles
        if (blockedSlots.some((b) => !b.start_time || !b.end_time))
            return [];
        const availableSlots = [];
        const [startHour, startMinute] = effectiveStart.split(':').map(Number);
        const [endHour, endMinute] = effectiveEnd.split(':').map(Number);
        let currentSlotTime = new Date(targetDate);
        currentSlotTime.setUTCHours(startHour, startMinute, 0, 0);
        const endWorkingTime = new Date(targetDate);
        endWorkingTime.setUTCHours(endHour, endMinute, 0, 0);
        const now = new Date();
        while (currentSlotTime < endWorkingTime) {
            const slotEnd = new Date(currentSlotTime.getTime() + serviceDurationMinutes * 60000);
            if (slotEnd > endWorkingTime)
                break;
            // Omitir slots que ya pasaron (incluso si es hoy)
            if (slotEnd <= now) {
                currentSlotTime = new Date(currentSlotTime.getTime() + serviceDurationMinutes * 60000);
                continue;
            }
            const isOverlapping = appointments.some((appt) => (currentSlotTime < appt.end_datetime && slotEnd > appt.start_datetime));
            // Verificar bloqueos parciales de horario
            const isBlocked = blockedSlots.some((b) => {
                if (!b.start_time || !b.end_time)
                    return false; // día completo ya manejado arriba
                const [bsh, bsm] = b.start_time.split(':').map(Number);
                const [beh, bem] = b.end_time.split(':').map(Number);
                const blockStart = new Date(targetDate);
                blockStart.setUTCHours(bsh, bsm, 0, 0);
                const blockEnd = new Date(targetDate);
                blockEnd.setUTCHours(beh, bem, 0, 0);
                return currentSlotTime < blockEnd && slotEnd > blockStart;
            });
            if (!isOverlapping && !isBlocked) {
                availableSlots.push(`${currentSlotTime.getUTCHours().toString().padStart(2, '0')}:${currentSlotTime.getUTCMinutes().toString().padStart(2, '0')}`);
            }
            currentSlotTime = new Date(currentSlotTime.getTime() + serviceDurationMinutes * 60000);
        }
        return availableSlots;
    }
    /**
     * Crea una reservación utilizando Transacciones ACID para evitar el Overbooking.
     */
    async createAppointment(data) {
        if (data.startDatetime <= new Date()) {
            throw new Error('Past: Cannot book a slot that has already passed.');
        }
        const appointment = await prisma_1.prisma.$transaction(async (tx) => {
            const overlapping = await tx.appointment.findFirst({
                where: {
                    business_id: data.businessId,
                    status: { in: ['CONFIRMED', 'PENDING'] },
                    OR: [
                        {
                            start_datetime: { lt: data.endDatetime },
                            end_datetime: { gt: data.startDatetime },
                        },
                    ],
                },
            });
            if (overlapping) {
                throw new Error('Conflict: Time slot is already booked.');
            }
            return tx.appointment.create({
                data: {
                    business_id: data.businessId,
                    client_id: data.clientId,
                    service_id: data.serviceId,
                    start_datetime: data.startDatetime,
                    end_datetime: data.endDatetime,
                    status: 'CONFIRMED',
                },
            });
        });
        // Query separada para el correo (fuera de la transacción)
        const forEmail = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointment.id },
            select: {
                start_datetime: true,
                client: { select: { name: true, email: true } },
                business: { select: { name: true } },
                service: { select: { name: true } },
            },
        });
        if (forEmail?.client?.email) {
            await (0, queue_service_1.publishAppointmentEvent)({
                appointmentId: appointment.id,
                to: forEmail.client.email,
                clientName: forEmail.client.name,
                businessName: forEmail.business.name,
                serviceName: forEmail.service.name,
                datetime: forEmail.start_datetime.toISOString(),
                status: 'CONFIRMED',
            });
        }
        return appointment;
    }
    /**
     * Crea una reservación manual (Walk-in) sin asociarla a un usuario registrado de Firebase.
     */
    async createManualAppointment(data) {
        if (data.startDatetime <= new Date()) {
            throw new Error('Past: Cannot book a slot that has already passed.');
        }
        const appointment = await prisma_1.prisma.$transaction(async (tx) => {
            const overlapping = await tx.appointment.findFirst({
                where: {
                    business_id: data.businessId,
                    status: { in: ['CONFIRMED', 'PENDING'] },
                    OR: [
                        {
                            start_datetime: { lt: data.endDatetime },
                            end_datetime: { gt: data.startDatetime },
                        },
                    ],
                },
            });
            if (overlapping) {
                throw new Error('Conflict: Time slot is already booked.');
            }
            const newAppointment = await tx.appointment.create({
                data: {
                    business_id: data.businessId,
                    client_name: data.clientName,
                    client_phone: data.clientPhone,
                    service_id: data.serviceId,
                    start_datetime: data.startDatetime,
                    end_datetime: data.endDatetime,
                    status: 'CONFIRMED',
                },
            });
            return newAppointment;
        });
        return appointment;
    }
    /**
     * Auto-completa las citas que ya pasaron su tiempo de término y estaban en curso.
     */
    async autoUpdateStatuses() {
        const now = new Date();
        await prisma_1.prisma.appointment.updateMany({
            where: {
                status: 'IN_PROGRESS',
                end_datetime: { lt: now }
            },
            data: { status: 'COMPLETED' }
        });
    }
    async getAppointmentsByFilter(filters) {
        await this.autoUpdateStatuses();
        const whereClause = {};
        if (filters.businessId)
            whereClause.business_id = filters.businessId;
        if (filters.clientId)
            whereClause.client_id = filters.clientId;
        return prisma_1.prisma.appointment.findMany({
            where: whereClause,
            include: {
                service: true,
                client: { select: { id: true, name: true, email: true } },
            },
            orderBy: { start_datetime: 'desc' },
        });
    }
    async updateAppointmentStatus(id, status) {
        const appointment = await prisma_1.prisma.appointment.update({
            where: { id },
            data: { status },
        });
        if (status === 'CANCELLED') {
            const forEmail = await prisma_1.prisma.appointment.findUnique({
                where: { id },
                select: {
                    start_datetime: true,
                    client: { select: { name: true, email: true } },
                    business: { select: { name: true } },
                    service: { select: { name: true } },
                },
            });
            if (forEmail?.client?.email) {
                await (0, queue_service_1.publishAppointmentEvent)({
                    appointmentId: appointment.id,
                    to: forEmail.client.email,
                    clientName: forEmail.client.name,
                    businessName: forEmail.business.name,
                    serviceName: forEmail.service.name,
                    datetime: forEmail.start_datetime.toISOString(),
                    status: 'CANCELLED',
                });
            }
        }
        return appointment;
    }
    async deleteAppointment(id) {
        return prisma_1.prisma.appointment.delete({
            where: { id },
        });
    }
}
exports.AppointmentsService = AppointmentsService;
