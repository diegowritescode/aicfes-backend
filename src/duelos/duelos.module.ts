import { Module } from '@nestjs/common';
import { DuelosController } from './duelos.controller';
import { DuelosService } from './duelos.service';
import { AmigosService } from './amigos.service';
import { PerfilPublicoService } from './perfil-publico.service';
import { ModeracionController } from './moderacion.controller';
import { ModeracionService } from './moderacion.service';
import { PersistenceModule } from '../persistence/persistence.module';
import { ItemsModule } from '../items/items.module';
import { CalidadModule } from '../calidad/calidad.module';
import { CorreoService } from '../common/correo.service';
import { ModeracionGuard, SoloSecretoGuard } from '../common/guards/moderacion.guard';

@Module({
  imports: [PersistenceModule, ItemsModule, CalidadModule],
  controllers: [DuelosController, ModeracionController],
  providers: [
    DuelosService,
    AmigosService,
    PerfilPublicoService,
    ModeracionService,
    CorreoService,
    ModeracionGuard,
    SoloSecretoGuard,
  ],
})
export class DuelosModule {}
