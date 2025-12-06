import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/create-route.dto';
import { Prisma, Route } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type RouteWithRelations = Prisma.RouteGetPayload<{
  include: {
    author: { select: { id: true; name: true; avatarUrl: true } };
    _count: { select: { likes: true; savedBy: true } };
    city: { select: { name: true } };
    savedBy: { select: { userId: true } };
  };
}>;

export type RouteWithMeta = Route & {
  likesCount: number;
  savedCount: number;
  cityName?: string | null;
  savedByCurrentUser?: boolean;
  author?: {
    id: number;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
  tagHints: Record<string, string>;
};

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly routeInclude = {
    author: { select: { id: true, name: true, avatarUrl: true } },
    city: { select: { id: true, name: true } },
    _count: { select: { likes: true, savedBy: true } },
    savedBy: { select: { userId: true } },
  } as const;

  private mapRoute(
    route: RouteWithRelations,
    hintsMap?: Map<string, string>,
    currentUserId?: number,
  ): RouteWithMeta {
    const { _count, author, savedBy, city, ...rest } = route;
    const tagHints = route.tags.reduce((acc, tag) => {
      const normalized = tag.trim().toLowerCase();
      const hint = hintsMap?.get(normalized);
      if (hint) acc[tag] = hint;
      return acc;
    }, {} as Record<string, string>);

    return {
      ...rest,
      cityName: city?.name ?? null,
      author,
      likesCount: _count.likes,
      savedCount: _count.savedBy,
      savedByCurrentUser: currentUserId
        ? savedBy.some((entry) => entry.userId === currentUserId)
        : undefined,
      tagHints,
    };
  }

  private async mapRoutesWithHints(
    routes: RouteWithRelations[],
    currentUserId?: number,
  ): Promise<RouteWithMeta[]> {
    if (!routes.length) return [];
    const tagSet = new Set<string>();
    routes.forEach((route) =>
      route.tags.forEach((tag) => tagSet.add(tag.trim().toLowerCase())),
    );
    const hints = await this.prisma.tagHint.findMany({
      where: { tag: { in: Array.from(tagSet) } },
    });
    const hintsMap = new Map(
      hints.map((hint) => [hint.tag.trim().toLowerCase(), hint.hint]),
    );
    return routes.map((route) => this.mapRoute(route, hintsMap, currentUserId));
  }

  async findAll(userId?: number) {
    const routes = await this.prisma.route.findMany({
      include: this.routeInclude,
    });
    return this.mapRoutesWithHints(routes, userId);
  }

  async findOne(id: number, userId?: number): Promise<RouteWithMeta | null> {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: this.routeInclude,
    });
    if (!route) return null;
    const [mapped] = await this.mapRoutesWithHints([route], userId);
    return mapped;
  }

  async findByFilter({
    city,
    theme,
    tag,
    maxDays,
    userId,
  }: {
    city?: string;
    theme?: string;
    tag?: string;
    maxDays?: number;
    userId?: number;
  }): Promise<RouteWithMeta[]> {
    const routes = await this.prisma.route.findMany({
      where: {
        ...(city && { city: { name: city } }),
        ...(theme && { theme }),
        ...(tag && { tags: { has: tag } }),
        ...(maxDays && { days: { lte: maxDays } }),
      },
      include: this.routeInclude,
    });
    return this.mapRoutesWithHints(routes, userId);
  }

  async create(data: CreateRouteDto, authorId: number) {
    const { itinerary, ...rest } = data;
    const created = await this.prisma.route.create({
      data: {
        ...rest,
        authorId,
        itinerary: itinerary as unknown as Prisma.InputJsonValue,
      },
      include: this.routeInclude,
    });
    const [mapped] = await this.mapRoutesWithHints([created]);
    return mapped;
  }

  async update(id: number, data: UpdateRouteDto, userId: number) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      include: this.routeInclude,
    });
    if (!existing) throw new NotFoundException(`Route ${id} not found`);
    if (existing.authorId && existing.authorId !== userId) {
      throw new ForbiddenException('You cannot edit this route');
    }

    const { itinerary, ...rest } = data;
    const payload: Prisma.RouteUpdateInput = {
      ...rest,
    };
    if (itinerary) {
      payload.itinerary = itinerary as unknown as Prisma.InputJsonValue;
    }
    const updated = await this.prisma.route.update({
      where: { id },
      data: payload,
      include: this.routeInclude,
    });
    const [mapped] = await this.mapRoutesWithHints([updated]);
    return mapped;
  }

  async delete(id: number, userId: number) {
    const existing = await this.prisma.route.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Route ${id} not found`);
    if (existing.authorId && existing.authorId !== userId) {
      throw new ForbiddenException('You cannot delete this route');
    }
    return this.prisma.route.delete({ where: { id } });
  }

  async like(routeId: number, userId: number) {
    try {
      await this.prisma.routeLike.create({
        data: { routeId, userId },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // already liked, ignore
      } else {
        throw error;
      }
    }
    return this.findOne(routeId, userId);
  }

  async unlike(routeId: number, userId: number) {
    await this.prisma.routeLike.deleteMany({
      where: { routeId, userId },
    });
    return this.findOne(routeId, userId);
  }

  async getLikedRouteIds(userId: number) {
    const likes = await this.prisma.routeLike.findMany({
      where: { userId },
      select: { routeId: true },
    });
    return likes.map((like) => like.routeId);
  }

  async save(routeId: number, userId: number) {
    try {
      await this.prisma.savedRoute.create({
        data: { routeId, userId },
      });
    } catch (error) {
      if (
        !(error instanceof PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }
    return this.findOne(routeId, userId);
  }

  async unsave(routeId: number, userId: number) {
    await this.prisma.savedRoute.deleteMany({
      where: { routeId, userId },
    });
    return this.findOne(routeId, userId);
  }

  async getSavedRouteIds(userId: number) {
    const saved = await this.prisma.savedRoute.findMany({
      where: { userId },
      select: { routeId: true },
    });
    return saved.map((item) => item.routeId);
  }

  async getLikedRoutes(userId: number) {
    const routes = await this.prisma.route.findMany({
      where: { likes: { some: { userId } } },
      include: this.routeInclude,
    });
    return this.mapRoutesWithHints(routes, userId);
  }

  async getSavedRoutes(userId: number) {
    const routes = await this.prisma.route.findMany({
      where: { savedBy: { some: { userId } } },
      include: this.routeInclude,
    });
    return this.mapRoutesWithHints(routes, userId);
  }
}








