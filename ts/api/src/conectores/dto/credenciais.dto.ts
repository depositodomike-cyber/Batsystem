import { IsObject } from 'class-validator';

/**
 * Credenciais de um conector, no formato { idDoCampo: valor }.
 *
 * O ValidationPipe só garante aqui que veio um objeto: os ids de campo variam
 * por conector e ele não os conhece. A conferência real — ids contra
 * `credenciais-spec.ts`, tipo e tamanho de cada valor, obrigatórios presentes —
 * fica em `ConectoresService.salvarCredenciais`, que é também o único ponto por
 * onde as credenciais entram.
 */
export class SalvarCredenciaisDto {
  @IsObject({ message: 'Envie um objeto { campo: valor }.' })
  campos!: Record<string, string>;
}
