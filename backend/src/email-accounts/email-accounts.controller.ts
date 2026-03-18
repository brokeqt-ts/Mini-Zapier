import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmailAccountsService, CreateEmailAccountDto } from './email-accounts.service';

@ApiTags('EmailAccounts')
@Controller('email-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailAccountsController {
  constructor(private service: EmailAccountsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.service.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateEmailAccountDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: Partial<CreateEmailAccountDto>) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.service.remove(user.userId, id);
  }
}
