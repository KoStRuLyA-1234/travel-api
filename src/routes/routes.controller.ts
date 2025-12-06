import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { RoutesService, RouteWithMeta } from './routes.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/create-route.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPayload } from '../auth/auth.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query('city') city?: string,
    @Query('theme') theme?: string,
    @Query('tag') tag?: string,
    @Query('maxDays') maxDays?: string,
    @CurrentUser() user?: AuthPayload | null,
  ): Promise<RouteWithMeta[]> {
    const days = maxDays ? Number(maxDays) : undefined;
    return this.routesService.findByFilter({
      city,
      theme,
      tag,
      maxDays: days,
      userId: user?.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<RouteWithMeta> {
    return this.routesService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: AuthPayload,
  ): Promise<RouteWithMeta> {
    return this.routesService.update(Number(id), dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthPayload,
  ) {
    return this.routesService.delete(Number(id), user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  likeRoute(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.routesService.like(Number(id), user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlikeRoute(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.routesService.unlike(Number(id), user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('liked')
  likedRoutes(@CurrentUser() user: AuthPayload) {
    return this.routesService.getLikedRouteIds(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('liked/list')
  likedRoutesList(@CurrentUser() user: AuthPayload) {
    return this.routesService.getLikedRoutes(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  saveRoute(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.routesService.save(Number(id), user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/save')
  unsaveRoute(@Param('id') id: string, @CurrentUser() user: AuthPayload) {
    return this.routesService.unsave(Number(id), user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('saved')
  savedRoutes(@CurrentUser() user: AuthPayload) {
    return this.routesService.getSavedRouteIds(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('saved/list')
  savedRoutesList(@CurrentUser() user: AuthPayload) {
    return this.routesService.getSavedRoutes(user.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthPayload | null,
  ): Promise<RouteWithMeta> {
    const route = await this.routesService.findOne(Number(id), user?.id);
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }
}
