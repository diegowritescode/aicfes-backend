import { Module } from '@nestjs/common';
import { SimulacroController } from './simulacro.controller';
import { SimulacroService } from './simulacro.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [PersistenceModule, ItemsModule],
  controllers: [SimulacroController],
  providers: [SimulacroService],
  exports: [SimulacroService],
})
export class SimulacroModule {}
