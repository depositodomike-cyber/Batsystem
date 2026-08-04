import {
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ConversasService } from './conversas.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Histórico de conversas de chat, escopado ao usuário e à empresa (tenant).
 * A criação/gravação de mensagens acontece no fluxo de chat (POST /ai/chat/stream).
 */
@Controller('conversas')
@UseGuards(JwtAuthGuard)
export class ConversasController {
  constructor(private readonly conversas: ConversasService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.conversas.list(user.empresaId, user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conversas.getWithMessages(user.empresaId, user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conversas.remove(user.empresaId, user.id, id);
  }
}
