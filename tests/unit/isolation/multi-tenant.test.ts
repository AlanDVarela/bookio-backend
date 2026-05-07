/**
 * Pruebas de Aislamiento Multi-Tenant
 *
 * Validan que el sistema filtre correctamente por business_id,
 * asegurando que los datos de un tenant (negocio) nunca se mezclen
 * con los de otro en las consultas a RDS.
 */

import { ServicesService } from '../../../src/app/services/services.service';
import { AppointmentsService } from '../../../src/app/appointments/appointments.service';

// ─── Mock Prisma ────────────────────────────────────────────────────────────
jest.mock('../../../src/database/prisma', () => ({
  prisma: {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    schedule: {
      findUnique: jest.fn(),
    },
    serviceSchedule: {
      findMany: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    blockedSlot: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/services/queue.service', () => ({
  publishAppointmentEvent: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../src/database/prisma';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Datos mock para 2 tenants distintos ────────────────────────────────────
const TENANT_A = 'business-aaa-111';
const TENANT_B = 'business-bbb-222';
const FUTURE_DATE = '2030-06-15';

const servicesForTenantA = [
  { id: 'svc-a1', name: 'Corte de Cabello', business_id: TENANT_A, price: 200 },
  { id: 'svc-a2', name: 'Barba', business_id: TENANT_A, price: 100 },
];

const servicesForTenantB = [
  { id: 'svc-b1', name: 'Masaje Relajante', business_id: TENANT_B, price: 500 },
];

describe('Multi-Tenant Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── ServicesService: Filtrado por business_id ────────────────────────────
  describe('ServicesService — getServicesByBusinessId', () => {
    const servicesService = new ServicesService();

    it('should only return services belonging to Tenant A', async () => {
      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue(servicesForTenantA);

      const result = await servicesService.getServicesByBusinessId(TENANT_A);

      expect(mockedPrisma.service.findMany).toHaveBeenCalledWith({
        where: { business_id: TENANT_A },
      });

      result.forEach((svc: any) => {
        expect(svc.business_id).toBe(TENANT_A);
      });

      expect(result).toHaveLength(2);
    });

    it('should only return services belonging to Tenant B', async () => {
      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue(servicesForTenantB);

      const result = await servicesService.getServicesByBusinessId(TENANT_B);

      expect(mockedPrisma.service.findMany).toHaveBeenCalledWith({
        where: { business_id: TENANT_B },
      });

      result.forEach((svc: any) => {
        expect(svc.business_id).toBe(TENANT_B);
      });

      expect(result).toHaveLength(1);
    });

    it('should NOT return Tenant B services when querying Tenant A', async () => {
      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue(servicesForTenantA);

      const result = await servicesService.getServicesByBusinessId(TENANT_A);

      const hasTenantBData = result.some((svc: any) => svc.business_id === TENANT_B);
      expect(hasTenantBData).toBe(false);
    });
  });

  // ─── AppointmentsService: Slots filtrados por business_id ─────────────────
  describe('AppointmentsService — getAvailableSlots tenant isolation', () => {
    const appointmentsService = new AppointmentsService();

    it('should query schedule only for the specified business_id', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue(null);

      await appointmentsService.getAvailableSlots(TENANT_A, FUTURE_DATE, 30);

      expect(mockedPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: {
          business_id_day_of_week: {
            business_id: TENANT_A,
            day_of_week: expect.any(Number),
          },
        },
      });
    });

    it('should query appointments and blockedSlots only for the specified business_id', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue({
        business_id: TENANT_A,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
      });

      (mockedPrisma.appointment.findMany as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.blockedSlot.findMany as jest.Mock).mockResolvedValue([]);

      await appointmentsService.getAvailableSlots(TENANT_A, FUTURE_DATE, 30);

      // Verificar que las citas se filtran por business_id
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: TENANT_A,
          }),
        })
      );

      // Verificar que los bloqueos se filtran por business_id
      expect(mockedPrisma.blockedSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: TENANT_A,
          }),
        })
      );
    });

    it('should NOT leak schedule data from Tenant B when querying Tenant A', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue(null);

      const slotsA = await appointmentsService.getAvailableSlots(TENANT_A, FUTURE_DATE, 30);

      expect(slotsA).toEqual([]);

      const calls = (mockedPrisma.schedule.findUnique as jest.Mock).mock.calls;
      calls.forEach((call) => {
        const businessId = call[0].where.business_id_day_of_week.business_id;
        expect(businessId).not.toBe(TENANT_B);
      });
    });
  });

  // ─── ServicesService: getServiceById verifica ownership ───────────────────
  describe('ServicesService — getServiceById cross-tenant', () => {
    const servicesService = new ServicesService();

    it('should include business relation to enable ownership verification', async () => {
      const serviceWithBusiness = {
        id: 'svc-a1',
        name: 'Corte',
        business_id: TENANT_A,
        business: { id: TENANT_A, owner_id: 'owner-tenant-a' },
      };

      (mockedPrisma.service.findUnique as jest.Mock).mockResolvedValue(serviceWithBusiness);

      const result = await servicesService.getServiceById('svc-a1');

      expect(mockedPrisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-a1' },
        include: { business: true },
      });

      expect(result?.business.owner_id).toBe('owner-tenant-a');
    });
  });
});
