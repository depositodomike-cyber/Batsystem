// ----------------------------------------------------------------------
// Sinal global "o Contexto está sendo consultada".
// A barra de prompt (header) liga o sinal enquanto a pergunta roda no modo
// Memória; o grafo da tela Contexto escuta e "pensa" (anima) enquanto isso —
// mesma ligação que o beculture faz com `Grafo.animar(true)` durante a busca
// no vault. Como os dois componentes vivem em árvores diferentes, o sinal
// trafega por um evento no window em vez de contexto.
// ----------------------------------------------------------------------

const EVENTO = "memoria:busca";

// Contador (e não booleano): duas buscas simultâneas — pergunta de topo e
// continuação dentro da janela — não podem desligar a animação uma da outra.
let ativas = 0;

/** Liga/desliga uma busca em andamento no Contexto. */
export function marcarBuscaMemoria(ativa: boolean): void {
  ativas = Math.max(0, ativas + (ativa ? 1 : -1));
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: ativas > 0 }));
}

/** Há alguma busca no Contexto em andamento agora? */
export function buscandoMemoria(): boolean {
  return ativas > 0;
}

/** Assina o sinal. Devolve a função de cancelamento. */
export function onBuscaMemoria(cb: (ativa: boolean) => void): () => void {
  const handler = (e: Event) => cb(!!(e as CustomEvent<boolean>).detail);
  window.addEventListener(EVENTO, handler);
  return () => window.removeEventListener(EVENTO, handler);
}
