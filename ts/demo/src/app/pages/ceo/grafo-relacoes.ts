// ----------------------------------------------------------------------
// Relacionamentos entre tags criados pelo usuário no grafo.
//
// Todas as arestas do grafo são derivadas: `construirGrafoEntidades` recalcula
// co-ocorrência a cada carregamento, e cada Sincronizar reconstrói tudo do zero
// a partir dos .md. Uma relação criada à mão precisa, portanto, morar no VAULT —
// qualquer coisa guardada só em memória morre no próximo Sincronizar, não chega
// à IA e não existe para mais ninguém.
//
// A relação vira uma nota `Tags/<Tag>.md` com o bloco "🔗 Conexões no Vault" —
// o mesmo formato que a IA já grava em toda nota (ts/api/src/ai/conexoes-vault.ts).
// Assim ela abre no Obsidian, vai junto no Sincronizar e a tag ganha um .md
// próprio (o botão "Abrir nota" do painel passa a funcionar).
//
// A relação é gravada NAS DUAS PONTAS: abrir qualquer uma das tags mostra a
// ligação, sem depender de o construtor varrer o vault inteiro atrás dela.
// ----------------------------------------------------------------------

import {
  escreverNotaMemoria,
  lerNotaMemoria,
  nomeSeguroMemoria,
  salvarNotaMemoria,
  type VaultFalha,
} from "@/utils/memoriaVault";
import { syncVaultBatch } from "@/services/api/vault";
import { invalidarNotasMemoria } from "@/components/shared/MemoriaMentions/alvos";
import { PASTA_TAGS, TITULO_CONEXOES } from "./memoria-grafo-modelo";

/**
 * `not-found` fica de fora de propósito: nota inexistente é tratada aqui dentro
 * (criando-a, ou ignorando na remoção), nunca chega ao chamador. Assim o
 * resultado encaixa direto em `avisarFalhaAoSalvarNaMemoria`.
 */
export type FalhaRelacao = Exclude<VaultFalha, "not-found">;
export type RelacaoResult = { ok: true } | { ok: false; reason: FalhaRelacao };

/** Caminho da nota de uma tag. Usa a mesma limpeza de nome do resto do vault. */
export function caminhoNotaDaTag(label: string): string {
  return `${PASTA_TAGS}/${nomeSeguroMemoria(label)}.md`;
}

/**
 * Alvo do wikilink que representa uma tag.
 *
 * Tem de ser o nome JÁ limpo, igual ao que vira nome de arquivo — senão o link
 * aponta para um título que não existe. Mesmo cuidado de `linkDoGrupo` em
 * memoria-grupos.ts.
 */
function alvoDoLink(label: string): string {
  return nomeSeguroMemoria(label);
}

/** Corpo inicial de uma nota de tag recém-criada. */
function corpoInicial(alvo: string): string {
  return [
    `> Nota desta tag. As conexões abaixo foram criadas no grafo do Repositório.`,
    TITULO_CONEXOES,
    `- [[${alvo}]]`,
  ].join("\n\n");
}

/**
 * Linhas `- [[Alvo]]` do bloco de conexões, com o texto antes e depois.
 *
 * Tolera o ` — motivo` que a IA escreve depois do link e um bloco ausente (aí
 * `inicio` vem `-1` e o chamador acrescenta a seção no fim).
 */
