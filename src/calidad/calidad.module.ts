import { Module } from '@nestjs/common';
import { CalidadService } from './calidad.service';
import { CostosService } from './costos.service';
import { CuotaService } from './cuota.service';
import { PersistenceModule } from '../persistence/persistence.module';

/**
 * Measurement lives in its own module because both the generator and
 * the dashboard record into it. Putting it inside either one would make
 * the two modules import each other.
 */
@Module({
  imports: [PersistenceModule],
  providers: [CalidadService, CostosService, CuotaService],
  exports: [CalidadService, CostosService, CuotaService],
})
export class CalidadModule {}
