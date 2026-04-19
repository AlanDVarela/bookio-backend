import { AppointmentsService } from '../../../src/app/appointments/appointments.service';

// ─── Mock Prisma ────────────────────────────────────────────────────────────
jest.mock('../../../src/database/prisma', () => ({
  prisma: {
    schedule: {
      findUnique: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      $transaction: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// ─── Mock SNS ───────────────────────────────────────────────────────────────
jest.mock('../../../src/app/middlewares/sns.service', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../src/database/prisma';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  beforeEach(() => {
    service = new AppointmentsService();
    jest.clearAllMocks();
  });

  // ─── getAvailableSlots ──────────────────────────────────────────────────────
  describe('getAvailableSlots', () => {
    it('should return empty array when no schedule exists for the day', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getAvailableSlots('biz-1', '2026-04-20', 30);

      expect(result).toEqual([]);
    });

    it('should return available slots when schedule exists and no appointments', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue({
        business_id: 'biz-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:00',
      });

      (mockedPrisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz-1', '2026-04-20', 30);

      // 09:00-10:00 with 30-min slots → ["09:00", "09:30"]
      expect(result).toEqual(['09:00', '09:30']);
    });

    it('should exclude overlapping appointment slots', async () => {
      const targetDate = new Date('2026-04-20');

      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue({
        business_id: 'biz-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '10:00',
      });

      // Appointment from 09:00 to 09:30
      const apptStart = new Date('2026-04-20');
      apptStart.setUTCHours(9, 0, 0, 0);
      const apptEnd = new Date('2026-04-20');
      apptEnd.setUTCHours(9, 30, 0, 0);

      (mockedPrisma.appointment.findMany as jest.Mock).mockResolvedValue([
        {
          start_datetime: apptStart,
          end_datetime: apptEnd,
          status: 'CONFIRMED',
        },
      ]);

      const result = await service.getAvailableSlots('biz-1', '2026-04-20', 30);

      // Only 09:30 should be available since 09:00 is taken
      expect(result).toEqual(['09:30']);
    });
  });

  // ─── updateAppointmentStatus ────────────────────────────────────────────────
  describe('updateAppointmentStatus', () => {
    it('should update the appointment status correctly', async () => {
      const updated = { id: 'apt-1', status: 'CANCELLED' };
      (mockedPrisma.appointment.update as jest.Mock).mockResolvedValue(updated);

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
      (mockedPrisma.appointment.delete as jest.Mock).mockResolvedValue({ id: 'apt-1' });

      const result = await service.deleteAppointment('apt-1');

      expect(mockedPrisma.appointment.delete).toHaveBeenCalledWith({
        where: { id: 'apt-1' },
      });
      expect(result).toEqual({ id: 'apt-1' });
    });
  });

  // ─── createAppointment ─────────────────────────────────────────────────────
  describe('createAppointment', () => {
    it('should throw Conflict error when time slot is already booked', async () => {
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          appointment: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing-apt' }),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        service.createAppointment({
          businessId: 'biz-1',
          clientId: 'client-1',
          serviceId: 'svc-1',
          startDatetime: new Date('2026-04-20T09:00:00Z'),
          endDatetime: new Date('2026-04-20T09:30:00Z'),
        })
      ).rejects.toThrow('Conflict');
    });

    it('should create an appointment and publish SNS event when slot is free', async () => {
      const newAppt = {
        id: 'apt-new',
        business_id: 'biz-1',
        client_id: 'client-1',
        service_id: 'svc-1',
        start_datetime: new Date('2026-04-20T09:00:00Z'),
        end_datetime: new Date('2026-04-20T09:30:00Z'),
        status: 'CONFIRMED',
      };

      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
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
        startDatetime: new Date('2026-04-20T09:00:00Z'),
        endDatetime: new Date('2026-04-20T09:30:00Z'),
      });

      expect(result).toEqual(newAppt);
      expect(publishEvent).toHaveBeenCalledWith('AppointmentConfirmed', {
        appointmentId: 'apt-new',
        businessId: 'biz-1',
        clientId: 'client-1',
        startDatetime: new Date('2026-04-20T09:00:00Z'),
      });
    });
  });
});
