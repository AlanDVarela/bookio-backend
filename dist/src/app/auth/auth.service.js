"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../../database/prisma");
class AuthService {
    async registerUser(params) {
        const existing = await prisma_1.prisma.user.findUnique({ where: { id: params.firebaseUid } });
        if (existing) {
            return { user: existing, created: false };
        }
        const user = await prisma_1.prisma.user.create({
            data: {
                id: params.firebaseUid,
                email: params.email,
                name: params.name,
                role: params.role,
                phone: params.phone ?? null,
                avatar_url: params.avatarUrl ?? null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                avatar_url: true,
                createdAt: true,
            },
        });
        return { user, created: true };
    }
    async getProfile(firebaseUid) {
        return prisma_1.prisma.user.findUnique({
            where: { id: firebaseUid },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                avatar_url: true,
                createdAt: true,
            },
        });
    }
}
exports.AuthService = AuthService;
