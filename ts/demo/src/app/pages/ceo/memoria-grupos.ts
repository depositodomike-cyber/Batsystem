// ----------------------------------------------------------------------
// Pasta do Repositório de cada grupo (agrupamento) — fonte única de verdade.
//
// Regra do produto: todo grupo criado ganha uma pasta própria na Pasta da
// Memória. A partir daí, toda conversa do grupo vira um .md em
// "<Grupo>/Conversas" e todo documento salvo no grupo vira um .md em
// "<Grupo>/Documentos".
//
// O grafo (MemoriaGrafo) usa o PRIMEIRO segmento do caminho como "pasta" do nó,
// então cada grupo aparece como um hub de pasta próprio, com cor própria. A
// nota-índice do grupo ("<Grupo>/<Grupo>.md") guarda instruções e fontes, e as
// notas de conversa/documento apontam para ela via [[wikilink]] — é isso que
// desenha as arestas do grupo no grafo.
// ----------------------------------------------------------------------

import { toast } from "sonner";

import {
  criarPastaMemoria,
  escreverNotaMemoria,
  nomeSeguroMemoria,
  type AnexoMemoria,
  type WriteResult,
} from "@/utils/memoriaVault";

type FalhaMemoria = Extract<WriteResult, { ok: false }>["reason"];

export const SUBPASTA_CONVERSAS = "Conversas";
export const SUBPASTA_DOCUMENTOS = "Documentos";

/** Pasta do grupo dentro da Pasta do Repositório (mesma limpeza dos nomes de nota). */
export function pastaDoGrupo(titulo: string): string {
  return nomeSeguroMemoria(titulo);
}

/** Caminho da subpasta de conversas do grupo. */
export function pastaConversasDoGrupo(titulo: string): string {
  return `${pastaDoGrupo(titulo)}/${SUBPASTA_CONVERSAS}`;
}

/** Caminho da subpasta de documentos do grupo. */
export function pastaDocumentosDoGrupo(titulo: string): string {
  return `${pastaDoGrupo(titulo)}/${SUBPASTA_DOCUMENTOS}`;
}

/** Link para a nota-índice do grupo — usado no corpo de conversas/documentos. */
function linkDoGrupo(titulo: string): string {
  return `[[${pastaDoGrupo(titulo)}]]`;
}

// ----------------------------------------------------------------------

export interface GrupoMemoria {
  titulo: string;
  instrucoes?: string;
  /** Nomes legíveis dos conectores escolhidos como fonte. */
  conectores?: string[];
  links?: string[];
  arquivos?: string[];
}

function secao(titulo: string, itens: string[]): string {
  if (itens.length === 0) return "";
  return `## ${titulo}\n\n${itens.map((i) => `- ${i}`).join("\n")}`;
}

function notaIndice(grupo: GrupoMemoria): string {
  return [
    grupo.instrucoes?.trim()
      ? `## Instruções\n\n${grupo.instrucoes.trim()}`
      : "",
    secao("Conectores", grupo.conectores ?? []),
    secao("Links", grupo.links ?? []),
    secao("Arquivos", grupo.arquivos ?? []),
    `As conversas deste grupo ficam em \`${SUBPASTA_CONVERSAS}/\` e os documentos em \`${SUBPASTA_DOCUMENTOS}/\`.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Cria a pasta do grupo (com as subpastas de conversas e documentos) e grava a
 * nota-índice. Chamado no clique de "Criar grupo" — a permissão de escrita só é
 * concedida a partir de um gesto do usuário.
 */
export async function criarPastaDoGrupo(
  grupo: GrupoMemoria,
): Promise<WriteResult> {
  const pasta = pastaDoGrupo(grupo.titulo);

  const base = await criarPastaMemoria(pasta);
  if (!base.ok) {
    // `not-found` só existe para leitura de arquivo; aqui vira erro genérico.
    return {
      ok: false,
      reason: base.reason === "not-found" ? "error" : base.reason,
    };
  }
  // Subpastas nascem junto para o grupo já aparecer organizado no vault.
  await criarPastaMemoria(pastaConversasDoGrupo(grupo.titulo));
  await criarPastaMemoria(pastaDocumentosDoGrupo(grupo.titulo));

  return escreverNotaMemoria({
    subpasta: pasta,
    titulo: grupo.titulo,
    tags: ["grupo"],
    conteudo: notaIndice(grupo),
  });
}

// ----------------------------------------------------------------------

export interface MensagemConversa {
  role: "user" | "assistant";
  text: string;
}

/**
 * Grava (ou regrava) a conversa do grupo como .md em "<Grupo>/Conversas".
 * O arquivo tem o nome da conversa, então cada turno sobrescreve a mesma nota e
 * o .md reflete sempre a conversa inteira.
 */
export async function salvarConversaNoGrupo(opts: {
  grupo: string;
  titulo: string;
  mensagens: MensagemConversa[];
  /** Quem responde (agente/squad) — usado no rótulo das falas do assistente. */
  autor?: string;
  tags?: string[];
}): Promise<WriteResult> {
  const autor = opts.autor?.trim() || "Assistente";
  const corpo = opts.mensagens
    .filter((m) => m.text.trim())
    .map((m) => `**${m.role === "user" ? "Você" : autor}:**\n\n${m.text.trim()}`)
    .join("\n\n---\n\n");

  return escreverNotaMemoria({
    subpasta: pastaConversasDoGrupo(opts.grupo),
    titulo: opts.titulo,
    tags: ["conversa", ...(opts.tags ?? [])],
    conteudo: `Grupo: ${linkDoGrupo(opts.grupo)}\n\n${corpo}`,
  });
}

/**
 * Feedback padrão de falha ao gravar na Pasta do Repositório. Navegador sem suporte
 * é silencioso — não é erro do usuário e nada no app depende disso.
 */
export function avisarFalhaMemoria(reason: FalhaMemoria) {
  if (reason === "unsupported") return;
  if (reason === "no-folder") {
    toast("Nenhuma pasta do Repositório definida", {
      description:
        "Defina a pasta em Repositório (ou Configurações) para o grupo ter pasta própria.",
    });
    return;
  }
  if (reason === "denied") {
    toast("Permissão negada", {
      description: "É preciso autorizar a escrita na pasta do Repositório.",
    });
    return;
  }
  toast("Não foi possível gravar na pasta do Repositório", {
    description: "Tente novamente.",
  });
}

/**
 * Grava um documento salvo no grupo como .md em "<Grupo>/Documentos". Arquivos
 * gerados junto (imagem, MP4, painel .html) vão na mesma subpasta e ficam
 * embutidos na nota — mesma mecânica do "Salvar na memória".
 */
export async function salvarDocumentoNoGrupo(opts: {
  grupo: string;
  titulo: string;
  conteudo: string;
  /** Origem do documento (squad, agente ou ação do AI Studio), quando houver. */
  origem?: string;
  anexos?: AnexoMemoria[];
  tags?: string[];
}): Promise<WriteResult> {
  const cabecalho = [
    `Grupo: ${linkDoGrupo(opts.grupo)}`,
    opts.origem?.trim() ? `Origem: ${opts.origem.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return escreverNotaMemoria({
    subpasta: pastaDocumentosDoGrupo(opts.grupo),
    titulo: opts.titulo,
    tags: ["documento", ...(opts.tags ?? [])],
    anexos: opts.anexos,
    conteudo: `${cabecalho}\n\n${opts.conteudo.trim()}`,
  });
}
