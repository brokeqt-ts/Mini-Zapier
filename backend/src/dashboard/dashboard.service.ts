import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const [totalWorkflows, activeWorkflows, totalExecutions, failedExecutions] =
      await Promise.all([
        this.prisma.workflow.count({ where: { userId } }),
        this.prisma.workflow.count({
          where: { userId, status: 'ACTIVE' },
        }),
        this.prisma.execution.count({
          where: { workflow: { userId } },
        }),
        this.prisma.execution.count({
          where: { workflow: { userId }, status: 'FAILED' },
        }),
      ]);

    return {
      totalWorkflows,
      activeWorkflows,
      totalExecutions,
      failedExecutions,
      successRate:
        totalExecutions > 0
          ? Math.round(
              ((totalExecutions - failedExecutions) / totalExecutions) * 100,
            )
          : 100,
    };
  }

  async getRecentExecutions(userId: string) {
    return this.prisma.execution.findMany({
      where: { workflow: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        workflow: { select: { id: true, name: true } },
      },
    });
  }
}
