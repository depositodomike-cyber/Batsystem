import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConectoresService } from './conectores.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Conectores (integrações) da empresa do usuário logado.
 * Mesmo estado consumido pelas ferramentas do servidor MCP (/mcp).
 */
@Controller('conectores')
@UseGuards(JwtAuthGuard)
export class ConectoresController {
  constructor(private readonly conectores: ConectoresService) {}

  @Get('categorias')
  categories() {
    return this.conectores.categories();
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoria') categoria?: string,
  ) {
    return this.conectores.list(user.empresaId, { categoria });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.get(user.empresaId, id);
  }

  @Post(':id/conectar')
  connect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.connect(user.empresaId, id, 'app');
  }

  @Delete(':id')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.conectores.disconnect(user.empresaId, id);
  }
}
