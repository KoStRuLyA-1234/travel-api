import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoutesModule } from './routes/routes.module';
import { CitiesModule } from './cities/cities.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { GuideModule } from './guide/guide.module';

@Module({
  imports: [
    PrismaModule,
    RoutesModule,
    CitiesModule,
    AuthModule,
    UsersModule,
    EventsModule,
    GuideModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
