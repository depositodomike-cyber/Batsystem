import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SquadsService } from './squads.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

/** Catálogo de squads (leitura). Protegido por JWT como o restante do app. */
@Controller('squads')
@UseGuards(JwtAuthGuard)
export class SquadsController {
  constructor(private readonly squads: SquadsService) {}

  /** GET /squads → catálogo leve (sem agentes/prompts). */
  @Get()
  list() {
    return this.squads.list();
  }

  /** GET /squads/:id → detalhe (agentes + perguntas iniciais). */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.squads.getById(id);
  }
}
