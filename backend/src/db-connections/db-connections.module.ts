import { Module } from '@nestjs/common';
import { DbConnectionsService } from './db-connections.service';
import { DbConnectionsController } from './db-connections.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DbConnectionsController],
  providers: [DbConnectionsService],
  exports: [DbConnectionsService],
})
export class DbConnectionsModule {}
