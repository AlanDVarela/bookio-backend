import { prisma } from '../../database/prisma';

export class SchedulesService {
  public async createSchedule(data: {
    businessId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) {
    return prisma.schedule.create({
      data: {
        business_id: data.businessId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
      },
    });
  }
}
