import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';
import { PersistenceModule } from '../persistence/persistence.module';
/* OpenaiService lives here. */
import { ItemsModule } from '../items/items.module';
/* DashboardService, for the week's figures. */
import { DashboardModule } from '../dashboard/dashboard.module';
/* DebilidadesService, which is where the report's substance comes
   from — and CuotaService, which `CuotaGuard` needs. Without this
   import Nest cannot build the guard and the whole application
   refuses to start: not a broken route, a process that never comes
   up. `feedback.module.ts` records the same trap. */
import { CalidadModule } from '../calidad/calidad.module';

@Module({
  imports: [PersistenceModule, ItemsModule, DashboardModule, ConfigModule, CalidadModule],
  controllers: [InformeController],
  providers: [InformeService],
  /* Exported so the training screens can read the plan and preselect
     the topic it points at. That is the whole reason the plan stores
     `area` and `tema` instead of prose. */
  exports: [InformeService],
})
export class InformeModule {}
