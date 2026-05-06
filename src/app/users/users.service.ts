import { prisma } from '../../database/prisma';

export class UsersService {
  public async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  public async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
      },
    });
  }

  public async deleteUser(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
    });
  }

  public async getUserById(userId: string) {
    return prisma.user.findUnique({
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

  public async updateAvatar(userId: string, avatarUrl: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl },
    });
  }
}
