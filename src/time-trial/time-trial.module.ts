import { Module } from '@nestjs/common';
import { TimeTrialController } from './time-trial.controller';
import { TimeTrialService } from './time-trial.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [PersistenceModule, ItemsModule, DashboardModule],
  controllers: [TimeTrialController],
  providers: [TimeTrialService],
})
export class TimeTrialModule {}
