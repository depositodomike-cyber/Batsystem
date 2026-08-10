// ----------------------------------------------------------------------
// Alvos de conexão com o Repositório — o que a lista de "[[" oferece.
//
// São duas origens, na ordem em que aparecem:
//  • Notas (.md do vault): o que desenha o grafo do Repositório. Um [[Título]] aqui
//    vira aresta no grafo, exatamente como no Obsidian.
//  • Regras (store /memorias): as memórias que a IA usa como contexto.
//
// A lista de notas é buscada UMA vez e filtrada no navegador (digitar não pode
// disparar uma requisição por tecla). Quando o filtro local devolve pouco — ou
// seja, o alvo provavelmente está fora das notas que carregamos —, aí sim
// consultamos a API com o termo digitado e completamos a lista.
// ----------------------------------------------------------------------

import { buscarNotasVault, type VaultNotaRef } from "@/services/api/vault";

export interface AlvoMemoria {
  /** Texto inserido dentro dos colchetes. */
  titulo: string;
  /** Pasta da nota ou tema da regra — contexto na lista. */
  detalhe: string;
  tipo: "nota" | "diretriz";
}

/** Quantas notas carregamos de uma vez para filtrar localmente. */
const LIMITE_CACHE = 300;
/** Quanto tempo o cache vale — o vault muda quando o usuário sincroniza. */
const VALIDADE_MS = 2 * 60 * 1000;

let cache: { em: number; alvos: AlvoMemoria[] } | null = null;
let carregando: Promise<AlvoMemoria[]> | null = null;

/** Pasta da nota ("Reuniões/2026-01.md" → "Reuniões"). */
function pastaDaNota(path: string): string {
  const partes = path.split("/").filter(Boolean);
  return partes.length > 1 ? partes[0] : "Repositório";
}

function paraAlvo(nota: VaultNotaRef): AlvoMemoria {
  return {
    titulo: nota.titulo || nota.path.replace(/\.md$/i, ""),
    detalhe: pastaDaNota(nota.path),
    tipo: "nota",
  };
}

/** Notas do vault, do cache quando ainda válido. */
export function carregarNotas(): Promise<AlvoMemoria[]> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) {
    return Promise.resolve(cache.alvos);
  }
  if (carregando) return carregando;
  carregando = buscarNotasVault("", LIMITE_CACHE)
    .then((notas) => {
      const alvos = notas.map(paraAlvo);
      cache = { em: Date.now(), alvos };
      return alvos;
    })
    .catch(() => {
      // Vault não sincronizado, offline ou sem permissão: a lista fica só com
      // as regras. Silencioso de propósito — é um autocomplete, não uma ação.
      cache = { em: Date.now(), alvos: [] };
      return [];
    })
    .finally(() => {
      carregando = null;
    });
  return carregando;
}

/** Busca no servidor por um termo que o cache local não cobriu. */
export async function buscarNotasRemoto(q: string): Promise<AlvoMemoria[]> {
  try {
    return (await buscarNotasVault(q, 30)).map(paraAlvo);
  } catch {
    return [];
  }
}

/**
 * Invalida o cache — chame depois de gravar uma nota nova no vault, para que
 * ela já apareça no próximo "[[".
 */
export function invalidarNotasMemoria() {
  cache = null;
}

// ----------------------------------------------------------------------
// Filtro
// ----------------------------------------------------------------------

/** Minúsculas e sem acento: "Reunião" e "reuniao" precisam casar. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Ordena por proximidade: título que COMEÇA com o termo vem antes do que só
 * começa uma palavra com ele, que vem antes do que apenas contém.
 */
function pontuar(titulo: string, termo: string): number {
  const t = normalizar(titulo);
  const i = t.indexOf(termo);
  if (i < 0) return -1;
  if (i === 0) return 0;
  if (/[\s\-_/]/.test(t[i - 1])) return 1;
  return 2;
}

export function filtrarAlvos(
  alvos: AlvoMemoria[],
  query: string,
  limite = 8,
): AlvoMemoria[] {
  const termo = normalizar(query.trim());
  const vistos = new Set<string>();
  const unicos = alvos.filter((a) => {
    const chave = `${a.tipo}:${normalizar(a.titulo)}`;
    if (!a.titulo.trim() || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  if (!termo) return unicos.slice(0, limite);

  return unicos
    .map((a) => ({ a, p: pontuar(a.titulo, termo) }))
    .filter((x) => x.p >= 0)
    .sort((x, y) => x.p - y.p || x.a.titulo.length - y.a.titulo.length)
    .slice(0, limite)
    .map((x) => x.a);
}
