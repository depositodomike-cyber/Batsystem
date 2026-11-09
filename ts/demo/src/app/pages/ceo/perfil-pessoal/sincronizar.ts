// ----------------------------------------------------------------------
// Perfil Pessoal ↔ Repositório (pasta local) ↔ índice da IA ↔ Grafo.
//
// O perfil é salvo no servidor (fonte da verdade). Depois, a partir do MESMO
// clique de salvar (a File System Access API só concede escrita num gesto do
// usuário), este módulo:
//   1. grava os 7 .md de nome fixo em `Personal/Profile/` (sobrescreve);
//   2. atualiza as notas `Tags/<Item>.md` das entidades ligadas ao dono — só
//      as linhas marcadas "(Perfil Pessoal)"; o resto da nota fica intacto e
//      notas de tag nunca são apagadas (podem ter conteúdo de outras origens);
//   3. manda tudo que mudou ao índice da IA (syncVaultBatch), o mesmo pipeline
//      do Sincronizar do Grafo.
// Nada fora desses caminhos é tocado.
// ----------------------------------------------------------------------

import type { PerfilDados } from "@/services/api/perfil";
import { removerNotasPerfilDoIndiceApi } from "@/services/api/perfil";
import { syncVaultBatch, VAULT_BATCH_SIZE, type VaultNotaInput } from "@/services/api/vault";
import {
  gravarArquivoMemoria,
  lerNotaMemoria,
  removerArquivoMemoria,
  type VaultFalha,
} from "@/utils/memoriaVault";
import { invalidarNotasMemoria } from "@/components/shared/MemoriaMentions/alvos";
import { caminhoNotaDaTag } from "../grafo-relacoes";
import { TITULO_CONEXOES } from "../memoria-grafo-modelo";
import {
  ORIGEM_PERFIL,
  TODOS_OS_CAMINHOS,
  caminhoArquivo,
  entidadesDoPerfil,
  gerarArquivosPerfil,
  nomeDoDono,
} from "./markdown";

export type ResultadoRepositorio =
  | { ok: true; arquivos: number; entidades: number }
  | { ok: false; reason: VaultFalha };

class FalhaVault extends Error {
  constructor(readonly reason: VaultFalha) {
    super(reason);
  }
}

/** Entidades que a última sincronização ligou ao dono (lidas do overview.md). */
async function entidadesAnteriores(): Promise<string[]> {
  const lida = await lerNotaMemoria(caminhoArquivo("overview"));
  if (!lida.ok) return [];
  const out: string[] = [];
  const re = /^- \[\[([^\]|]+)\]\].*\(Perfil Pessoal\)\s*$/gm;
  for (const m of lida.conteudo.matchAll(re)) out.push(m[1].trim());
  return out;
}

/**
 * Troca, no bloco "🔗 Conexões no Vault", as linhas do perfil pela `linha`
 * nova (ou só as remove, com `null`). Linhas de outras origens ficam.
 */
export function substituirLinhasDoPerfil(texto: string, linha: string | null): string {
  const i = texto.indexOf(TITULO_CONEXOES);
  if (i === -1) {
    if (!linha) return texto;
    return `${texto.replace(/\s*$/, "")}\n\n${TITULO_CONEXOES}\n\n${linha}\n`;
  }
  const inicio = i + TITULO_CONEXOES.length;
  const resto = texto.slice(inicio);
  const fimRel = resto.search(/\n#{1,2} /);
  const fim = fimRel === -1 ? texto.length : inicio + fimRel;

  const linhas = texto
    .slice(inicio, fim)
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.includes(ORIGEM_PERFIL));
  if (linha) linhas.push(linha);

  const depois = texto.slice(fim).replace(/^\s+/, "");
  const bloco = linhas.length ? `\n\n${linhas.join("\n")}\n` : "\n";
  return `${texto.slice(0, inicio)}${bloco}${depois ? `\n${depois}` : ""}`;
}

