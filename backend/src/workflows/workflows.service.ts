import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';
import { NodeType, Prisma } from '@prisma/client';

const TRIGGER_TYPES: NodeType[] = [
  NodeType.TRIGGER_WEBHOOK,
  NodeType.TRIGGER_CRON,
  NodeType.TRIGGER_EMAIL,
];

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { nodes: true, executions: true } },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { nodes: true, edges: true },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.userId !== userId)
      throw new ForbiddenException('Access denied');
    return workflow;
  }

  async create(userId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateWorkflowDto) {
    await this.findOne(id, userId);
    return this.prisma.workflow.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true };
  }

  async saveCanvas(id: string, userId: string, dto: SaveCanvasDto) {
    const workflow = await this.findOne(id, userId);

    const triggerNodes = dto.nodes.filter((n) =>
      TRIGGER_TYPES.includes(n.type),
    );
    if (triggerNodes.length > 1) {
      throw new BadRequestException(
        'Workflow must have at most one trigger node',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowEdge.deleteMany({ where: { workflowId: id } });
      await tx.workflowNode.deleteMany({ where: { workflowId: id } });

      if (dto.nodes.length > 0) {
        await tx.workflowNode.createMany({
          data: dto.nodes.map((n) => ({
            id: n.id,
            workflowId: id,
            type: n.type,
            label: n.label,
            config: n.config as unknown as Prisma.InputJsonValue,
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        });
      }

      if (dto.edges.length > 0) {
        await tx.workflowEdge.createMany({
          data: dto.edges.map((e) => ({
            id: e.id,
            workflowId: id,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            conditionExpr: e.conditionExpr,
          })),
        });
      }

      return tx.workflow.update({
        where: { id },
        data: { version: workflow.version + 1 },
        include: { nodes: true, edges: true },
      });
    });
  }

  async activate(id: string, userId: string) {
    const workflow = await this.findOne(id, userId);
    const triggerNodes = workflow.nodes.filter((n) =>
      TRIGGER_TYPES.includes(n.type),
    );
    if (triggerNodes.length === 0) {
      throw new BadRequestException(
        'Workflow must have a trigger node to be activated',
      );
    }

    return this.prisma.workflow.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.workflow.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }
}
