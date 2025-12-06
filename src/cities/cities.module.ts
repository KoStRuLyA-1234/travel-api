import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { RoutesModule } from '../routes/routes.module';


@Module({
  imports: [RoutesModule],
  controllers: [CitiesController],
  providers: [CitiesService],
})
export class CitiesModule {}

