import { Module } from '@nestjs/common';
import { MemoriasController } from './memorias.controller';
import { MemoriasService } from './memorias.service';
import { AuthModule } from '@/auth/auth.module';
import { AcessoModule } from '@/acesso/acesso.module';

@Module({
  // `AcessoModule` pelo `RolesService`, que resolve as permissões efetivas
  // usadas para decidir se a memória pode ser corporativa.
  imports: [AuthModule, AcessoModule],
  controllers: [MemoriasController],
  providers: [MemoriasService],
  exports: [MemoriasService],
})
export class MemoriasModule {}
