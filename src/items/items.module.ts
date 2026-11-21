import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { PromptLoaderService } from './services/prompt-loader.service';
import { OpenaiService } from './services/openai.service';
import { ItemGeneratorService } from './services/item-generator.service';
import { NormalizerService } from './services/normalizer.service';
import { ValidatorsService } from './services/validators.service';
import { AnswerVerifierService } from './services/answer-verifier.service';
import { ItemBankService } from './services/item-bank.service';
import { ReferenciaService } from './services/referencia.service';
import { CalidadService } from './services/calidad.service';
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
    AnswerVerifierService,
    ItemBankService,
    ReferenciaService,
    CalidadService,
  ],
  exports: [ItemGeneratorService, OpenaiService, ItemBankService, ReferenciaService, CalidadService],
})
export class ItemsModule {}
