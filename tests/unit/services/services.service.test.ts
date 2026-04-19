import { ServicesService } from '../../../src/app/services/services.service';

// ─── Mock Prisma ────────────────────────────────────────────────────────────
jest.mock('../../../src/database/prisma', () => ({
  prisma: {
    service: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../../../src/database/prisma';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(() => {
    service = new ServicesService();
    jest.clearAllMocks();
  });

  // ─── createService ──────────────────────────────────────────────────────────
  describe('createService', () => {
    it('should create a service with the correct data mapping', async () => {
      const input = {
        businessId: 'biz-123',
        name: 'Haircut',
        durationMinutes: 30,
        price: 250,
      };

      const expectedPrismaData = {
        business_id: 'biz-123',
        name: 'Haircut',
        duration_minutes: 30,
        price: 250,
      };

      const createdService = { id: 'svc-1', ...expectedPrismaData };

      (mockedPrisma.service.create as jest.Mock).mockResolvedValue(createdService);

      const result = await service.createService(input);

      expect(mockedPrisma.service.create).toHaveBeenCalledWith({
        data: expectedPrismaData,
      });
      expect(result).toEqual(createdService);
    });

    it('should propagate database errors', async () => {
      (mockedPrisma.service.create as jest.Mock).mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(
        service.createService({
          businessId: 'biz-1',
          name: 'Test',
          durationMinutes: 60,
          price: 100,
        })
      ).rejects.toThrow('DB connection failed');
    });
  });

  // ─── updatePhoto ────────────────────────────────────────────────────────────
  describe('updatePhoto', () => {
    it('should update the photo URL for the given service ID', async () => {
      const updatedService = {
        id: 'svc-1',
        photo_url: 'https://s3.amazonaws.com/photos/new.jpg',
      };

      (mockedPrisma.service.update as jest.Mock).mockResolvedValue(updatedService);

      const result = await service.updatePhoto('svc-1', 'https://s3.amazonaws.com/photos/new.jpg');

      expect(mockedPrisma.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: { photo_url: 'https://s3.amazonaws.com/photos/new.jpg' },
      });
      expect(result).toEqual(updatedService);
    });
  });

  // ─── getServicesByBusinessId ────────────────────────────────────────────────
  describe('getServicesByBusinessId', () => {
    it('should return all services for a given business', async () => {
      const mockServices = [
        { id: 'svc-1', name: 'Haircut', business_id: 'biz-1' },
        { id: 'svc-2', name: 'Shave', business_id: 'biz-1' },
      ];

      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);

      const result = await service.getServicesByBusinessId('biz-1');

      expect(mockedPrisma.service.findMany).toHaveBeenCalledWith({
        where: { business_id: 'biz-1' },
      });
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockServices);
    });

    it('should return an empty array when no services exist', async () => {
      (mockedPrisma.service.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getServicesByBusinessId('biz-empty');

      expect(result).toEqual([]);
    });
  });

  // ─── getServiceById ─────────────────────────────────────────────────────────
  describe('getServiceById', () => {
    it('should return a service with its business relation', async () => {
      const mockService = {
        id: 'svc-1',
        name: 'Haircut',
        business: { id: 'biz-1', owner_id: 'user-1' },
      };

      (mockedPrisma.service.findUnique as jest.Mock).mockResolvedValue(mockService);

      const result = await service.getServiceById('svc-1');

      expect(mockedPrisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        include: { business: true },
      });
      expect(result).toEqual(mockService);
    });

    it('should return null when service is not found', async () => {
      (mockedPrisma.service.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getServiceById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
