import { Module } from '@nestjs/common';
import { EmailAccountsService } from './email-accounts.service';
import { EmailAccountsController } from './email-accounts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAccountsController],
  providers: [EmailAccountsService],
  exports: [EmailAccountsService],
})
export class EmailAccountsModule {}
