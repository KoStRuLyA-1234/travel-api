import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';

class RouteStopDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class RouteDayDto {
  @IsInt()
  day: number;

  @IsString()
  title: string;

  @IsArray()
  stops: RouteStopDto[];
}

export class CreateRouteDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsString()
  title: string;

  @IsInt()
  @Min(1)
  cityId: number;

  @IsInt()
  @Min(1)
  days: number;

  @IsString()
  desc: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsArray()
  tags: string[];

  @IsArray()
  images: string[];

  @IsArray()
  itinerary: RouteDayDto[];
}

export class UpdateRouteDto extends PartialType(
  OmitType(CreateRouteDto, ['id'] as const),
) {}
