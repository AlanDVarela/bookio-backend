import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ReviewsService } from './reviews.service';

const reviewsService = new ReviewsService();

export class ReviewsController {
  public async createReview(req: AuthenticatedRequest, res: Response) {
    try {
      const clientId = req.user?.id;
      if (!clientId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { appointmentId, score, comment } = req.body;

      // Validate appointment exists and belongs to client
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (appointment.client_id !== clientId) {
        return res.status(403).json({ error: 'You can only review your own appointments' });
      }

      // Ensure a review isn't already created
      const existingReview = await prisma.review.findUnique({
        where: { appointment_id: appointmentId }
      });

      if (existingReview) {
        return res.status(400).json({ error: 'Review already exists for this appointment' });
      }

      const { review, business } = await reviewsService.createReview({
        clientId,
        businessId: appointment.business_id,
        appointmentId,
        score: parseInt(score),
        comment
      });

      return res.status(201).json({ 
        message: 'Review successfully submitted', 
        review,
        business 
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error submitting review' });
    }
  }

  public async getMyReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const clientId = req.user?.id;
      const reviews = await prisma.review.findMany({
        where: { client_id: clientId },
        include: {
          business: { select: { id: true, name: true, logo_url: true } },
          appointment: { select: { start_datetime: true, service: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ reviews });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getReviewByAppointment(req: AuthenticatedRequest, res: Response) {
    try {
      const clientId = req.user?.id;
      const appointmentId = req.params.appointmentId as string;
      const review = await prisma.review.findFirst({
        where: { appointment_id: appointmentId, client_id: clientId },
      });
      return res.status(200).json({ review: review ?? null });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getBusinessReviews(req: Request, res: Response) {
    try {
      const businessId = req.params.businessId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const reviews = await reviewsService.getReviewsByBusiness(businessId, limit);
      return res.status(200).json({ reviews });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error fetching reviews' });
    }
  }

  public async updateReview(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const clientId = req.user?.id;
      const { score, comment } = req.body;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      if (review.client_id !== clientId) return res.status(403).json({ error: 'Forbidden' });

      const updated = await prisma.review.update({
        where: { id },
        data: {
          ...(score !== undefined && { score: parseInt(score) }),
          ...(comment !== undefined && { comment }),
        },
      });

      return res.status(200).json({ message: 'Review updated successfully', review: updated });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async deleteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const clientId = req.user?.id;

      const review = await prisma.review.findUnique({ where: { id } });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      if (review.client_id !== clientId) return res.status(403).json({ error: 'Forbidden' });

      await prisma.review.delete({ where: { id } });
      return res.status(200).json({ message: 'Review deleted successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
