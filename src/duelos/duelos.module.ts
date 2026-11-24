import { Module } from '@nestjs/common';
import { DuelosController } from './duelos.controller';
import { DuelosService } from './duelos.service';
import { AmigosService } from './amigos.service';
import { ModeracionController } from './moderacion.controller';
import { ModeracionService } from './moderacion.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { CalidadModule } from '../calidad/calidad.module';
import { CorreoService } from '../common/correo.service';

@Module({
  imports: [PersistenceModule, ItemsModule, CalidadModule],
  controllers: [DuelosController, ModeracionController],
  providers: [DuelosService, AmigosService, ModeracionService, CorreoService],
})
export class DuelosModule {}
