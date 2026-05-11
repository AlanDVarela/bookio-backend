import { prisma } from '../../database/prisma';

export class ReviewsService {
  /**
   * Crea una reseña y actualiza las estadísticas del negocio (rating y contador)
   * de forma atómica usando una transacción de base de datos.
   */
  public async createReview(data: {
    clientId: string;
    businessId: string;
    appointmentId: string;
    score: number;
    comment?: string;
  }) {
    // 1. Usamos una transacción para asegurar la consistencia entre la reseña y el negocio
    const result = await prisma.$transaction(async (tx) => {
      
      // Crear la reseña vinculada a la cita, cliente y negocio
      const newReview = await tx.review.create({
        data: {
          client_id: data.clientId,
          business_id: data.businessId,
          appointment_id: data.appointmentId,
          score: data.score,
          comment: data.comment,
        },
      });

      // 2. Recalcular las estadísticas globales del negocio
      // Obtenemos el promedio del campo 'score' y el conteo total de IDs
      const aggregations = await tx.review.aggregate({
        where: { business_id: data.businessId },
        _avg: { score: true },
        _count: { id: true },
      });

      const averageRating = aggregations._avg.score || 0;
      const reviewCount = aggregations._count.id || 0;

      // 3. Actualizar el registro del Negocio con los nuevos valores
      const updatedBusiness = await tx.business.update({
        where: { id: data.businessId },
        data: {
          average_rating: averageRating,
          review_count: reviewCount,
        },
      });

      return { review: newReview, business: updatedBusiness };
    });

    return result;
  }

  /**
   * Obtiene las reseñas de un negocio con información del cliente
   */
  public async getReviewsByBusiness(businessId: string, limit: number = 10) {
    return prisma.review.findMany({
      where: { business_id: businessId },
      include: {
        client: { 
          select: { 
            name: true, 
            avatar_url: true 
          } 
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
