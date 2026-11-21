import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { FigurasModule } from './figuras/figuras.module';
import { SimulacroModule } from './simulacro/simulacro.module';
import { ItemsModule } from './items/items.module';
import { PersistenceModule } from './persistence/persistence.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { TimeTrialModule } from './time-trial/time-trial.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    PersistenceModule,
    HealthModule,
    ItemsModule,
    SimulacroModule,
    FigurasModule,
    DashboardModule,
    AuthModule,
    TimeTrialModule,
    FeedbackModule,
  ],
})
export class AppModule {}
