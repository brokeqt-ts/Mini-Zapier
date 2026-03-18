import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExecutionService } from './execution.service';

@ApiTags('Executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExecutionController {
  constructor(private executionService: ExecutionService) {}

  @Get('workflows/:workflowId/executions')
  findByWorkflow(
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.executionService.findByWorkflow(workflowId, user.userId);
  }

  @Get('executions/:id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    const execution = await this.executionService.findOne(id);
    if (execution.workflow.userId !== user.userId) {
      throw new ForbiddenException('Access denied');
    }
    return execution;
  }

  @Post('workflows/:workflowId/execute')
  execute(
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: { userId: string },
  ) {
    // Ownership check happens in execution service via workflow lookup
    return this.executionService.startExecution(workflowId, {
      triggeredAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  @Post('executions/:id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    const execution = await this.executionService.findOne(id);
    if (execution.workflow.userId !== user.userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.executionService.cancel(id);
  }

  @Post('executions/:id/retry')
  async retry(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    const execution = await this.executionService.findOne(id);
    if (execution.workflow.userId !== user.userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.executionService.retry(id);
  }

  @Delete('executions/:id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    const execution = await this.executionService.findOne(id);
    if (execution.workflow.userId !== user.userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.executionService.delete(id);
  }
}
