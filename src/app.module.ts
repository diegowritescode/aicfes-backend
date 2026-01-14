import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ItemsModule } from './items/items.module';
import { PersistenceModule } from './persistence/persistence.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    PersistenceModule,
    HealthModule,
    ItemsModule,
    DashboardModule,
    AuthModule,
  ],
})
export class AppModule {}
