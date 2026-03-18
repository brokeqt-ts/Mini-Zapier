import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DbConnectionsService, CreateDbConnectionDto } from './db-connections.service';

@ApiTags('DbConnections')
@Controller('db-connections')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DbConnectionsController {
  constructor(private service: DbConnectionsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.service.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateDbConnectionDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateDbConnectionDto>,
  ) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
