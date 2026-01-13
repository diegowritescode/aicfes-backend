import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ItemsModule } from './items/items.module';
import { PersistenceModule } from './persistence/persistence.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    PersistenceModule,
    HealthModule,
    ItemsModule,
  ],
})
export class AppModule {}
