import { Module } from '@nestjs/common';
import { CalidadModule } from '../calidad/calidad.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardStreamService } from './dashboard-stream.service';

@Module({
  imports: [PersistenceModule, CalidadModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardStreamService],
  exports: [DashboardService, DashboardStreamService],
})
export class DashboardModule {}
