import { prisma } from '../../database/prisma';
import { uploadBusinessLogo } from '../middlewares/s3.service';

export class BusinessesService {
  public async registerBusiness(data: {
    ownerId: string;
    name: string;
    type: 'BARBERSHOP' | 'SPA' | 'SALON' | 'OTHER';
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
    type?: 'BARBERSHOP' | 'SPA' | 'SALON' | 'OTHER';
    ratingGte?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.ratingGte) where.average_rating = { gte: filters.ratingGte };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const limit = filters.limit || 10;
    const page = filters.page || 1;
    const skip = Number((page - 1) * limit);

    const [total, businesses] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        skip,
        take: Number(limit),
        include: { owner: { select: { name: true, email: true } } },
        orderBy: { average_rating: 'desc' }
      })
    ]);

    return {
      data: businesses,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public async getBusinessById(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: {
        services: true,
        schedules: true,
      },
    });
  }
}
