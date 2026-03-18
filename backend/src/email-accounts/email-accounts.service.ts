import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateEmailAccountDto {
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  imapHost?: string;
  imapPort?: number;
}

@Injectable()
export class EmailAccountsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.emailAccount.findMany({
      where: { userId },
      select: { id: true, label: true, smtpHost: true, smtpPort: true, smtpUser: true, imapHost: true, imapPort: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateEmailAccountDto) {
    const account = await this.prisma.emailAccount.create({
      data: { userId, ...dto },
      select: { id: true, label: true, smtpHost: true, smtpPort: true, smtpUser: true, imapHost: true, imapPort: true, createdAt: true },
    });
    return account;
  }

  async update(userId: string, id: string, dto: Partial<CreateEmailAccountDto>) {
    const account = await this.prisma.emailAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException();
    if (account.userId !== userId) throw new ForbiddenException();
    return this.prisma.emailAccount.update({
      where: { id },
      data: dto,
      select: { id: true, label: true, smtpHost: true, smtpPort: true, smtpUser: true, imapHost: true, imapPort: true, createdAt: true },
    });
  }

  async remove(userId: string, id: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException();
    if (account.userId !== userId) throw new ForbiddenException();
    await this.prisma.emailAccount.delete({ where: { id } });
    return { ok: true };
  }

  async getById(id: string) {
    return this.prisma.emailAccount.findUnique({ where: { id } });
  }
}
