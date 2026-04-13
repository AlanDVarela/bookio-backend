import { prisma } from '../../database/prisma';

export class ReviewsService {
  public async createReview(data: {
    clientId: string;
    businessId: string;
    appointmentId: string;
    score: number;
    comment?: string;
  }) {
    // We use a transaction to create the review and update the business average rating
    return prisma.$transaction(async (tx) => {
      // 1. Create the review
      const review = await tx.review.create({
        data: {
          client_id: data.clientId,
          business_id: data.businessId,
          appointment_id: data.appointmentId,
          score: data.score,
          comment: data.comment,
        },
      });

      // 2. Aggregate the averages
      const aggregations = await tx.review.aggregate({
        where: { business_id: data.businessId },
        _avg: { score: true },
        _count: { id: true },
      });

      const averageRating = aggregations._avg.score || 0;
      const reviewCount = aggregations._count.id || 0;

      // 3. Update the business stats
      await tx.business.update({
        where: { id: data.businessId },
        data: {
          average_rating: averageRating,
          review_count: reviewCount,
        },
      });

      return review;
    });
  }

  public async getReviewsByBusiness(businessId: string, limit: number = 10) {
    return prisma.review.findMany({
      where: { business_id: businessId },
      include: {
        client: { select: { name: true, avatar_url: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
