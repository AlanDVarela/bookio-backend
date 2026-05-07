"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const prisma_1 = require("../../database/prisma");
class ServicesService {
    async createService(data) {
        return prisma_1.prisma.service.create({
            data: {
                business_id: data.businessId,
                name: data.name,
                duration_minutes: data.durationMinutes,
                price: data.price,
            },
        });
    }
    async updatePhoto(serviceId, photoUrl) {
        return prisma_1.prisma.service.update({
            where: { id: serviceId },
            data: { photo_url: photoUrl },
        });
    }
    async getServicesByBusinessId(businessId) {
        return prisma_1.prisma.service.findMany({
            where: { business_id: businessId },
        });
    }
    async getServiceById(serviceId) {
        return prisma_1.prisma.service.findUnique({
            where: { id: serviceId },
            include: { business: true }
        });
    }
    async updateService(id, data) {
        return prisma_1.prisma.service.update({
            where: { id },
            data: {
                name: data.name,
                duration_minutes: data.durationMinutes,
                price: data.price,
            },
        });
    }
}
exports.ServicesService = ServicesService;
