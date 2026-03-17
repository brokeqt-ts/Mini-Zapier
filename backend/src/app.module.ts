import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { ExecutionModule } from './execution/execution.module';
import { TriggersModule } from './triggers/triggers.module';
import { ActionsModule } from './actions/actions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    PrismaModule,
    AuthModule,
    WorkflowsModule,
    ExecutionModule,
    TriggersModule,
    ActionsModule,
    DashboardModule,
    TelegramModule,
  ],
})
export class AppModule {}
