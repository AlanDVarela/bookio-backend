import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { BusinessesService } from './businesses.service';
import { prisma } from '../../database/prisma';
import { AppointmentsService } from '../appointments/appointments.service';

const businessesService = new BusinessesService();
const appointmentsService = new AppointmentsService();

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

  public async getRecommended(req: Request, res: Response) {
    try {
      const payload = await businessesService.getAllBusinesses({ limit: 5 });
      res.status(200).json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const { month, year } = req.query;

      await appointmentsService.autoUpdateStatuses();

      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const now = new Date();
      const targetMonth = month ? parseInt(month as string, 10) - 1 : now.getMonth();
      const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      // 1. Total Appointments & Cancellations (Filtered Period)
      const [totalAppointments, cancellations] = await Promise.all([
        prisma.appointment.count({
          where: { business_id: business.id, start_datetime: { gte: startDate, lte: endDate } }
        }),
        prisma.appointment.count({
          where: { business_id: business.id, start_datetime: { gte: startDate, lte: endDate }, status: 'CANCELLED' }
        })
      ]);

      // 2. Revenue & Popular Services
      const appointments = await prisma.appointment.findMany({
        where: { business_id: business.id, start_datetime: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
        include: { service: true }
      });

      const totalRevenue = appointments.reduce((sum, a) => sum + Number(a.service.price), 0);
      
      const serviceCounts: Record<string, { name: string, count: number }> = {};
      appointments.forEach(a => {
        const s = a.service;
        if (!serviceCounts[s.id]) serviceCounts[s.id] = { name: s.name, count: 0 };
        serviceCounts[s.id].count++;
      });
      const popularServices = Object.values(serviceCounts).sort((a, b) => b.count - a.count).slice(0, 5);

      // 3. New Clients
      const clients = await prisma.appointment.groupBy({
        by: ['client_id'],
        where: { business_id: business.id, start_datetime: { gte: startDate, lte: endDate } },
        _count: { client_id: true }
      });
      const newClients = clients.length;

      // 4. Weekly Performance (Current Week: Sunday to Saturday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
      startOfWeek.setHours(0,0,0,0);

      const weekAppointments = await prisma.appointment.findMany({
        where: { business_id: business.id, start_datetime: { gte: startOfWeek } }
      });
      console.log(`[Metrics] Appointments found for week: ${weekAppointments.length}`);
      weekAppointments.forEach(a => console.log(` - Appt: ${a.id}, Date: ${a.start_datetime.toISOString()}`));

      const weeklyPerformance = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        
        const count = weekAppointments.filter(a => {
          const ad = new Date(a.start_datetime);
          // Compare only year, month, date to be timezone-robust
          return ad.getFullYear() === date.getFullYear() && 
                 ad.getMonth() === date.getMonth() && 
                 ad.getDate() === date.getDate();
        }).length;
        
        weeklyPerformance.push({ day: date.getDay(), count });
      }

      console.log(`[Metrics] Data served for business ${business.id} - Period: ${targetMonth + 1}/${targetYear}`);

      res.status(200).json({
        metrics: {
          totalAppointments,
          totalRevenue,
          newClients,
          cancellations,
          weeklyPerformance,
          popularServices,
          version: '2.0'
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getReservations(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const { date } = req.query; 
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      let dateFilter = {};
      if (date) {
        const startOfDay = new Date(date as string);
        const endOfDay = new Date(date as string);
        endOfDay.setDate(endOfDay.getDate() + 1);
        dateFilter = {
          start_datetime: {
            gte: startOfDay,
            lt: endOfDay
          }
        };
      }

      const reservations = await prisma.appointment.findMany({
        where: {
          business_id: business.id,
          ...dateFilter
        },
        include: { client: true, service: true }
      });

      res.status(200).json({ reservations });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getMine(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({
        where: { owner_id: ownerId },
        include: { 
          services: { orderBy: { createdAt: 'asc' } },
          owner: { select: { phone: true, name: true, email: true } }
        },
      });
      if (!business) return res.status(404).json({ error: 'Business not found' });
      
      return res.status(200).json({ 
        business: {
          ...business,
          phone: business.owner.phone
        } 
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const business = await businessesService.getBusinessById(id);

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      const fullBusiness = await prisma.business.findUnique({
        where: { id },
        include: { owner: { select: { phone: true } } }
      });

      res.status(200).json({ 
        business: {
          ...business,
          phone: fullBusiness?.owner?.phone
        } 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getBusinessServices(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const services = await prisma.service.findMany({ where: { business_id: id } });
      res.status(200).json({ services });
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

  public async updateMine(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      const { name, type, address, phone, latitude, longitude } = req.body;

      if (phone !== undefined) {
        await prisma.user.update({
          where: { id: ownerId },
          data: { phone }
        });
      }

      const updated = await businessesService.updateBusiness(business.id, {
        name,
        type,
        address,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });

      return res.status(200).json({ 
        message: 'Business updated successfully', 
        business: {
          ...updated,
          phone: phone || req.user?.phone
        } 
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async uploadLogo(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      
      if (!business) return res.status(404).json({ error: 'Business not found' });
      if (!req.file) return res.status(400).json({ error: 'No logo provided' });

      const { uploadBusinessPhoto } = require('../middlewares/s3.service');
      const logoUrl = await uploadBusinessPhoto(req.file.buffer, req.file.mimetype);

      const updated = await prisma.business.update({
        where: { id: business.id },
        data: { logo_url: logoUrl }
      });

      return res.status(200).json({ message: 'Logo updated', logo_url: updated.logo_url });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error uploading logo' });
    }
  }

  public async updatePhotos(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      
      if (!business) return res.status(404).json({ error: 'Business not found' });

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No photos provided' });
      }

      const { uploadBusinessPhoto } = require('../middlewares/s3.service');
      
      const photoUrls: string[] = [];
      for (const file of req.files) {
        const url = await uploadBusinessPhoto(file.buffer, file.mimetype);
        photoUrls.push(url);
      }

      // Replace the entire array
      const updated = await prisma.business.update({
        where: { id: business.id },
        data: {
          photos: photoUrls
        }
      });

      return res.status(200).json({ message: 'Photos updated', photos: updated.photos });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error updating photos' });
    }
  }
}
