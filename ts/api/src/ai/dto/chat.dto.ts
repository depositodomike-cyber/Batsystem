import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(16_000, {
    message: 'Mensagem longa demais (máx. 16.000 caracteres).',
  })
  text!: string;
}

export class ChatStreamDto {
  @IsString()
  @MaxLength(100)
  squadId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentId?: string;

  /** Conversa existente a continuar; ausente cria uma nova. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversaId?: string;

  // Limites de tamanho contêm abuso de custo (o trial usa a nossa chave de IA).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(80, { message: 'Histórico longo demais para um único pedido.' })
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages!: ChatTurnDto[];
}
