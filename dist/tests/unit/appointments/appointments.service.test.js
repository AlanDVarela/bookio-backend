"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appointments_service_1 = require("../../../src/app/appointments/appointments.service");
// ─── Mock Prisma ────────────────────────────────────────────────────────────
jest.mock('../../../src/database/prisma', () => ({
    prisma: {
        schedule: {
            findUnique: jest.fn(),
        },
        serviceSchedule: {
            findMany: jest.fn(),
        },
        appointment: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        blockedSlot: {
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));
// ─── Mock SNS ───────────────────────────────────────────────────────────────
jest.mock('../../../src/app/middlewares/sns.service', () => ({
    publishEvent: jest.fn().mockResolvedValue(undefined),
}));
const prisma_1 = require("../../../src/database/prisma");
const mockedPrisma = prisma_1.prisma;
// Usamos una fecha en el futuro lejano para evitar el filtro de "slots pasados"
const FUTURE_DATE = '2030-06-15';
describe('AppointmentsService', () => {
    let service;
    beforeEach(() => {
        service = new appointments_service_1.AppointmentsService();
        jest.clearAllMocks();
    });
    // ─── getAvailableSlots ──────────────────────────────────────────────────────
    describe('getAvailableSlots', () => {
        it('should return empty array when no schedule exists for the day', async () => {
            mockedPrisma.schedule.findUnique.mockResolvedValue(null);
            const result = await service.getAvailableSlots('biz-1', FUTURE_DATE, 30);
            expect(result).toEqual([]);
        });
        it('should return available slots when schedule exists and no appointments', async () => {
            mockedPrisma.schedule.findUnique.mockResolvedValue({
                business_id: 'biz-1',
                day_of_week: 1,
                start_time: '09:00',
                end_time: '10:00',
            });
            mockedPrisma.appointment.findMany.mockResolvedValue([]);
            mockedPrisma.blockedSlot.findMany.mockResolvedValue([]);
            const result = await service.getAvailableSlots('biz-1', FUTURE_DATE, 30);
            // 09:00-10:00 with 30-min slots → ["09:00", "09:30"]
            expect(result).toEqual(['09:00', '09:30']);
        });
        it('should exclude overlapping appointment slots', async () => {
            mockedPrisma.schedule.findUnique.mockResolvedValue({
                business_id: 'biz-1',
                day_of_week: 1,
                start_time: '09:00',
                end_time: '10:00',
            });
            // Cita de 09:00 a 09:30
            const apptStart = new Date(FUTURE_DATE);
            apptStart.setUTCHours(9, 0, 0, 0);
            const apptEnd = new Date(FUTURE_DATE);
            apptEnd.setUTCHours(9, 30, 0, 0);
            mockedPrisma.appointment.findMany.mockResolvedValue([
                { start_datetime: apptStart, end_datetime: apptEnd, status: 'CONFIRMED' },
            ]);
            mockedPrisma.blockedSlot.findMany.mockResolvedValue([]);
            const result = await service.getAvailableSlots('biz-1', FUTURE_DATE, 30);
            // Solo 09:30 disponible ya que 09:00 está ocupado
            expect(result).toEqual(['09:30']);
        });
        it('should return empty when full-day block exists', async () => {
            mockedPrisma.schedule.findUnique.mockResolvedValue({
                business_id: 'biz-1',
                day_of_week: 1,
                start_time: '09:00',
                end_time: '17:00',
            });
            mockedPrisma.appointment.findMany.mockResolvedValue([]);
            // Bloqueo de día completo (sin start_time/end_time)
            mockedPrisma.blockedSlot.findMany.mockResolvedValue([
                { business_id: 'biz-1', date: FUTURE_DATE, start_time: null, end_time: null },
            ]);
            const result = await service.getAvailableSlots('biz-1', FUTURE_DATE, 30);
            expect(result).toEqual([]);
        });
        it('should exclude partially blocked slots', async () => {
            mockedPrisma.schedule.findUnique.mockResolvedValue({
                business_id: 'biz-1',
                day_of_week: 1,
                start_time: '09:00',
                end_time: '10:00',
            });
            mockedPrisma.appointment.findMany.mockResolvedValue([]);
            // Bloqueo parcial de 09:00 a 09:30
            mockedPrisma.blockedSlot.findMany.mockResolvedValue([
                { business_id: 'biz-1', date: FUTURE_DATE, start_time: '09:00', end_time: '09:30' },
            ]);
            const result = await service.getAvailableSlots('biz-1', FUTURE_DATE, 30);
            // Solo 09:30 disponible
            expect(result).toEqual(['09:30']);
        });
    });
    // ─── createAppointment ─────────────────────────────────────────────────────
    describe('createAppointment', () => {
        it('should throw error when booking a past slot', async () => {
            await expect(service.createAppointment({
                businessId: 'biz-1',
                clientId: 'client-1',
                serviceId: 'svc-1',
                startDatetime: new Date('2020-01-01T09:00:00Z'),
                endDatetime: new Date('2020-01-01T09:30:00Z'),
            })).rejects.toThrow('Past');
        });
        it('should throw Conflict error when time slot is already booked', async () => {
            mockedPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    appointment: {
                        findFirst: jest.fn().mockResolvedValue({ id: 'existing-apt' }),
                        create: jest.fn(),
                    },
                };
                return callback(tx);
            });
            await expect(service.createAppointment({
                businessId: 'biz-1',
                clientId: 'client-1',
                serviceId: 'svc-1',
                startDatetime: new Date('2030-06-15T09:00:00Z'),
                endDatetime: new Date('2030-06-15T09:30:00Z'),
            })).rejects.toThrow('Conflict');
        });
        it('should create an appointment and publish SNS event when slot is free', async () => {
            const newAppt = {
                id: 'apt-new',
                business_id: 'biz-1',
                client_id: 'client-1',
                service_id: 'svc-1',
                start_datetime: new Date('2030-06-15T09:00:00Z'),
                end_datetime: new Date('2030-06-15T09:30:00Z'),
                status: 'CONFIRMED',
            };
            mockedPrisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    appointment: {
                        findFirst: jest.fn().mockResolvedValue(null),
                        create: jest.fn().mockResolvedValue(newAppt),
                    },
                };
                return callback(tx);
            });
            const { publishEvent } = require('../../../src/app/middlewares/sns.service');
            const result = await service.createAppointment({
                businessId: 'biz-1',
                clientId: 'client-1',
                serviceId: 'svc-1',
                startDatetime: new Date('2030-06-15T09:00:00Z'),
                endDatetime: new Date('2030-06-15T09:30:00Z'),
            });
            expect(result).toEqual(newAppt);
            expect(publishEvent).toHaveBeenCalledWith('AppointmentConfirmed', {
                appointmentId: 'apt-new',
                businessId: 'biz-1',
                clientId: 'client-1',
                startDatetime: new Date('2030-06-15T09:00:00Z'),
            });
        });
    });
    // ─── updateAppointmentStatus ────────────────────────────────────────────────
    describe('updateAppointmentStatus', () => {
        it('should update the appointment status correctly', async () => {
            const updated = { id: 'apt-1', status: 'CANCELLED' };
            mockedPrisma.appointment.update.mockResolvedValue(updated);
            const result = await service.updateAppointmentStatus('apt-1', 'CANCELLED');
            expect(mockedPrisma.appointment.update).toHaveBeenCalledWith({
                where: { id: 'apt-1' },
                data: { status: 'CANCELLED' },
            });
            expect(result).toEqual(updated);
        });
    });
    // ─── deleteAppointment ──────────────────────────────────────────────────────
    describe('deleteAppointment', () => {
        it('should delete the appointment by ID', async () => {
            mockedPrisma.appointment.delete.mockResolvedValue({ id: 'apt-1' });
            const result = await service.deleteAppointment('apt-1');
            expect(mockedPrisma.appointment.delete).toHaveBeenCalledWith({
                where: { id: 'apt-1' },
            });
            expect(result).toEqual({ id: 'apt-1' });
        });
    });
});
