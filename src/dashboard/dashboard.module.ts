import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardStreamService } from './dashboard-stream.service';

@Module({
  imports: [PersistenceModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardStreamService],
})
export class DashboardModule {}
