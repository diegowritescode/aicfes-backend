import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PersistenceService } from './persistence.service';

@Module({
  providers: [PrismaService, PersistenceService],
  exports: [PrismaService, PersistenceService],
})
export class PersistenceModule {}
