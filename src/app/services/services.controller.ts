import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ServicesService } from './services.service';

const servicesService = new ServicesService();

//Servicio y rutas para business
export class ServicesController {
  public async getOwnServices(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) {
        return res.status(404).json({ error: 'Business not found for this owner' });
      }

      const services = await servicesService.getServicesByBusinessId(business.id);
      return res.status(200).json({ services });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async createService(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, durationMinutes, price } = req.body;
      const ownerId = req.user?.id;

      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) {
        return res.status(404).json({ error: 'Business not found for this owner' });
      }

      const service = await servicesService.createService({
        businessId: business.id,
        name,
        durationMinutes,
        price,
      });

      return res.status(201).json({ service });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getServiceSchedule(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;
      const service = await prisma.service.findUnique({ where: { id }, include: { business: true } });
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const schedules = await prisma.serviceSchedule.findMany({
        where: { service_id: id },
        orderBy: { day_of_week: 'asc' },
      });
      return res.status(200).json({ schedules });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async upsertServiceScheduleDay(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { dayOfWeek, startTime, endTime } = req.body;
      const ownerId = req.user?.id;
      const service = await prisma.service.findUnique({ where: { id }, include: { business: true } });
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const schedule = await prisma.serviceSchedule.upsert({
        where: { service_id_day_of_week: { service_id: id, day_of_week: dayOfWeek } },
        create: { service_id: id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime },
        update: { start_time: startTime, end_time: endTime },
      });
      return res.status(200).json({ schedule });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async removeServiceScheduleDay(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, dayId } = req.params as { id: string; dayId: string };
      const ownerId = req.user?.id;
      const serviceSchedule = await prisma.serviceSchedule.findUnique({ where: { id: dayId } });
      if (!serviceSchedule || serviceSchedule.service_id !== id) {
        return res.status(404).json({ error: 'Not found' });
      }
      const service = await prisma.service.findUnique({ where: { id }, include: { business: true } });
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await prisma.serviceSchedule.delete({ where: { id: dayId } });
      return res.status(200).json({ message: 'Removed' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async uploadPhoto(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;

      const service = await servicesService.getServiceById(id);
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const { uploadServicePhoto } = require('../middlewares/s3.service');
      const photoUrl = await uploadServicePhoto(req.file.buffer, req.file.mimetype);

      const updated = await servicesService.updatePhoto(id, photoUrl);
      return res.status(200).json({ message: 'Service photo updated correctly', photo_url: updated.photo_url });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error uploading service photo' });
    }
  }

  public async deleteService(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;

      const service = await servicesService.getServiceById(id);
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.service.delete({ where: { id } });
      return res.status(200).json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async updateService(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;
      const { name, durationMinutes, price } = req.body;

      const service = await servicesService.getServiceById(id);
      if (!service || service.business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updated = await servicesService.updateService(id, {
        name,
        durationMinutes,
        price,
      });

      return res.status(200).json({ message: 'Service updated successfully', service: updated });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
