import { prisma } from '../../database/prisma';

export class ServicesService {
  public async createService(data: {
    businessId: string;
    name: string;
    durationMinutes: number;
    price: number;
  }) {
    return prisma.service.create({
      data: {
        business_id: data.businessId,
        name: data.name,
        duration_minutes: data.durationMinutes,
        price: data.price,
      },
    });
  }

  public async updatePhoto(serviceId: string, photoUrl: string) {
    return prisma.service.update({
      where: { id: serviceId },
      data: { photo_url: photoUrl },
    });
  }

  public async getServicesByBusinessId(businessId: string) {
    return prisma.service.findMany({
      where: { business_id: businessId },
    });
  }

  public async getServiceById(serviceId: string) {
    return prisma.service.findUnique({
      where: { id: serviceId },
      include: { business: true }
    });
  }

  public async updateService(id: string, data: {
    name?: string;
    durationMinutes?: number;
    price?: number;
  }) {
    return prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        duration_minutes: data.durationMinutes,
        price: data.price,
      },
    });
  }
}
