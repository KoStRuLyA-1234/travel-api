import { Injectable, NotFoundException } from '@nestjs/common';
import { City, Prisma, Route } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CitySummary {
  city: City;
  routes: Route[];
}

export interface CityFilter {
  theme?: string;
  tag?: string;
  maxDays?: number;
}

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildRouteFilter(filters: CityFilter): Prisma.RouteWhereInput {
    const { theme, tag, maxDays } = filters;
    return {
      ...(theme && { theme }),
      ...(tag && { tags: { has: tag } }),
      ...(maxDays && { days: { lte: maxDays } }),
    };
  }

  async findAll(filters: CityFilter = {}): Promise<CitySummary[]> {
    const cities = await this.prisma.city.findMany({
      include: {
        routes: {
          where: this.buildRouteFilter(filters),
        },
      },
    });

    return cities
      .map((city) => ({
        city,
        routes: city.routes,
      }))
      .filter((summary) => summary.routes.length > 0);
  }

  async findRoutesByCity(id: number, filters: CityFilter = {}) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        routes: {
          where: this.buildRouteFilter(filters),
        },
      },
    });

    if (!city) {
      throw new NotFoundException(`City ${id} not found`);
    }

    return {
      city: {
        id: city.id,
        name: city.name,
        summary: city.summary,
        images: city.images,
      },
      routes: city.routes,
    };
  }
}
