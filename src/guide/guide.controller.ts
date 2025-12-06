import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GuideService } from './guide.service';
import { GenerateGuideDto } from './dto/generate-guide.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('guide')
export class GuideController {
  constructor(private readonly guideService: GuideService) {}

  // Оставляем публичным (без Jwt), чтобы фронт мог дергать без токена,
  // при необходимости можно раскомментировать UseGuards.
  // @UseGuards(JwtAuthGuard)
  @Post('generate')
  generate(@Body() dto: GenerateGuideDto) {
    return this.guideService.generate(dto);
  }
}
