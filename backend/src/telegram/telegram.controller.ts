import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TelegramService } from './telegram.service';

@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  /** Returns bot info so frontend knows if feature is available */
  @Get('bot-info')
  getBotInfo() {
    return {
      configured: this.telegramService.isBotConfigured(),
      botUsername: this.telegramService.getBotUsername(),
    };
  }

  /** Start connection flow — returns a one-time code */
  @Post('connect')
  async connect(@CurrentUser() user: { userId: string }) {
    if (!this.telegramService.isBotConfigured()) {
      throw new BadRequestException('Telegram bot is not configured on this server');
    }
    const code = await this.telegramService.startConnect(user.userId);
    return {
      code,
      botUsername: this.telegramService.getBotUsername(),
    };
  }

  /** Poll this until connected === true */
  @Get('connect/status')
  getStatus(@CurrentUser() user: { userId: string }) {
    return this.telegramService.getStatus(user.userId);
  }

  /** Unlink Telegram */
  @Delete('disconnect')
  disconnect(@CurrentUser() user: { userId: string }) {
    return this.telegramService.disconnect(user.userId);
  }
}
