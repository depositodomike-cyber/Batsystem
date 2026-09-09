// Import Dependencies
import type { Membro } from "@/services/api/membros";

// ----------------------------------------------------------------------
// Gestores indiretos: a segunda relação de gestão de um membro.
//
// Este arquivo é para os indiretos o que `hierarquia-membros.ts` é para o
// gestor direto — só que muito menor, e de propósito: a relação direta precisa
// de árvore, descendentes e prevenção de ciclo porque DEFINE posição. A
// indireta não define nada, então não há o que derivar dela além das arestas
// que o organograma desenha.
// ----------------------------------------------------------------------

/**
 * Teto de gestores indiretos por membro, espelhando `MAX_GESTORES_INDIRETOS`
 * do backend (`ts/api/src/membros/membros.constants.ts`).
 *
 * Duplicado porque front e API não compartilham código. O backend continua
 * sendo quem decide — aqui o número só evita oferecer uma escolha que a API
 * recusaria, e um desencontro entre os dois vira um 400 legível, não um estado
 * inválido salvo.
 */
export const MAX_GESTORES_INDIRETOS = 5;

/** Uma conexão indireta a desenhar: `de` acompanha `para`. */
export interface ConexaoIndireta {
  /** Quem é o gestor indireto. */
  deId: string;
  /** Quem é acompanhado. */
  paraId: string;
}

/**
 * Todas as conexões indiretas dos membros carregados, já saneadas para desenho.
 *
 * Pura e sem DOM: a geometria é problema de quem desenha. Quatro descartes, e
 * cada um corresponde a um jeito de o organograma ficar errado:
 *
 * 1. **Auto-laço.** O backend já recusa, mas um dado antigo ou uma resposta
 *    manipulada renderizariam uma curva saindo e voltando ao mesmo card.
 *
 * 2. **O par que o gestor DIRETO já expressa.** Se G é gestor indireto de M e
 *    também o direto, a linha sólida da árvore já diz isso — a tracejada
 *    ficaria colada nela, dobrando a informação e desfazendo justamente a
 *    distinção visual entre as duas relações. O backend impede o par, e este
 *    filtro é a rede: um registro anterior ao reparo do `aplicarRealocacao`
 *    ainda pode existir num banco que não passou por ele.
 *
 * 3. **Ponta ausente da lista.** A tela pode receber uma lista filtrada; uma
 *    aresta para alguém que não está nela não tem card onde terminar.
 *
 * 4. **Duplicata.** Não deveria existir (a unique do banco cobre), mas duas
 *    curvas idênticas sobrepostas ficam com o dobro da opacidade — e a "menor
 *    ênfase" da relação secundária depende exatamente dessa opacidade.
 *
 * A ordem é estável por (deId, paraId), e não a de chegada: ela vira `key` de
 * React e entra na comparação que decide se as arestas medidas mudaram. Uma
 * ordem que oscilasse faria a medição reescrever estado a cada render.
 */
export function conexoesIndiretas(membros: Membro[]): ConexaoIndireta[] {
  const existe = new Set(membros.map((m) => m.id));
  const vistas = new Set<string>();
  const saida: ConexaoIndireta[] = [];

  for (const m of membros) {
    for (const deId of m.gestorIndiretoIds) {
      if (deId === m.id) continue;
      if (deId === m.gestorId) continue;
      if (!existe.has(deId)) continue;
      const chave = `${deId}>${m.id}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      saida.push({ deId, paraId: m.id });
    }
  }

  return saida.sort(
    (a, b) => a.deId.localeCompare(b.deId) || a.paraId.localeCompare(b.paraId),
  );
}
