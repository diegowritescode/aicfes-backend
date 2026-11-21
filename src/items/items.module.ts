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
import { VerificadorClaudeService } from './services/verificador-claude.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { CalidadModule } from '../calidad/calidad.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [PersistenceModule, DashboardModule, CalidadModule],
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
    VerificadorClaudeService,
  ],
  exports: [ItemGeneratorService, OpenaiService, ItemBankService, ReferenciaService],
})
export class ItemsModule {}
