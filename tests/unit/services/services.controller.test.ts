import { ServicesController } from '../../../src/app/services/services.controller';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../../src/app/middlewares/auth.middleware';

jest.mock('../../../src/database/prisma', () => ({
  prisma: { business: { findFirst: jest.fn() } },
}));

jest.mock('../../../src/app/services/services.service', () => ({
  ServicesService: jest.fn().mockImplementation(() => ({
    getServicesByBusinessId: jest.fn(),
    createService: jest.fn(),
    getServiceById: jest.fn(),
    updatePhoto: jest.fn(),
  })),
}));

import { prisma } from '../../../src/database/prisma';
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

function mockReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    user: { id: 'owner-1', role: 'BUSINESS_OWNER' as const },
    body: {}, params: {}, query: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(() => {
    controller = new ServicesController();
    jest.clearAllMocks();
  });

  describe('getOwnServices', () => {
    it('should return 404 when the user has no business', async () => {
      (mockedPrisma.business.findFirst as jest.Mock).mockResolvedValue(null);
      const req = mockReq();
      const res = mockRes();
      await controller.getOwnServices(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on unexpected errors', async () => {
      (mockedPrisma.business.findFirst as jest.Mock).mockRejectedValue(new Error('DB crash'));
      const req = mockReq();
      const res = mockRes();
      await controller.getOwnServices(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createService', () => {
    it('should return 404 when the owner has no business', async () => {
      (mockedPrisma.business.findFirst as jest.Mock).mockResolvedValue(null);
      const req = mockReq({ body: { name: 'Haircut', durationMinutes: 30, price: 200 } } as any);
      const res = mockRes();
      await controller.createService(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 500 on unexpected errors', async () => {
      (mockedPrisma.business.findFirst as jest.Mock).mockRejectedValue(new Error('fail'));
      const req = mockReq({ body: { name: 'Haircut', durationMinutes: 30, price: 200 } } as any);
      const res = mockRes();
      await controller.createService(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
