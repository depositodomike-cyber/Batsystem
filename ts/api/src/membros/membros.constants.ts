// ----------------------------------------------------------------------
// Constantes do módulo de Membros.
//
// Módulo FOLHA de propósito: não importa nada. É isso que permite ao DTO e ao
// service compartilharem o mesmo número sem ciclo — o service importa o DTO,
// então um `import` na direção contrária fecharia o laço.
//
// `MAX_ROLES_POR_MEMBRO` NÃO mora aqui, e não deve migrar para cá: ele vive em
// `acesso/permissoes.catalog.ts` porque role é conceito de acesso. Gestor
// indireto não é — e pôr a constante dele junto das de acesso seria o primeiro
// passo para alguém concluir que a relação concede algo.
// ----------------------------------------------------------------------

/**
 * Teto de gestores indiretos por membro.
 *
 * Diferente do teto de roles, que é decisão de produto (duas roles, sem
 * prioridade): aqui a relação é múltipla por definição, e o número existe como
 * guarda — de payload na resposta de membros, e de legibilidade no organograma,
 * onde cada vínculo é uma linha a mais sobre os mesmos nós.
 *
 * Aplicado em dois lugares, e os dois são necessários: `@ArrayMaxSize` no DTO
 * é a primeira barreira, e `resolverGestoresIndiretos` aplica o teto real
 * DEPOIS do dedupe — `["A","A","A","A","A","A"]` são seis ids para o decorator
 * e um vínculo para o banco.
 */
export const MAX_GESTORES_INDIRETOS = 5;
