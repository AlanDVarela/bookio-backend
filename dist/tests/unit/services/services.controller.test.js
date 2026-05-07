"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const services_controller_1 = require("../../../src/app/services/services.controller");
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
const prisma_1 = require("../../../src/database/prisma");
const mockedPrisma = prisma_1.prisma;
function mockReq(overrides = {}) {
    return {
        user: { id: 'owner-1', role: 'BUSINESS_OWNER' },
        body: {}, params: {}, query: {},
        ...overrides,
    };
}
function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe('ServicesController', () => {
    let controller;
    beforeEach(() => {
        controller = new services_controller_1.ServicesController();
        jest.clearAllMocks();
    });
    describe('getOwnServices', () => {
        it('should return 404 when the user has no business', async () => {
            mockedPrisma.business.findFirst.mockResolvedValue(null);
            const req = mockReq();
            const res = mockRes();
            await controller.getOwnServices(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
        it('should return 500 on unexpected errors', async () => {
            mockedPrisma.business.findFirst.mockRejectedValue(new Error('DB crash'));
            const req = mockReq();
            const res = mockRes();
            await controller.getOwnServices(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
    describe('createService', () => {
        it('should return 404 when the owner has no business', async () => {
            mockedPrisma.business.findFirst.mockResolvedValue(null);
            const req = mockReq({ body: { name: 'Haircut', durationMinutes: 30, price: 200 } });
            const res = mockRes();
            await controller.createService(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });
        it('should return 500 on unexpected errors', async () => {
            mockedPrisma.business.findFirst.mockRejectedValue(new Error('fail'));
            const req = mockReq({ body: { name: 'Haircut', durationMinutes: 30, price: 200 } });
            const res = mockRes();
            await controller.createService(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
