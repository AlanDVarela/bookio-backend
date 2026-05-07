"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesService = void 0;
const prisma_1 = require("../../database/prisma");
class SchedulesService {
    async createSchedule(data) {
        return prisma_1.prisma.schedule.create({
            data: {
                business_id: data.businessId,
                day_of_week: data.dayOfWeek,
                start_time: data.startTime,
                end_time: data.endTime,
            },
        });
    }
}
exports.SchedulesService = SchedulesService;