export function lerBloco(texto: string): {
  antes: string;
  alvos: string[];
  depois: string;
  temBloco: boolean;
} {
  const i = texto.indexOf(TITULO_CONEXOES);
  if (i === -1) return { antes: texto, alvos: [], depois: "", temBloco: false };

  const apos = i + TITULO_CONEXOES.length;
  // O bloco vai até o próximo heading de mesmo nível ou até o fim do arquivo.
  const resto = texto.slice(apos);
  const fim = resto.search(/\n#{1,2}\s/);
  const corpo = fim === -1 ? resto : resto.slice(0, fim);

  const alvos: string[] = [];
  for (const m of corpo.matchAll(/^\s*-\s*\[\[([^\]\n|#]+)/gm)) {
    const alvo = m[1].trim();
    if (alvo) alvos.push(alvo);
  }
  return {
    antes: texto.slice(0, i),
    alvos,
    depois: fim === -1 ? "" : resto.slice(fim),
    temBloco: true,
  };
}

/** Remonta o arquivo com a lista de alvos informada. */
export function escreverBloco(
  base: { antes: string; depois: string; temBloco: boolean },
  texto: string,
  alvos: string[],
): string {
  const linhas = alvos.map((a) => `- [[${a}]]`).join("\n");
  const bloco = alvos.length ? `${TITULO_CONEXOES}\n\n${linhas}\n` : "";
  if (!base.temBloco) {
    // Sem bloco ainda: acrescenta no fim, preservando tudo que já existia.
    return `${texto.replace(/\s*$/, "")}\n\n${bloco}`;
  }
  const depois = base.depois.replace(/^\n+/, "");
  return `${base.antes}${bloco}${depois ? "\n" + depois : ""}`;
}

/**
 * Grava a lista de alvos na nota de uma tag, criando-a se ainda não existir.
 * Devolve o texto final para quem quiser mandá-lo à IA sem reler o arquivo.
 */
async function gravar(
  label: string,
  alterar: (alvos: string[]) => string[],
): Promise<
  { ok: true; path: string; texto: string } | { ok: false; reason: FalhaRelacao }
> {
  const path = caminhoNotaDaTag(label);
  const lida = await lerNotaMemoria(path);

  if (!lida.ok) {
    if (lida.reason !== "not-found") return { ok: false, reason: lida.reason };
    // Nota ainda não existe: cria com a primeira conexão já dentro.
    const alvos = alterar([]);
    if (!alvos.length) return { ok: true, path, texto: "" };
    const r = await escreverNotaMemoria({
      subpasta: PASTA_TAGS,
      titulo: label,
      conteudo: corpoInicial(alvos[0]),
    });
    if (!r.ok) return { ok: false, reason: r.reason };
    // As demais conexões (se houver) entram numa segunda passada.
    if (alvos.length > 1) return gravar(label, () => alvos);
    return { ok: true, path: `${r.pasta}/${r.arquivo}`, texto: r.texto };
  }

  const base = lerBloco(lida.conteudo);
  const alvos = alterar(base.alvos);
  const texto = escreverBloco(base, lida.conteudo, alvos);
  const salva = await salvarNotaMemoria(path, texto);
  if (!salva.ok) {
    // O arquivo existia um instante atrás: sumir agora é estado inesperado, não
    // o caso normal de "ainda não há nota".
    const reason: FalhaRelacao =
      salva.reason === "not-found" ? "error" : salva.reason;
    return { ok: false, reason };
  }
  return { ok: true, path, texto };
}

/** Manda as notas alteradas para o índice da IA, sem bloquear a interface. */
function indexar(notas: { path: string; titulo: string; conteudo: string }[]) {
  const uteis = notas.filter((n) => n.conteudo);
  if (!uteis.length) return;
  void syncVaultBatch(uteis).catch(() => undefined);
  // O autocomplete de `[[` guarda a lista de notas em cache; sem isto a nota
  // nova só apareceria lá depois de alguns minutos.
  invalidarNotasMemoria();
}

/** Tira um alvo da lista, sem diferenciar caixa. */
const remover = (alvo: string) => (alvos: string[]) =>
  alvos.filter((x) => x.toLowerCase() !== alvo.toLowerCase());

/**
 * Liga duas tags. Grava nas duas notas; se a segunda falhar, desfaz a primeira
 * para não deixar a relação existindo de um lado só.
 */
export async function criarRelacao(
  a: string,
  b: string,
): Promise<RelacaoResult> {
  const alvoA = alvoDoLink(a);
  const alvoB = alvoDoLink(b);
  if (!alvoA || !alvoB || alvoA === alvoB) return { ok: true };

  const incluir = (alvo: string) => (alvos: string[]) =>
    alvos.some((x) => x.toLowerCase() === alvo.toLowerCase())
      ? alvos
      : [...alvos, alvo];

  const ra = await gravar(a, incluir(alvoB));
  if (!ra.ok) return ra;

  const rb = await gravar(b, incluir(alvoA));
  if (!rb.ok) {
    // Volta atrás na ponta que já foi gravada.
    await gravar(a, remover(alvoB));
    return rb;
  }

  indexar([
    { path: ra.path, titulo: a, conteudo: ra.texto },
    { path: rb.path, titulo: b, conteudo: rb.texto },
  ]);
  return { ok: true };
}

/**
 * Desfaz a ligação. Uma ponta que ainda não tem nota é ignorada — não há o que
 * remover — em vez de virar erro.
 */
export async function removerRelacao(
  a: string,
  b: string,
): Promise<RelacaoResult> {
  const alvoA = alvoDoLink(a);
  const alvoB = alvoDoLink(b);

  // Uma ponta sem nota devolve ok com texto vazio (não há o que remover).
  const ra = await gravar(a, remover(alvoB));
  if (!ra.ok) return ra;

  const rb = await gravar(b, remover(alvoA));
  if (!rb.ok) return rb;

  indexar(
    [
      ra.ok ? { path: ra.path, titulo: a, conteudo: ra.texto } : null,
      rb.ok ? { path: rb.path, titulo: b, conteudo: rb.texto } : null,
    ].filter((n): n is { path: string; titulo: string; conteudo: string } => !!n),
  );
  return { ok: true };
}
