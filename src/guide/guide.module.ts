import { Module } from '@nestjs/common';
import { GuideService } from './guide.service';
import { GuideController } from './guide.controller';

@Module({
  providers: [GuideService],
  controllers: [GuideController],
})
export class GuideModule {}
