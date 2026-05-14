import { prisma } from '../../database/prisma';
import { uploadBusinessLogo } from '../middlewares/s3.service';
import { BusinessType } from '@prisma/client';

export class BusinessesService {
  public async registerBusiness(data: {
    ownerId: string;
    name: string;
    type: BusinessType;
    address: string;
    latitude?: number;
    longitude?: number;
    logoBuffer?: Buffer;
    logoMimeType?: string;
  }) {
    let logoUrl = null;

    if (data.logoBuffer && data.logoMimeType) {
      logoUrl = await uploadBusinessLogo(data.logoBuffer, data.logoMimeType);
    }

    return prisma.business.create({
      data: {
        owner_id: data.ownerId,
        name: data.name,
        type: data.type,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        logo_url: logoUrl,
      },
    });
  }

  public async getAllBusinesses(filters: {
    type?: string; // Lo recibimos como string para validarlo nosotros
    ratingGte?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const where: any = {};

      // 1. Validación de ENUM (Evita el error P2007 de Prisma)
      if (filters.type) {
        const upperType = filters.type.toUpperCase();
        // Verificamos si el valor existe en el ENUM generado por Prisma
        if (Object.values(BusinessType).includes(upperType as BusinessType)) {
          where.type = upperType as BusinessType;
        } else {
          // Si el tipo no es válido (ej. "MEDICAL"), ignoramos el filtro 
          // o podrías retornar un arreglo vacío directamente.
          console.warn(`[Bookio Warning]: Tipo de negocio inválido recibido: ${upperType}`);
        }
      }

      // 2. Validación de Rating (Evita valores astronómicos o negativos)
      if (filters.ratingGte !== undefined) {
        const rating = Math.max(0, Math.min(5, filters.ratingGte));
        where.average_rating = { gte: rating };
      }

      // 3. Búsqueda de texto (Protección contra strings vacíos)
      if (filters.search && filters.search.trim().length > 0) {
        const searchClean = filters.search.trim();
        where.OR = [
          { name: { contains: searchClean, mode: 'insensitive' } },
          { address: { contains: searchClean, mode: 'insensitive' } }
        ];
      }

      // 4. Paginación Segura (Evita skip negativo)
      const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10)); // Max 100 por seguridad
      const page = Math.max(1, Number(filters.page) || 1);
      const skip = (page - 1) * limit;

      // 5. Ejecución con manejo de concurrencia
      const [total, businesses] = await Promise.all([
        prisma.business.count({ where }),
        prisma.business.findMany({
          where,
          skip,
          take: limit,
          include: { 
            owner: { 
              select: { name: true, email: true } 
            } 
          },
          orderBy: { average_rating: 'desc' }
        })
      ]);

      return {
        data: businesses || [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      };

    } catch (error) {
      // Log detallado para desarrollo en ITESO
      console.error("[Bookio Database Error]:", error);
      
      // Error amigable para el frontend
      throw new Error("Error al recuperar los negocios. Por favor, verifica los filtros.");
    }
  }

  public async getBusinessById(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: true,
        schedules: true,
        blockedSlots: {
          where: { start_time: null }, // solo bloqueos de día completo
          select: { date: true },
        },
      },
    });
  }

  public async updateBusiness(id: string, data: {
    name?: string;
    type?: BusinessType;
    address?: string;
    latitude?: number;
    longitude?: number;
    photos?: string[];
  }) {
    return prisma.business.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        photos: data.photos,
      },
    });
  }
}
