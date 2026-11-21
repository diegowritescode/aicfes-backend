import { Module } from '@nestjs/common';
import { FigurasController } from './figuras.controller';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  controllers: [FigurasController],
})
export class FigurasModule {}
