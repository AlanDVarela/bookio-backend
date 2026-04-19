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

  // Frontend: GET /businesses/recommended
  public async getRecommended(req: Request, res: Response) {
    try {
      // Mocked up logic: return the top 5 businesses by rating
      const payload = await businessesService.getAllBusinesses({ limit: 5 });
      res.status(200).json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Frontend: GET /businesses/metrics
  public async getMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const { prisma } = require('../../database/prisma');

      const business = await prisma.business.findFirst({ where: { owner_id: ownerId } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const now = new Date();

      // Semana actual (lunes a domingo)
      const dow = now.getDay();
      const mondayOffset = dow === 0 ? 6 : dow - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - mondayOffset);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday   = new Date(startOfToday.getTime() + 86400000);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const [todayCount, weekAppointments, monthAppointments, schedules] = await Promise.all([
        prisma.appointment.count({
          where: {
            business_id: business.id,
            status: { not: 'CANCELLED' },
            start_datetime: { gte: startOfToday, lt: endOfToday },
          },
        }),
        prisma.appointment.findMany({
          where: {
            business_id: business.id,
            status: { not: 'CANCELLED' },
            start_datetime: { gte: startOfWeek, lt: endOfWeek },
          },
          include: { service: true },
        }),
        prisma.appointment.findMany({
          where: {
            business_id: business.id,
            status: { not: 'CANCELLED' },
            start_datetime: { gte: startOfMonth, lte: endOfMonth },
          },
          include: { service: true },
        }),
        prisma.schedule.findMany({ where: { business_id: business.id } }),
      ]);

      // Ingresos
      const weekRevenue  = weekAppointments.reduce((s: number, a: any)  => s + Number(a.service.price), 0);
      const monthRevenue = monthAppointments.reduce((s: number, a: any) => s + Number(a.service.price), 0);

      // Tasa de ocupación: minutos reservados / minutos disponibles esta semana
      const scheduleMap: Record<number, { start: string; end: string }> = {};
      schedules.forEach((s: any) => {
        scheduleMap[s.day_of_week] = { start: s.start_time, end: s.end_time };
      });

      let availableMinutes = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const d = scheduleMap[day.getDay()];
        if (d) {
          const [sh, sm] = d.start.split(':').map(Number);
          const [eh, em] = d.end.split(':').map(Number);
          availableMinutes += (eh * 60 + em) - (sh * 60 + sm);
        }
      }
      const bookedMinutes = weekAppointments.reduce((s: number, a: any) => s + a.service.duration_minutes, 0);
      const occupancyRate = availableMinutes > 0 ? Math.round((bookedMinutes / availableMinutes) * 100) : 0;

      // Gráfica semanal (Lun–Dom)
      const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const weekDowCounts: Record<number, number> = {};
      weekAppointments.forEach((a: any) => {
        const d = new Date(a.start_datetime).getDay();
        weekDowCounts[d] = (weekDowCounts[d] || 0) + 1;
      });
      const weekChart = [1, 2, 3, 4, 5, 6, 0].map((d, i) => ({
        label: DAY_LABELS[i],
        value: weekDowCounts[d] || 0,
      }));

      // Gráfica mensual (S1–S4)
      const monthWeekCounts: Record<number, number> = {};
      monthAppointments.forEach((a: any) => {
        const date = new Date(a.start_datetime);
        const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        const weekNum  = Math.ceil((date.getDate() + firstDow) / 7);
        monthWeekCounts[weekNum] = (monthWeekCounts[weekNum] || 0) + 1;
      });
      const monthChart = [1, 2, 3, 4].map((w) => ({
        label: `S${w}`,
        value: monthWeekCounts[w] || 0,
      }));

      res.status(200).json({
        metrics: {
          todayAppointments: todayCount,
          weekAppointments:  weekAppointments.length,
          monthRevenue,
          occupancyRate,
          chart:    { week: weekChart, month: monthChart },
          overview: {
            week:  { totalReservations: weekAppointments.length,  revenue: weekRevenue },
            month: { totalReservations: monthAppointments.length, revenue: monthRevenue },
          },
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Frontend: GET /business/reservations (por fecha)
  public async getReservations(req: AuthenticatedRequest, res: Response) {
    try {
      const ownerId = req.user?.id;
      const { date } = req.query; // Expecting date string 
      const { prisma } = require('../../database/prisma');
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
      const { prisma } = require('../../database/prisma');
      const business = await prisma.business.findFirst({
        where: { owner_id: ownerId },
        include: { services: { orderBy: { createdAt: 'asc' } } },
      });
      if (!business) return res.status(404).json({ error: 'Business not found' });
      return res.status(200).json({ business });
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

      res.status(200).json({ business });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getBusinessServices(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { prisma } = require('../../database/prisma');
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
