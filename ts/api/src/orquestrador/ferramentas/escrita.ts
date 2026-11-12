// Ferramentas de ESCRITA do orquestrador. Nenhuma roda sem aprovação humana
// dos parâmetros exatos (ver PoliticaExecucaoService); o registro e o executor
// garantem isso — aqui fica só o efeito em si.
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RepositorioOrgService } from '@/repositorio-org/repositorio-org.service';
import { definirFerramenta, ErroFerramenta, type Ferramenta } from './ferramenta';

/** Teto do documento salvo — o mesmo da mensagem longa do chat, com folga. */
export const MAX_DOCUMENTO = 100_000;

/** Título vira nome de arquivo: sem barras nem caracteres de controle. */
export function nomeDoDocumento(titulo: string): string {
  const limpo = titulo
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.md$/i, '')
    .slice(0, 120);
  return `${limpo || 'Documento'}.md`;
}

@Injectable()
export class FerramentasEscrita {
  constructor(private readonly repositorioOrg: RepositorioOrgService) {}

  todas(): Ferramenta[] {
    return [this.salvarNoRepositorio()] as Ferramenta[];
  }

  private salvarNoRepositorio() {
    return definirFerramenta({
      nome: 'salvar_no_repositorio',
      descricao:
        'Salva um documento em Markdown no Repositório da organização, onde fica disponível para toda a organização e para a IA. ' +
        'Use só quando o usuário pedir para salvar, guardar ou registrar algo. O usuário precisa aprovar antes: ' +
        'mostre na resposta o que foi salvo, ou explique se ele negou.',
      esquema: z.object({
        titulo: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .describe('Título curto do documento (vira o nome do arquivo).'),
        conteudo: z
          .string()
          .trim()
          .min(1)
          .max(MAX_DOCUMENTO)
          .describe('O documento completo, em Markdown.'),
      }),
      risco: 'escrita_interna',
      permissao: 'documentos.enviar',
      resumir: ({ titulo, conteudo }) =>
        `Salvar "${nomeDoDocumento(titulo)}" no Repositório da organização (${conteudo.length.toLocaleString('pt-BR')} caracteres).`,
      executar: async ({ titulo, conteudo }, ctx) => {
        if (!ctx.organizacaoId) {
          throw new ErroFerramenta(
            'Não há organização ativa, então não existe Repositório da organização para salvar. Explique isso ao usuário.',
          );
        }
        const buffer = Buffer.from(conteudo, 'utf8');
        const doc = await this.repositorioOrg.enviar(
          ctx.user.empresaId,
          ctx.organizacaoId,
          ctx.user.id,
          { originalname: nomeDoDocumento(titulo), buffer, size: buffer.length },
        );
        if (doc.status === 'erro') {
          throw new ErroFerramenta(`O documento foi criado, mas com erro: ${doc.erro ?? 'desconhecido'}.`);
        }
        return { conteudo: `Documento salvo no Repositório da organização: "${doc.nome}".` };
      },
    });
  }
}
