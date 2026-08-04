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
import { MemoriasService } from './memorias.service';
import { CreateMemoriaDto } from './dto/create-memoria.dto';
import { UpdateMemoriaDto } from './dto/update-memoria.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/current-user.decorator';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';

/**
 * Memória de longo prazo da IA, escopada à empresa (tenant) do usuário logado.
 * CRUD da página /<produto>/memoria.
 */
@Controller('memorias')
@UseGuards(JwtAuthGuard)
export class MemoriasController {
  constructor(private readonly memorias: MemoriasService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.memorias.list(user.empresaId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemoriaDto,
  ) {
    // Só admin/owner pode "fixar" (criar como definição corporativa).
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    return this.memorias.create(user.empresaId, dto, isAdmin);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemoriaDto,
  ) {
    // Memória corporativa só pode ser alterada por admin/owner.
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    return this.memorias.update(user.empresaId, id, dto, isAdmin);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    // Memória corporativa só pode ser removida por admin/owner.
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    return this.memorias.remove(user.empresaId, id, isAdmin);
  }
}
