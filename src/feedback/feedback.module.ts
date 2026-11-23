import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';
/* CuotaGuard on the generate routes needs CuotaService, which lives
   here. Without this import Nest cannot build the guard and the whole
   application refuses to start — not a runtime error on one route, a
   process that never comes up. */
import { CalidadModule } from '../calidad/calidad.module';

@Module({
  imports: [PersistenceModule, ItemsModule, DashboardModule, ConfigModule, CalidadModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
