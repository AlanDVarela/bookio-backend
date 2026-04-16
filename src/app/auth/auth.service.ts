import { prisma } from '../../database/prisma';

interface RegisterUserParams {
  firebaseUid: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'BUSINESS_OWNER';
  phone?: string;
  avatarUrl?: string;
}

export class AuthService {
  async registerUser(params: RegisterUserParams) {
    const existing = await prisma.user.findUnique({ where: { id: params.firebaseUid } });
    if (existing) {
      return { user: existing, created: false };
    }

    const user = await prisma.user.create({
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

  async getProfile(firebaseUid: string) {
    return prisma.user.findUnique({
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
