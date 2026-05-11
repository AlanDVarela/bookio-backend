"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoritesController = void 0;
const prisma_1 = require("../../database/prisma");
class FavoritesController {
    async getFavorites(req, res) {
        try {
            const clientId = req.user?.id;
            const favorites = await prisma_1.prisma.favorite.findMany({
                where: { client_id: clientId },
                include: { business: true },
                orderBy: { createdAt: 'desc' },
            });
            return res.status(200).json({ favorites });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async addFavorite(req, res) {
        try {
            const { businessId } = req.body;
            const clientId = req.user?.id;
            if (!businessId) {
                return res.status(400).json({ error: 'businessId is required' });
            }
            const favorite = await prisma_1.prisma.favorite.create({
                data: { client_id: clientId, business_id: businessId },
                include: { business: true },
            });
            return res.status(201).json({ message: 'Favorite added', favorite });
        }
        catch (error) {
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'Business already in favorites' });
            }
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async removeFavorite(req, res) {
        try {
            const id = req.params.id;
            const clientId = req.user?.id;
            const favorite = await prisma_1.prisma.favorite.findUnique({ where: { id } });
            if (!favorite || favorite.client_id !== clientId) {
                return res.status(404).json({ error: 'Favorite not found' });
            }
            await prisma_1.prisma.favorite.delete({ where: { id } });
            return res.status(200).json({ message: 'Favorite removed' });
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
exports.FavoritesController = FavoritesController;
