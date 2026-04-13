import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { SchedulesService } from './schedules.service';

const schedulesService = new SchedulesService();

export class SchedulesController {
  public async createSchedule(req: AuthenticatedRequest, res: Response) {
    try {
      const { businessId, dayOfWeek, startTime, endTime } = req.body;
      const ownerId = req.user?.id;

      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business || business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Not the owner of this business' });
      }

      const schedule = await schedulesService.createSchedule({
        businessId,
        dayOfWeek,
        startTime,
        endTime,
      });

      return res.status(201).json({ schedule });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
