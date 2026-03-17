import { Module } from '@nestjs/common';
import { ExecutionLoggerService } from './execution-logger.service';

@Module({
  providers: [ExecutionLoggerService],
  exports: [ExecutionLoggerService],
})
export class LoggingModule {}
