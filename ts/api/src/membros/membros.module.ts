import { Module } from '@nestjs/common';
import { MembrosController } from './membros.controller';
import { MembrosService } from './membros.service';
import { AuthModule } from '@/auth/auth.module';
import { AcessoModule } from '@/acesso/acesso.module';

@Module({
  // AcessoModule entra por causa do PermissoesGuard usado nas rotas de
  // escrita: ele depende do RolesService para ler as permissões da role.
  imports: [AuthModule, AcessoModule],
  controllers: [MembrosController],
  providers: [MembrosService],
  exports: [MembrosService],
})
export class MembrosModule {}
