"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const services_service_1 = require("../../../src/app/services/services.service");
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
const prisma_1 = require("../../../src/database/prisma");
const mockedPrisma = prisma_1.prisma;
describe('ServicesService', () => {
    let service;
    beforeEach(() => {
        service = new services_service_1.ServicesService();
        jest.clearAllMocks();
    });
    describe('createService', () => {
        it('should create a service with the correct data mapping', async () => {
            const input = { businessId: 'biz-123', name: 'Haircut', durationMinutes: 30, price: 250 };
            const expectedData = { business_id: 'biz-123', name: 'Haircut', duration_minutes: 30, price: 250 };
            const created = { id: 'svc-1', ...expectedData };
            mockedPrisma.service.create.mockResolvedValue(created);
            const result = await service.createService(input);
            expect(mockedPrisma.service.create).toHaveBeenCalledWith({ data: expectedData });
            expect(result).toEqual(created);
        });
        it('should propagate database errors', async () => {
            mockedPrisma.service.create.mockRejectedValue(new Error('DB connection failed'));
            await expect(service.createService({ businessId: 'biz-1', name: 'Test', durationMinutes: 60, price: 100 })).rejects.toThrow('DB connection failed');
        });
    });
    describe('updatePhoto', () => {
        it('should update the photo URL for the given service ID', async () => {
            const updated = { id: 'svc-1', photo_url: 'https://s3.amazonaws.com/photos/new.jpg' };
            mockedPrisma.service.update.mockResolvedValue(updated);
            const result = await service.updatePhoto('svc-1', 'https://s3.amazonaws.com/photos/new.jpg');
            expect(mockedPrisma.service.update).toHaveBeenCalledWith({
                where: { id: 'svc-1' },
                data: { photo_url: 'https://s3.amazonaws.com/photos/new.jpg' },
            });
            expect(result).toEqual(updated);
        });
    });
    describe('getServicesByBusinessId', () => {
        it('should return all services for a given business', async () => {
            const mockServices = [
                { id: 'svc-1', name: 'Haircut', business_id: 'biz-1' },
                { id: 'svc-2', name: 'Shave', business_id: 'biz-1' },
            ];
            mockedPrisma.service.findMany.mockResolvedValue(mockServices);
            const result = await service.getServicesByBusinessId('biz-1');
            expect(mockedPrisma.service.findMany).toHaveBeenCalledWith({ where: { business_id: 'biz-1' } });
            expect(result).toHaveLength(2);
        });
        it('should return an empty array when no services exist', async () => {
            mockedPrisma.service.findMany.mockResolvedValue([]);
            const result = await service.getServicesByBusinessId('biz-empty');
            expect(result).toEqual([]);
        });
    });
    describe('getServiceById', () => {
        it('should return a service with its business relation', async () => {
            const mockService = { id: 'svc-1', name: 'Haircut', business: { id: 'biz-1', owner_id: 'user-1' } };
            mockedPrisma.service.findUnique.mockResolvedValue(mockService);
            const result = await service.getServiceById('svc-1');
            expect(mockedPrisma.service.findUnique).toHaveBeenCalledWith({
                where: { id: 'svc-1' },
                include: { business: true },
            });
            expect(result).toEqual(mockService);
        });
        it('should return null when service is not found', async () => {
            mockedPrisma.service.findUnique.mockResolvedValue(null);
            const result = await service.getServiceById('nonexistent');
            expect(result).toBeNull();
        });
    });
});
