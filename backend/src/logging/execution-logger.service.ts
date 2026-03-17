import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogLevel } from '@prisma/client';

@Injectable()
export class ExecutionLoggerService {
  constructor(private prisma: PrismaService) {}

  async log(
    executionId: string,
    nodeId: string | null,
    level: keyof typeof LogLevel,
    message: string,
    data?: {
      input?: unknown;
      output?: unknown;
      error?: string;
      durationMs?: number;
    },
  ): Promise<void> {
    await this.prisma.executionLog.create({
      data: {
        executionId,
        nodeId,
        level,
        message,
        inputData: data?.input ? (data.input as object) : undefined,
        outputData: data?.output ? (data.output as object) : undefined,
        error: data?.error,
        durationMs: data?.durationMs,
      },
    });
  }
}
