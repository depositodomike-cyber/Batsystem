import { Module } from '@nestjs/common';
import { CriacoesController } from './criacoes.controller';
import { CriacoesService } from './criacoes.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CriacoesController],
  providers: [CriacoesService],
  exports: [CriacoesService],
})
export class CriacoesModule {}
