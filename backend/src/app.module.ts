import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { ExecutionModule } from './execution/execution.module';
import { TriggersModule } from './triggers/triggers.module';
import { ActionsModule } from './actions/actions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TelegramModule } from './telegram/telegram.module';
import { EmailAccountsModule } from './email-accounts/email-accounts.module';
import { DbConnectionsModule } from './db-connections/db-connections.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../.env'),
    }),
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60_000,
      limit: 100,
    }]),
    CryptoModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', '..', 'frontend', 'dist'),
      exclude: ['/api/(.*)'],
    }),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? {
            url: process.env.REDIS_URL,
            enableOfflineQueue: false,
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
          }
        : {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            enableOfflineQueue: false,
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
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
    EmailAccountsModule,
    DbConnectionsModule,
  ],
})
export class AppModule {}
