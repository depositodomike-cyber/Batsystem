import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** O front envia o e-mail no campo `username`. */
  @IsString()
  @IsNotEmpty({ message: 'Informe o e-mail.' })
  @MaxLength(254)
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(128)
  password!: string;
}
