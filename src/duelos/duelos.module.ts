import { Module } from '@nestjs/common';
import { DuelosController } from './duelos.controller';
import { DuelosService } from './duelos.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { CalidadModule } from '../calidad/calidad.module';

@Module({
  imports: [PersistenceModule, ItemsModule, CalidadModule],
  controllers: [DuelosController],
  providers: [DuelosService],
})
export class DuelosModule {}
