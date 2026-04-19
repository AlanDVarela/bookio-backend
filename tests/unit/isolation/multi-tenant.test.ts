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
    appointment: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/app/middlewares/sns.service', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../src/database/prisma';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Datos mock para 2 tenants distintos ────────────────────────────────────
const TENANT_A = 'business-aaa-111';
const TENANT_B = 'business-bbb-222';

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

      // Verifica que Prisma fue llamado con el filtro correcto
      expect(mockedPrisma.service.findMany).toHaveBeenCalledWith({
        where: { business_id: TENANT_A },
      });

      // Verifica que TODOS los resultados pertenecen al tenant correcto
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
      // Simular que Prisma correctmente filtra — solo retorna Tenant A
      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue(servicesForTenantA);

      const result = await servicesService.getServicesByBusinessId(TENANT_A);

      // Verificar que ningún servicio de Tenant B aparece en los resultados
      const hasTenantBData = result.some((svc: any) => svc.business_id === TENANT_B);
      expect(hasTenantBData).toBe(false);
    });
  });

  // ─── AppointmentsService: Slots filtrados por business_id ─────────────────
  describe('AppointmentsService — getAvailableSlots tenant isolation', () => {
    const appointmentsService = new AppointmentsService();

    it('should query schedule only for the specified business_id', async () => {
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue(null);

      await appointmentsService.getAvailableSlots(TENANT_A, '2026-04-20', 30);

      // Verificar que el filtro incluye el business_id correcto
      expect(mockedPrisma.schedule.findUnique).toHaveBeenCalledWith({
        where: {
          business_id_day_of_week: {
            business_id: TENANT_A,
            day_of_week: expect.any(Number),
          },
        },
      });
    });

    it('should query appointments only for the specified business_id', async () => {
      // Schedule existe para este tenant
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue({
        business_id: TENANT_A,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
      });

      (mockedPrisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

      await appointmentsService.getAvailableSlots(TENANT_A, '2026-04-20', 30);

      // Verificar que las citas se filtran por business_id
      expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: TENANT_A,
          }),
        })
      );
    });

    it('should NOT leak schedule data from Tenant B when querying Tenant A', async () => {
      // Tenant A no tiene schedule para ese día
      (mockedPrisma.schedule.findUnique as jest.Mock).mockResolvedValue(null);

      const slotsA = await appointmentsService.getAvailableSlots(TENANT_A, '2026-04-20', 30);

      // Sin schedule, no debe retornar slots
      expect(slotsA).toEqual([]);

      // Verificar que NO se consultó el schedule de Tenant B
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

      // Verifica que incluye la relación business para validar ownership
      expect(mockedPrisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-a1' },
        include: { business: true },
      });

      // Verifica que el owner pertenece al tenant correcto
      expect(result?.business.owner_id).toBe('owner-tenant-a');
    });
  });
});
