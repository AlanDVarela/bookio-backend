import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../../database/prisma';

export class FavoritesController {
  public async getFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      const clientId = req.user?.id;
      const favorites = await prisma.favorite.findMany({
        where: { client_id: clientId },
        include: { business: true },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ favorites });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async addFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const { businessId } = req.body;
      const clientId = req.user?.id;

      if (!businessId) {
        return res.status(400).json({ error: 'businessId is required' });
      }

      const favorite = await prisma.favorite.create({
        data: { client_id: clientId!, business_id: businessId },
        include: { business: true },
      });

      return res.status(201).json({ message: 'Favorite added', favorite });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Business already in favorites' });
      }
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async removeFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const clientId = req.user?.id;

      const favorite = await prisma.favorite.findUnique({ where: { id } });
      if (!favorite || favorite.client_id !== clientId) {
        return res.status(404).json({ error: 'Favorite not found' });
      }

      await prisma.favorite.delete({ where: { id } });
      return res.status(200).json({ message: 'Favorite removed' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
