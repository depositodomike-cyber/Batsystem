import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
} from 'class-validator';
import type { UserRole } from '@prisma/client';

export class ConvidarDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50, { message: 'Envie no máximo 50 e-mails por vez.' })
  @IsEmail({}, { each: true, message: 'Há um e-mail inválido na lista.' })
  emails!: string[];

  /** Papel do convidado. `owner` não pode ser atribuído via convite. */
  @IsOptional()
  @IsIn(['admin', 'membro'])
  role?: UserRole;
}
