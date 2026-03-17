import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { HttpRequestExecutor } from './executors/http-request.executor';
import { EmailExecutor } from './executors/email.executor';
import { TelegramExecutor } from './executors/telegram.executor';
import { DatabaseQueryExecutor } from './executors/database-query.executor';
import { DataTransformExecutor } from './executors/data-transform.executor';

@Module({
  providers: [
    ActionsService,
    HttpRequestExecutor,
    EmailExecutor,
    TelegramExecutor,
    DatabaseQueryExecutor,
    DataTransformExecutor,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
