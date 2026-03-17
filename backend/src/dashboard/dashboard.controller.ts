import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: { userId: string }) {
    return this.dashboardService.getStats(user.userId);
  }

  @Get('recent-executions')
  getRecentExecutions(@CurrentUser() user: { userId: string }) {
    return this.dashboardService.getRecentExecutions(user.userId);
  }
}
