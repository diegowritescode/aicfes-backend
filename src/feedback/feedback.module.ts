import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PersistenceModule, ItemsModule, DashboardModule, ConfigModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
