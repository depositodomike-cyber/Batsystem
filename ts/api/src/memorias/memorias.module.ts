import { Module } from '@nestjs/common';
import { MemoriasController } from './memorias.controller';
import { MemoriasService } from './memorias.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MemoriasController],
  providers: [MemoriasService],
  exports: [MemoriasService],
})
export class MemoriasModule {}
