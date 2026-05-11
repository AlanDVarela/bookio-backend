"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessesService = void 0;
const prisma_1 = require("../../database/prisma");
const s3_service_1 = require("../middlewares/s3.service");
const client_1 = require("@prisma/client");
class BusinessesService {
    async registerBusiness(data) {
        let logoUrl = null;
        if (data.logoBuffer && data.logoMimeType) {
            logoUrl = await (0, s3_service_1.uploadBusinessLogo)(data.logoBuffer, data.logoMimeType);
        }
        return prisma_1.prisma.business.create({
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
    async getAllBusinesses(filters) {
        try {
            const where = {};
            // 1. Validación de ENUM (Evita el error P2007 de Prisma)
            if (filters.type) {
                const upperType = filters.type.toUpperCase();
                // Verificamos si el valor existe en el ENUM generado por Prisma
                if (Object.values(client_1.BusinessType).includes(upperType)) {
                    where.type = upperType;
                }
                else {
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
                prisma_1.prisma.business.count({ where }),
                prisma_1.prisma.business.findMany({
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
        }
        catch (error) {
            // Log detallado para desarrollo en ITESO
            console.error("[Bookio Database Error]:", error);
            // Error amigable para el frontend
            throw new Error("Error al recuperar los negocios. Por favor, verifica los filtros.");
        }
    }
    async getBusinessById(businessId) {
        return prisma_1.prisma.business.findUnique({
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
    async updateBusiness(id, data) {
        return prisma_1.prisma.business.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
            },
        });
    }
}
exports.BusinessesService = BusinessesService;
