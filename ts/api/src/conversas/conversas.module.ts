import { Module } from '@nestjs/common';
import { ConversasController } from './conversas.controller';
import { ConversasService } from './conversas.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConversasController],
  providers: [ConversasService],
  exports: [ConversasService],
})
export class ConversasModule {}
