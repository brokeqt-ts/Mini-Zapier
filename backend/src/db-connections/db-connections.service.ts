import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDbConnectionDto {
  label: string;
  connectionString: string;
}

@Injectable()
export class DbConnectionsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.dbConnection.findMany({
      where: { userId },
      select: { id: true, label: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateDbConnectionDto) {
    return this.prisma.dbConnection.create({
      data: { userId, ...dto },
      select: { id: true, label: true, createdAt: true },
    });
  }

  async update(userId: string, id: string, dto: Partial<CreateDbConnectionDto>) {
    const conn = await this.prisma.dbConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException();
    if (conn.userId !== userId) throw new ForbiddenException();
    return this.prisma.dbConnection.update({
      where: { id },
      data: dto,
      select: { id: true, label: true, createdAt: true },
    });
  }

  async remove(userId: string, id: string) {
    const conn = await this.prisma.dbConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException();
    if (conn.userId !== userId) throw new ForbiddenException();
    await this.prisma.dbConnection.delete({ where: { id } });
    return { ok: true };
  }

  async getById(id: string) {
    return this.prisma.dbConnection.findUnique({ where: { id } });
  }
}
