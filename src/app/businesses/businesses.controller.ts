import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { BusinessesService } from './businesses.service';

const businessesService = new BusinessesService();

export class BusinessesController {
  public async registerBusiness(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      if (!ownerId) {
        return res.status(401).json({ error: 'Unauthorized: missing user ID' });
      }

      const { name, type, address, latitude, longitude } = req.body;

      let logoBuffer: Buffer | undefined = undefined;
      let logoMimeType: string | undefined = undefined;

      if (req.file) {
        logoBuffer = req.file.buffer;
        logoMimeType = req.file.mimetype;
      }

      const business = await businessesService.registerBusiness({
        ownerId,
        name,
        type,
        address,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        logoBuffer,
        logoMimeType
      });

      return res.status(201).json({ message: 'Business created successfully', business });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getAll(req: Request, res: Response) {
    try {
      const { type, ratingGte, search, page, limit } = req.query;
      
      const payload = await businessesService.getAllBusinesses({
        type: type as any,
        ratingGte: ratingGte ? parseFloat(ratingGte as string) : undefined,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });
      res.status(200).json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const business = await businessesService.getBusinessById(id);

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      res.status(200).json({ business });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async uploadPhotos(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const ownerId = req.user?.id;

      const business = await businessesService.getBusinessById(id);
      if (!business || business.owner_id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No photos provided' });
      }

      const { uploadBusinessPhoto } = require('../middlewares/s3.service');
      
      const photoUrls: string[] = [];
      for (const file of req.files) {
        const url = await uploadBusinessPhoto(file.buffer, file.mimetype);
        photoUrls.push(url);
      }

      // Append to postgres array
      const { prisma } = require('../../database/prisma');
      const updated = await prisma.business.update({
        where: { id },
        data: {
          photos: { push: photoUrls }
        }
      });

      return res.status(200).json({ message: 'Photos uploaded', photos: updated.photos });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error uploading photos' });
    }
  }
}
