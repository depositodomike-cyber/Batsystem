/**
 * Catálogo de permissões — lado da interface.
 *
 * Espelha `ts/api/src/acesso/permissoes.catalog.ts`, que é a autoridade de
 * VALIDAÇÃO. Este arquivo é a autoridade de TEXTO: rótulos e agrupamento que o
 * administrador lê. Mesma convenção do catálogo de conectores
 * (`app/data/conectores.ts` + `src/conectores/catalog.ts`) — ao mexer em um,
 * mexa no outro.
 *
 * As permissões estão organizadas por recurso, com verbos que um administrador
 * entende, e não por endpoint. Só existe permissão para funcionalidade que
 * existe hoje: Áreas e Cargos ainda são catálogos em código, e Notas, Insights,
 * E-mail e Slack estão desligados por feature flag.
 */

export interface Permissao {
  code: string;
  rotulo: string;
  /** Permissão exigida por esta. A UI marca/desmarca em cascata. */
  requer?: string;
}

export interface GrupoPermissoes {
  id: string;
  titulo: string;
  /** Uma linha explicando o que o grupo cobre na plataforma. */
  descricao: string;
  permissoes: Permissao[];
}

export const GRUPOS_PERMISSOES: GrupoPermissoes[] = [
  {
    id: "membros",
    titulo: "Membros",
    descricao: "Quem faz parte da organização.",
    permissoes: [
      { code: "membros.visualizar", rotulo: "Visualizar colaboradores" },
      {
        code: "membros.criar",
        rotulo: "Adicionar colaboradores",
        requer: "membros.visualizar",
      },
      {
        code: "membros.editar",
        rotulo: "Editar colaboradores",
        requer: "membros.visualizar",
      },
      {
        code: "membros.desativar",
        rotulo: "Desativar colaboradores",
        requer: "membros.visualizar",
      },
    ],
  },
  {
    id: "estrutura",
    titulo: "Estrutura",
    descricao: "Áreas, cargos e a hierarquia entre os colaboradores.",
    permissoes: [
      { code: "estrutura.visualizar", rotulo: "Visualizar estrutura" },
      {
        code: "estrutura.gerenciar",
        rotulo: "Gerenciar áreas e cargos",
        requer: "estrutura.visualizar",
      },
    ],
  },
  {
    id: "acesso",
    titulo: "Acesso",
    descricao: "Roles e o que cada uma permite fazer.",
    permissoes: [
      { code: "acesso.visualizar", rotulo: "Visualizar roles" },
      {
        code: "acesso.gerenciar",
        rotulo: "Gerenciar roles e permissões",
        requer: "acesso.visualizar",
      },
    ],
  },
  {
    id: "repositorio",
    titulo: "Repositório",
    descricao: "A pasta de notas que alimenta o contexto da IA.",
    permissoes: [
      { code: "repositorio.visualizar", rotulo: "Visualizar repositório" },
      {
        code: "repositorio.sincronizar",
        rotulo: "Sincronizar repositório",
        requer: "repositorio.visualizar",
      },
    ],
  },
  {
    id: "grafo",
    titulo: "Grafo",
    descricao: "A visualização em grafo do repositório.",
    permissoes: [{ code: "grafo.visualizar", rotulo: "Visualizar grafo" }],
  },
  {
    id: "documentos",
    titulo: "Documentos",
    descricao: "Documentos enviados e gerados na organização.",
    permissoes: [
      { code: "documentos.visualizar", rotulo: "Visualizar documentos" },
      {
        code: "documentos.enviar",
        rotulo: "Enviar documentos",
        requer: "documentos.visualizar",
      },
      {
        code: "documentos.excluir",
        rotulo: "Excluir documentos",
        requer: "documentos.visualizar",
      },
    ],
  },
  {
    id: "ia",
    titulo: "IA e Chat",
    descricao: "Conversas com a IA e geração de conteúdo.",
    permissoes: [
      { code: "ia.usar", rotulo: "Conversar com a IA" },
      {
        code: "ia.criar_conteudo",
        rotulo: "Gerar conteúdo com IA",
        requer: "ia.usar",
      },
    ],
  },
  {
    id: "conectores",
    titulo: "Conectores",
    descricao: "Integrações com as ferramentas que a empresa já usa.",
    permissoes: [
      { code: "conectores.visualizar", rotulo: "Visualizar conectores" },
      {
        code: "conectores.configurar",
        rotulo: "Configurar conectores",
        requer: "conectores.visualizar",
      },
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Preferências, chaves de IA e regras da organização.",
    permissoes: [
      { code: "configuracoes.visualizar", rotulo: "Visualizar configurações" },
      {
        code: "configuracoes.gerenciar",
        // O "code" é o valor persistido em "roles.permissoes" e não muda; o
        // rótulo passou a cobrir também as identidades visuais, que agora são
        // entidades da organização administradas em Configurações › Geral ›
        // Aparência. Mesmo movimento já feito em "estrutura.gerenciar".
        rotulo: "Gerenciar configurações, chaves de IA e identidades visuais",
        requer: "configuracoes.visualizar",
      },
    ],
  },
];

const TODAS = GRUPOS_PERMISSOES.flatMap((g) => g.permissoes);
const POR_CODE = new Map(TODAS.map((p) => [p.code, p]));

/** Total de permissões do catálogo, para o "X de Y" da interface. */
export const TOTAL_PERMISSOES = TODAS.length;

/** Rótulo de uma permissão. Código desconhecido volta como está. */
export function rotuloPermissao(code: string): string {
  return POR_CODE.get(code)?.rotulo ?? code;
}

/** Quem depende desta permissão (para desmarcar em cascata). */
function dependentesDe(code: string): string[] {
  return TODAS.filter((p) => p.requer === code).map((p) => p.code);
}

/**
 * Aplica uma marcação respeitando as dependências.
 *
 * Marcar algo traz o que ele exige; desmarcar leva embora quem dependia dele.
 * Assim a matriz nunca mostra um estado que o backend recusaria — ele também
 * normaliza, mas a interface não deve oferecer combinação impossível.
 */
export function alternarPermissao(
  atuais: string[],
  code: string,
  marcar: boolean,
): string[] {
  const conjunto = new Set(atuais);

  if (marcar) {
    conjunto.add(code);
    let requer = POR_CODE.get(code)?.requer;
    while (requer) {
      conjunto.add(requer);
      requer = POR_CODE.get(requer)?.requer;
    }
  } else {
    conjunto.delete(code);
    // Cascata: quem exigia esta permissão sai também, em qualquer profundidade.
    const fila = dependentesDe(code);
    while (fila.length > 0) {
      const dependente = fila.pop()!;
      if (!conjunto.delete(dependente)) continue;
      fila.push(...dependentesDe(dependente));
    }
  }

  // Ordem do catálogo, para a comparação com o que veio da API ser estável.
  return TODAS.filter((p) => conjunto.has(p.code)).map((p) => p.code);
}

/** Agrupa códigos por grupo do catálogo, para exibir permissões herdadas. */
export function agruparPermissoes(
  codes: string[],
): { grupo: GrupoPermissoes; concedidas: Permissao[] }[] {
  const conjunto = new Set(codes);
  return GRUPOS_PERMISSOES.map((grupo) => ({
    grupo,
    concedidas: grupo.permissoes.filter((p) => conjunto.has(p.code)),
  })).filter((g) => g.concedidas.length > 0);
}
