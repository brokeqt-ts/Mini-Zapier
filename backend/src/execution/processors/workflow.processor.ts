import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutionEngineService } from '../execution-engine.service';

@Processor('workflow')
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(private executionEngine: ExecutionEngineService) {
    super();
  }

  async process(job: Job<{ executionId: string }>): Promise<void> {
    this.logger.log(`Processing execution ${job.data.executionId}`);

    try {
      await this.executionEngine.run(job.data.executionId);
      this.logger.log(`Execution ${job.data.executionId} completed`);
    } catch (error) {
      this.logger.error(
        `Execution ${job.data.executionId} failed: ${error}`,
      );
      throw error;
    }
  }
}
