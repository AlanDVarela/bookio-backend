import { Response } from 'express';
import { prisma } from '../../database/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class SchedulesController {

  // GET /schedules — horario semanal + bloqueos del negocio autenticado
  public async getMine(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const [schedules, blockedSlots] = await Promise.all([
        prisma.schedule.findMany({
          where: { business_id: business.id },
          orderBy: { day_of_week: 'asc' },
        }),
        prisma.blockedSlot.findMany({
          where: { business_id: business.id },
          orderBy: { date: 'asc' },
        }),
      ]);

      return res.status(200).json({ schedules, blockedSlots });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // PUT /schedules — upsert de un día (crea o actualiza)
  public async upsertDay(req: AuthenticatedRequest, res: Response) {
    try {
      const { dayOfWeek, startTime, endTime } = req.body;
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const schedule = await prisma.schedule.upsert({
        where: {
          business_id_day_of_week: {
            business_id: business.id,
            day_of_week: dayOfWeek,
          },
        },
        create: {
          business_id: business.id,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
        },
        update: { start_time: startTime, end_time: endTime },
      });

      return res.status(200).json({ schedule });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // DELETE /schedules/:id — elimina un día (cerrado ese día)
  public async removeDay(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;
      const schedule = await prisma.schedule.findUnique({ where: { id } });
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business || schedule.business_id !== business.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.schedule.delete({ where: { id } });
      return res.status(200).json({ message: 'Day removed' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // POST /schedules/blocked — crear bloqueo
  public async addBlockedSlot(req: AuthenticatedRequest, res: Response) {
    try {
      const { date, startTime, endTime, reason } = req.body;
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const blockedSlot = await prisma.blockedSlot.create({
        data: {
          business_id: business.id,
          date:       date       as string,
          start_time: (startTime as string) || null,
          end_time:   (endTime   as string) || null,
          reason:     (reason    as string) || null,
        },
      });

      return res.status(201).json({ blockedSlot });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // DELETE /schedules/blocked/:id — eliminar bloqueo
  public async removeBlockedSlot(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;
      const slot = await prisma.blockedSlot.findUnique({ where: { id } });
      if (!slot) return res.status(404).json({ error: 'Blocked slot not found' });

      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business || slot.business_id !== business.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.blockedSlot.delete({ where: { id } });
      return res.status(200).json({ message: 'Blocked slot removed' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
