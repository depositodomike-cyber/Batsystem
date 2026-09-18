import type { Marca } from '@prisma/client';
import type { SalvarMarcaDto } from './dto/salvar-marca.dto';

/**
 * Marca no formato que o front consome (ts/demo/src/services/api/marcas.ts).
 *
 * `ds` é o DesignSystem completo, com os logos REMONTADOS dentro de `logos`: a
 * separação em colunas é decisão de armazenamento, e vazá-la para o payload
 * obrigaria o front a montar o objeto antes de entregá-lo ao editor.
 *
 * O `nome` da coluna NÃO é reenviado à parte: o front lê `ds.marca.nome`, e dois
 * nomes no mesmo payload seriam duas fontes de verdade para o mesmo dado.
 */
export interface MarcaPublica {
  id: string;
  empresaId: string;
  ds: SalvarMarcaDto;
  criadoEm: string;
  atualizadoEm: string;
}

export function toMarcaPublica(marca: Marca): MarcaPublica {
  const conteudo = marca.conteudo as unknown as Omit<SalvarMarcaDto, 'logos'>;

  return {
    id: marca.id,
    empresaId: marca.empresaId,
    ds: {
      ...conteudo,
      logos: {
        claro: marca.logoClaro ?? '',
        escuro: marca.logoEscuro ?? '',
      },
    },
    criadoEm: marca.criadoEm.toISOString(),
    atualizadoEm: marca.atualizadoEm.toISOString(),
  };
}
