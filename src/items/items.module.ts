import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { PromptLoaderService } from './services/prompt-loader.service';
import { OpenaiService } from './services/openai.service';
import { ItemGeneratorService } from './services/item-generator.service';
import { NormalizerService } from './services/normalizer.service';
import { ValidatorsService } from './services/validators.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [PersistenceModule, DashboardModule],
  controllers: [ItemsController],
  providers: [
    PromptLoaderService,
    OpenaiService,
    ItemGeneratorService,
    NormalizerService,
    ValidatorsService,
  ],
  exports: [ItemGeneratorService, OpenaiService],
})
export class ItemsModule {}
