import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private crypto: CryptoService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });

    return this.generateToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user.id, user.email);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, telegramChatId: true, createdAt: true, smtpHost: true, smtpPort: true, smtpUser: true },
    });
    if (!user) return null;
    return { ...user, smtpConfigured: !!(user.smtpHost && user.smtpUser) };
  }

  async updateProfile(userId: string, dto: { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPass?: string }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.smtpHost !== undefined && { smtpHost: dto.smtpHost || null }),
        ...(dto.smtpPort !== undefined && { smtpPort: dto.smtpPort || null }),
        ...(dto.smtpUser !== undefined && { smtpUser: dto.smtpUser || null }),
        ...(dto.smtpPass !== undefined && {
          smtpPass: dto.smtpPass ? this.crypto.encrypt(dto.smtpPass) : null,
        }),
      },
    });
    return this.getProfile(userId);
  }

  private generateToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
