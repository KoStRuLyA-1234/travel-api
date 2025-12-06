import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params: {
    cityId?: number;
    city?: string;
    from?: Date;
    limit?: number;
  }) {
    const { cityId, city, from, limit } = params;
    return this.prisma.liveEvent.findMany({
      where: {
        ...(cityId && { cityId }),
        ...(city && { city: { name: city } }),
        ...(from && { date: { gte: from } }),
      },
      include: {
        city: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
      ...(limit && { take: limit }),
    });
  }

  async findOne(id: number) {
    const event = await this.prisma.liveEvent.findUnique({
      where: { id },
      include: {
        city: { select: { id: true, name: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  create(dto: CreateEventDto) {
    return this.prisma.liveEvent.create({
      data: {
        cityId: dto.cityId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        date: new Date(dto.date),
        tags: dto.tags ?? [],
        link: dto.link,
        lat: dto.lat,
        lng: dto.lng,
      },
    });
  }

  async update(id: number, dto: UpdateEventDto) {
    await this.findOne(id);
    return this.prisma.liveEvent.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.liveEvent.delete({
      where: { id },
    });
    return { success: true };
  }
}
