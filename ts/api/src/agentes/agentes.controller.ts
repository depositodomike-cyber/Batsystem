import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AgentesService } from './agentes.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

class SalvarAgenteDto {
  @IsString()
  @MinLength(1, { message: 'Informe o nome do agente.' })
  @MaxLength(80, { message: 'O nome pode ter até 80 caracteres.' })
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(41)
  mencao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'A descrição pode ter até 500 caracteres.' })
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000, { message: 'As instruções podem ter até 8000 caracteres.' })
  instrucoes?: string;

  /** Chave do ícone do avatar (ex.: "agente:lampada"); null = iniciais. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icone?: string | null;
}

/**
 * Agentes mencionáveis no Assistente (@menção). GET devolve os do sistema e
 * os do usuário; as escritas valem só para os agentes do PRÓPRIO usuário
 * (empresa e usuário vêm do JWT, nunca do cliente).
 */
@Controller('agentes')
@UseGuards(JwtAuthGuard)
export class AgentesController {
  constructor(private readonly agentes: AgentesService) {}

  @Get()
  async listar(@CurrentUser() user: AuthenticatedUser) {
    const [sistema, meus] = await Promise.all([
      this.agentes.sistema(),
      this.agentes.meus(user.empresaId, user.id),
    ]);
    return { sistema, meus };
  }

  @Post()
  criar(@CurrentUser() user: AuthenticatedUser, @Body() body: SalvarAgenteDto) {
    return this.agentes.criar(user.empresaId, user.id, body);
  }

  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SalvarAgenteDto,
  ) {
    return this.agentes.atualizar(user.empresaId, user.id, id, body);
  }

  @Delete(':id')
  excluir(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentes.excluir(user.empresaId, user.id, id);
  }
}
