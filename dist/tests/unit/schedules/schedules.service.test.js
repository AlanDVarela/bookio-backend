"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schedules_service_1 = require("../../../src/app/schedules/schedules.service");
jest.mock('../../../src/database/prisma', () => ({
    prisma: { schedule: { create: jest.fn() } },
}));
const prisma_1 = require("../../../src/database/prisma");
const mockedPrisma = prisma_1.prisma;
describe('SchedulesService', () => {
    let service;
    beforeEach(() => {
        service = new schedules_service_1.SchedulesService();
        jest.clearAllMocks();
    });
    describe('createSchedule', () => {
        it('should create a schedule with the correct data mapping', async () => {
            const input = { businessId: 'biz-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' };
            const expectedData = { business_id: 'biz-1', day_of_week: 1, start_time: '09:00', end_time: '17:00' };
            const created = { id: 'sch-1', ...expectedData };
            mockedPrisma.schedule.create.mockResolvedValue(created);
            const result = await service.createSchedule(input);
            expect(mockedPrisma.schedule.create).toHaveBeenCalledWith({ data: expectedData });
            expect(result).toEqual(created);
        });
        it('should propagate database errors', async () => {
            mockedPrisma.schedule.create.mockRejectedValue(new Error('Unique constraint violation'));
            await expect(service.createSchedule({ businessId: 'biz-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })).rejects.toThrow('Unique constraint violation');
        });
    });
});
