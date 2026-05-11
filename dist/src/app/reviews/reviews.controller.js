"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsController = void 0;
const prisma_1 = require("../../database/prisma");
const reviews_service_1 = require("./reviews.service");
const reviewsService = new reviews_service_1.ReviewsService();
class ReviewsController {
    async createReview(req, res) {
        try {
            const clientId = req.user?.id;
            if (!clientId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { appointmentId, score, comment } = req.body;
            // Validate appointment exists and belongs to client
            const appointment = await prisma_1.prisma.appointment.findUnique({
                where: { id: appointmentId },
            });
            if (!appointment) {
                return res.status(404).json({ error: 'Appointment not found' });
            }
            if (appointment.client_id !== clientId) {
                return res.status(403).json({ error: 'You can only review your own appointments' });
            }
            // Ensure a review isn't already created
            const existingReview = await prisma_1.prisma.review.findUnique({
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
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error submitting review' });
        }
    }
    async getBusinessReviews(req, res) {
        try {
            const businessId = req.params.businessId;
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const reviews = await reviewsService.getReviewsByBusiness(businessId, limit);
            return res.status(200).json({ reviews });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error fetching reviews' });
        }
    }
}
exports.ReviewsController = ReviewsController;
