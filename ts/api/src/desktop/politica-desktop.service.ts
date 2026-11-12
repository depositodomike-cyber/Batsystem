import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoliticaDesktop, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CATEGORIAS,
  diretorioProibido,
  FERRAMENTAS_LIMPAS,
  normalizarCaminho,
  OPERACOES,
  type Categoria,
  type PoliticaEfetiva,
} from './risco-desktop';

type Db = Prisma.TransactionClient | PrismaService;

export const ESQUEMA_POLITICA = z
  .object({
    permissoes: z.partialRecord(z.enum(CATEGORIAS), z.boolean()).optional(),
    confirmar: z.array(z.enum(Object.keys(OPERACOES) as [string, ...string[]])).max(20).optional(),
    apps: z.array(z.string().regex(/^[a-f0-9]{16,64}$/)).max(200).optional(),
    observaveis: z.array(z.string().regex(/^[a-f0-9]{16,64}$/)).max(200).optional(),
    diretorios: z.array(z.string().min(3).max(400)).max(30).optional(),
    dominios: z
      .array(z.string().trim().toLowerCase().regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Domínio inválido'))
      .max(100)
      .optional(),
    retencaoDias: z.number().int().min(1).max(3650).optional(),
    autoinicio: z.boolean().optional(),
  })
  .strict();
export type AlteracaoPolitica = z.infer<typeof ESQUEMA_POLITICA>;

export function paraEfetiva(p: PoliticaDesktop): PoliticaEfetiva {
  const perm = (p.permissoes ?? {}) as Record<string, unknown>;
  const permissoes: Partial<Record<Categoria, boolean>> = {};
  for (const c of CATEGORIAS) permissoes[c] = perm[c] === true;
  return {
    versao: p.versao,
    permissoes,
    confirmar: p.confirmar,
    apps: p.apps,
    observaveis: p.observaveis,
    diretorios: p.diretorios,
    dominios: p.dominios,
  };
}

/**
 * Permission Manager do desktop: guarda a política por usuário (SR-02: tudo
 * desligado na criação) e calcula se uma execução está "limpa" (SR-06/06c)
 * lendo o BANCO — nunca o contexto que veio do executor.
 */
@Injectable()
export class PoliticaDesktopService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(empresaId: string, usuarioId: string, db: Db = this.prisma): Promise<PoliticaDesktop> {
    return db.politicaDesktop.upsert({
      where: { empresaId_usuarioId: { empresaId, usuarioId } },
      update: {},
      create: { empresaId, usuarioId },
    });
  }

  async alterar(empresaId: string, usuarioId: string, alteracao: unknown): Promise<PoliticaDesktop> {
    const lido = ESQUEMA_POLITICA.safeParse(alteracao);
    if (!lido.success) throw new BadRequestException(z.prettifyError(lido.error));
    const a = lido.data;
    let diretorios: string[] | undefined;
    if (a.diretorios) {
      diretorios = [];
      for (const d of a.diretorios) {
        const n = normalizarCaminho(d);
        if (!n || diretorioProibido(n)) {
          throw new BadRequestException(`Diretório não permitido: ${d}. Pastas de sistema, AppData e raízes de unidade não podem ser autorizadas.`);
        }
        if (!diretorios.some((x) => x.toLowerCase() === n.toLowerCase())) diretorios.push(n);
      }
    }
    const atual = await this.obter(empresaId, usuarioId);
    return this.prisma.politicaDesktop.update({
      where: { id: atual.id },
      data: {
        versao: { increment: 1 },
        ...(a.permissoes ? { permissoes: { ...(atual.permissoes as object), ...a.permissoes } } : {}),
        ...(a.confirmar ? { confirmar: [...new Set(a.confirmar)] } : {}),
        ...(a.apps ? { apps: [...new Set(a.apps)] } : {}),
        ...(a.observaveis ? { observaveis: [...new Set(a.observaveis)] } : {}),
        ...(diretorios ? { diretorios } : {}),
        ...(a.dominios ? { dominios: [...new Set(a.dominios)] } : {}),
        ...(a.retencaoDias ? { retencaoDias: a.retencaoDias } : {}),
        ...(a.autoinicio !== undefined ? { autoinicio: a.autoinicio } : {}),
      },
    });
  }

  /**
   * SR-06/06c: limpa = sem contexto externo na criação E todas as etapas já
   * concluídas (exceto a atual) são de ferramentas da allowlist limpa.
   */
  async execucaoLimpa(
    db: Db,
    execucaoId: string,
    etapaAtualId: string,
  ): Promise<{ limpa: boolean; vozAtivacao: boolean } | null> {
    const exec = await db.execucao.findUnique({
      where: { id: execucaoId },
      select: { contextoExterno: true, origem: true, etapas: { select: { id: true, status: true, ferramenta: true } } },
    });
    if (!exec) return null;
    const sujas = exec.etapas.filter(
      (e) => e.id !== etapaAtualId && e.status === 'concluida' && !(e.ferramenta && FERRAMENTAS_LIMPAS.has(e.ferramenta)),
    );
    return { limpa: !exec.contextoExterno && sujas.length === 0, vozAtivacao: exec.origem === 'voz_ativacao' };
  }
}
