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
}
