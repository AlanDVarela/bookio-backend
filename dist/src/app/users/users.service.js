"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const prisma_1 = require("../../database/prisma");
class UsersService {
    async getAllUsers() {
        return prisma_1.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
    }
    async updateProfile(userId, data) {
        return prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                phone: data.phone,
            },
        });
    }
    async deleteUser(userId) {
        return prisma_1.prisma.user.delete({
            where: { id: userId },
        });
    }
    async getUserById(userId) {
        return prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });
    }
    async updateAvatar(userId, avatarUrl) {
        return prisma_1.prisma.user.update({
            where: { id: userId },
            data: { avatar_url: avatarUrl },
        });
    }
}
exports.UsersService = UsersService;
