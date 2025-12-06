import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        routes: {
          select: {
            id: true,
            title: true,
            days: true,
            theme: true,
            city: { select: { name: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [liked, saved] = await Promise.all([
      this.prisma.routeLike.findMany({
        where: { userId },
        select: { routeId: true },
      }),
      this.prisma.savedRoute.findMany({
        where: { userId },
        select: { routeId: true },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      createdRoutes: user.routes.map((route) => ({
        id: route.id,
        title: route.title,
        city: route.city.name,
        days: route.days,
        theme: route.theme ?? null,
      })),
      likedRouteIds: liked.map((like) => like.routeId),
      savedRouteIds: saved.map((entry) => entry.routeId),
      stats: {
        created: user.routes.length,
        liked: liked.length,
        saved: saved.length,
      },
    };
  }
}
