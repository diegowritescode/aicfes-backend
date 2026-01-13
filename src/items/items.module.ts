import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { PromptLoaderService } from './services/prompt-loader.service';
import { OpenaiService } from './services/openai.service';
import { ItemGeneratorService } from './services/item-generator.service';
import { NormalizerService } from './services/normalizer.service';
import { ValidatorsService } from './services/validators.service';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  controllers: [ItemsController],
  providers: [
    PromptLoaderService,
    OpenaiService,
    ItemGeneratorService,
    NormalizerService,
    ValidatorsService,
  ],
})
export class ItemsModule {}
