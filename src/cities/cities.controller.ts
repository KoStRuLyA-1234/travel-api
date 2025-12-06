import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CitiesService } from './cities.service';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  findAll(
    @Query('theme') theme?: string,
    @Query('tag') tag?: string,
    @Query('maxDays') maxDays?: string,
  ) {
    return this.citiesService.findAll({
      theme,
      tag,
      maxDays: maxDays ? Number(maxDays) : undefined,
    });
  }

  @Get(':id/routes')
  findRoutesForCity(
    @Param('id', ParseIntPipe) id: number,
    @Query('theme') theme?: string,
    @Query('tag') tag?: string,
    @Query('maxDays') maxDays?: string,
  ) {
    return this.citiesService.findRoutesByCity(id, {
      theme,
      tag,
      maxDays: maxDays ? Number(maxDays) : undefined,
    });
  }
}
