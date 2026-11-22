import { Module } from '@nestjs/common';
import { TutoriaController } from './tutoria.controller';
import { TutoriaService } from './tutoria.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { CalidadModule } from '../calidad/calidad.module';

@Module({
  imports: [PersistenceModule, ItemsModule, CalidadModule],
  controllers: [TutoriaController],
  providers: [TutoriaService],
  exports: [TutoriaService],
})
export class TutoriaModule {}