/** Aplica a linha do perfil na nota da tag. Devolve a nota se mudou. */
async function atualizarNotaDaTag(
  rotulo: string,
  linha: string | null,
): Promise<VaultNotaInput | null> {
  const path = caminhoNotaDaTag(rotulo);
  const lida = await lerNotaMemoria(path);
  let texto: string;
  if (!lida.ok) {
    if (lida.reason !== "not-found") throw new FalhaVault(lida.reason);
    if (!linha) return null;
    texto =
      `---\ntítulo: ${rotulo}\n---\n\n` +
      `> Nota desta tag. As conexões abaixo foram criadas no grafo do Repositório.\n\n` +
      `${TITULO_CONEXOES}\n\n${linha}\n`;
  } else {
    texto = substituirLinhasDoPerfil(lida.conteudo, linha);
    if (texto === lida.conteudo) return null;
  }
  const g = await gravarArquivoMemoria(path, texto);
  if (!g.ok) throw new FalhaVault(g.reason);
  return { path, titulo: rotulo, conteudo: texto };
}

async function indexar(notas: VaultNotaInput[]) {
  for (let i = 0; i < notas.length; i += VAULT_BATCH_SIZE) {
    await syncVaultBatch(notas.slice(i, i + VAULT_BATCH_SIZE));
  }
  invalidarNotasMemoria();
}

/** Grava/atualiza a representação do perfil no Repositório e no índice. */
export async function sincronizarPerfilNoRepositorio(
  dados: PerfilDados,
): Promise<ResultadoRepositorio> {
  try {
    const anteriores = await entidadesAnteriores();
    const arquivos = gerarArquivosPerfil(dados);
    for (const a of arquivos) {
      const g = await gravarArquivoMemoria(a.path, a.conteudo);
      if (!g.ok) return { ok: false, reason: g.reason };
    }

    const dono = nomeDoDono(dados);
    const atuais = entidadesDoPerfil(dados);
    const linhaPor = new Map(
      atuais.map((e) => [e.rotulo.toLowerCase(), `- [[${dono}]] — ${e.relacao} ${ORIGEM_PERFIL}`]),
    );
    const rotulos = new Map<string, string>();
    for (const r of [...anteriores, ...atuais.map((e) => e.rotulo)]) {
      rotulos.set(r.toLowerCase(), r);
    }
    const tags: VaultNotaInput[] = [];
    for (const [chave, rotulo] of rotulos) {
      const nota = await atualizarNotaDaTag(rotulo, linhaPor.get(chave) ?? null);
      if (nota) tags.push(nota);
    }

    await indexar([
      ...arquivos.map((a) => ({ path: a.path, titulo: a.titulo, conteudo: a.conteudo })),
      ...tags,
    ]);
    return { ok: true, arquivos: arquivos.length, entidades: atuais.length };
  } catch (err) {
    if (err instanceof FalhaVault) return { ok: false, reason: err.reason };
    return { ok: false, reason: "error" };
  }
}

/**
 * Exclusão do perfil no Repositório: tira as linhas "(Perfil Pessoal)" das
 * notas de tag, apaga os 7 .md e remove as cópias do índice da IA.
 */
export async function excluirPerfilDoRepositorio(): Promise<ResultadoRepositorio> {
  try {
    const anteriores = await entidadesAnteriores();
    const tags: VaultNotaInput[] = [];
    for (const rotulo of anteriores) {
      const nota = await atualizarNotaDaTag(rotulo, null);
      if (nota) tags.push(nota);
    }
    for (const path of TODOS_OS_CAMINHOS) {
      const r = await removerArquivoMemoria(path);
      if (!r.ok) return { ok: false, reason: r.reason };
    }
    await removerNotasPerfilDoIndiceApi(TODOS_OS_CAMINHOS);
    if (tags.length) await indexar(tags);
    return { ok: true, arquivos: 0, entidades: 0 };
  } catch (err) {
    if (err instanceof FalhaVault) return { ok: false, reason: err.reason };
    return { ok: false, reason: "error" };
  }
}

/** Mensagem curta para cada falha de acesso à pasta. */
export function mensagemFalhaRepositorio(reason: VaultFalha): string {
  switch (reason) {
    case "no-folder":
      return "Nenhuma pasta do Repositório conectada. Conecte a pasta na tela Repositório e sincronize de novo.";
    case "denied":
      return "O navegador não liberou a escrita na pasta do Repositório.";
    case "unsupported":
      return "Este navegador não grava na pasta do Repositório (use Chrome ou Edge).";
    default:
      return "Não foi possível gravar no Repositório.";
  }
}
