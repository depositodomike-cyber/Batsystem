import type { Membro } from "@/services/api/membros";

// ----------------------------------------------------------------------
// Hierarquia derivada das relações de Gestor direto.
//
// A única relação persistida é `membro.gestorId`. Tudo aqui — equipe direta,
// árvore, cadeia acima, descendentes — é calculado a partir dela. Não existe
// nível armazenado nem cadastro de subordinados, então não há dado espelhado
// que possa divergir das relações.
//
// Cargo e Área não participam: cargo é posição profissional, área é contexto
// organizacional. Dois gerentes podem estar em cadeias completamente
// diferentes, e uma área pode conter várias raízes.
// ----------------------------------------------------------------------

export interface NoHierarquia {
  membro: Membro;
  /** Profundidade a partir da raiz (0 = topo). Derivada, nunca persistida. */
  nivel: number;
  filhos: NoHierarquia[];
}

/** Índice id → membro. */
function indexarPorId(membros: Membro[]): Map<string, Membro> {
  return new Map(membros.map((m) => [m.id, m]));
}

/** Equipe direta: quem aponta este membro como gestor. Ordem da lista recebida. */
export function equipeDireta(membros: Membro[], gestorId: string): Membro[] {
  return membros.filter((m) => m.gestorId === gestorId);
}

/**
 * Monta a floresta a partir das relações.
 *
 * Raiz é quem não tem gestor OU cujo gestor não está na lista recebida (pode
 * acontecer se a lista vier filtrada) — assim ninguém desaparece da árvore.
 *
 * Ciclos pré-existentes no banco (a API os impede, mas um dado legado poderia
 * tê-los) não travam nada: quem participa de um ciclo nunca é alcançado a
 * partir de uma raiz, então é devolvido em `foraDaArvore` para a tela poder
 * mostrar em vez de silenciar.
 */
export function montarHierarquia(membros: Membro[]): {
  raizes: NoHierarquia[];
  foraDaArvore: Membro[];
} {
  const porId = indexarPorId(membros);

  const filhosPorGestor = new Map<string, Membro[]>();
  const raizesDiretas: Membro[] = [];

  for (const m of membros) {
    const gestorNaLista = m.gestorId != null && porId.has(m.gestorId);
    if (!gestorNaLista) {
      raizesDiretas.push(m);
      continue;
    }
    const irmaos = filhosPorGestor.get(m.gestorId!) ?? [];
    irmaos.push(m);
    filhosPorGestor.set(m.gestorId!, irmaos);
  }

  const alcancados = new Set<string>();

  const construir = (membro: Membro, nivel: number): NoHierarquia => {
    alcancados.add(membro.id);
    const filhos = (filhosPorGestor.get(membro.id) ?? [])
      // Guarda contra ciclo: um filho já alcançado nesta descida voltaria aqui.
      .filter((f) => !alcancados.has(f.id))
      .map((f) => construir(f, nivel + 1));
    return { membro, nivel, filhos };
  };

  const raizes = raizesDiretas.map((m) => construir(m, 0));
  const foraDaArvore = membros.filter((m) => !alcancados.has(m.id));

  return { raizes, foraDaArvore };
}

/**
 * Ids de todos os descendentes de um membro (equipe direta + indireta).
 *
 * É o que responde "quem está abaixo de Michael?" e, na V3+, vai alimentar o
 * escopo "Minha equipe". A V2 só o usa para impedir ciclos no seletor de gestor.
 */
export function descendentes(membros: Membro[], raizId: string): Set<string> {
  const filhosPorGestor = new Map<string, Membro[]>();
  for (const m of membros) {
    if (m.gestorId == null) continue;
    const irmaos = filhosPorGestor.get(m.gestorId) ?? [];
    irmaos.push(m);
    filhosPorGestor.set(m.gestorId, irmaos);
  }

  const encontrados = new Set<string>();
  const fila = [raizId];
  while (fila.length > 0) {
    const atual = fila.pop()!;
    for (const filho of filhosPorGestor.get(atual) ?? []) {
      if (encontrados.has(filho.id)) continue; // ciclo legado
      encontrados.add(filho.id);
      fila.push(filho.id);
    }
  }
  return encontrados;
}

/**
 * Topos do ORGANOGRAMA: raízes que têm gente abaixo.
 *
 * O desenho de cima para baixo trata "topo" como quem lidera alguém, e não
 * como quem apenas não tem gestor cadastrado. Uma raiz sem filhos não é o topo
 * de nada — é alguém ainda desconectado da estrutura.
 */
export function raizesComEquipe(raizes: NoHierarquia[]): NoHierarquia[] {
  return raizes.filter((r) => r.filhos.length > 0);
}

/**
 * Quem não está ligado a ninguém: sem gestor E sem subordinados.
 *
 * Fica fora do organograma (não há aresta que o justifique), mas é devolvido
 * para a tela poder dizer quantos são — mesma razão de `foraDaArvore` existir:
 * silenciar quem ficou de fora seria pior do que mostrar.
 */
export function isolados(raizes: NoHierarquia[]): Membro[] {
  return raizes.filter((r) => r.filhos.length === 0).map((r) => r.membro);
}

/**
 * Total de descendentes de cada nó (equipe direta + indireta), numa única
 * passagem pós-ordem sobre a floresta já montada.
 *
 * Existe para o organograma não chamar `descendentes()` por card — seria O(n)
 * a cada card, O(n²) por render. A contagem aqui é a da ÁRVORE: quem caiu em
 * `foraDaArvore` não conta para ninguém, que é exatamente o que a tela desenha.
 */
export function contarDescendentes(
  raizes: NoHierarquia[],
): Map<string, number> {
  const total = new Map<string, number>();

  const visitar = (no: NoHierarquia): number => {
    let soma = 0;
    for (const filho of no.filhos) soma += 1 + visitar(filho);
    total.set(no.membro.id, soma);
    return soma;
  };

  for (const raiz of raizes) visitar(raiz);
  return total;
}

/**
 * Candidatos válidos a gestor de um membro.
 *
 * Exclui o próprio membro (Regra 02) e todos os seus descendentes (Regra 04),
 * para o seletor nem oferecer uma escolha que o backend recusaria. O backend
 * valida de novo — esta é a camada de UI, não a de garantia.
 *
 * `membroId` nulo = criação: ninguém está abaixo de quem ainda não existe.
 */
export function gestoresElegiveis(
  membros: Membro[],
  membroId: string | null,
): Membro[] {
  if (membroId == null) return membros;
  const abaixo = descendentes(membros, membroId);
  return membros.filter((m) => m.id !== membroId && !abaixo.has(m.id));
}
