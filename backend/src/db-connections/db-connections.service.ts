import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';

export interface CreateDbConnectionDto {
  label: string;
  connectionString: string;
}

@Injectable()
export class DbConnectionsService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async list(userId: string) {
    return this.prisma.dbConnection.findMany({
      where: { userId },
      select: { id: true, label: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateDbConnectionDto) {
    return this.prisma.dbConnection.create({
      data: {
        userId,
        label: dto.label,
        connectionString: this.crypto.encrypt(dto.connectionString),
      },
      select: { id: true, label: true, createdAt: true },
    });
  }

  async update(userId: string, id: string, dto: Partial<CreateDbConnectionDto>) {
    const conn = await this.prisma.dbConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException();
    if (conn.userId !== userId) throw new ForbiddenException();
    const data: Partial<CreateDbConnectionDto> = { ...dto };
    if (dto.connectionString) {
      data.connectionString = this.crypto.encrypt(dto.connectionString);
    }
    return this.prisma.dbConnection.update({
      where: { id },
      data,
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
    const conn = await this.prisma.dbConnection.findUnique({ where: { id } });
    if (!conn) return null;
    return {
      ...conn,
      connectionString: this.crypto.decrypt(conn.connectionString),
    };
  }
}
