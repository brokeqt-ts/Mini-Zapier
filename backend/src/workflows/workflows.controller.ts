import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.workflowsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.findOne(id, user.userId);
  }

  @Post()
  create(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.create(user.userId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.remove(id, user.userId);
  }

  @Put(':id/canvas')
  saveCanvas(
    @Param('id') id: string,
    @Body() dto: SaveCanvasDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.saveCanvas(id, user.userId, dto);
  }

  @Post(':id/activate')
  activate(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.activate(id, user.userId);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.workflowsService.deactivate(id, user.userId);
  }
}
