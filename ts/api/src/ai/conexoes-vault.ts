// Bloco "## 🔗 Conexões no Vault" — obrigatório no final de todo conteúdo que o
// usuário pode salvar na Memória (artigo, texto melhorado, resposta de squad,
// busca, análise, ata, documento).
//
// A Memória do usuário é um vault de arquivos .md (Obsidian): a ligação entre as
// notas é feita com [[wikilinks]], e é ela que forma o grafo da tela Memória.
// Sem esse bloco, cada nota gravada pela IA entra no vault como um nó solto.
// Por isso a regra vai no SYSTEM de cada ação e a lista de títulos que já
// existem no vault (VaultService) vai no prompt do usuário — o link só resolve
// quando o título é copiado exatamente como está no arquivo.

/** Cabeçalho exato do bloco (usado nos prompts e ao montar a nota no cliente). */
export const TITULO_CONEXOES_VAULT = '## 🔗 Conexões no Vault';

const COMO_MONTAR = `- De 3 a 7 links, do mais relevante para o menos.
- Uma linha por conexão, no formato: "- [[Assunto]] — por que este conteúdo se liga a ele (uma frase curta)". Só o alvo do link fica entre [[ ]]; o motivo vem depois do " — ".
- Use PREFERENCIALMENTE os títulos da lista "TÍTULOS DA MEMÓRIA (VAULT)", copiados EXATAMENTE como aparecem (acentos, maiúsculas e pontuação) — no Obsidian o link só resolve com o título idêntico.
- Se a lista não cobrir os assuntos centrais deste conteúdo, crie no máximo 2 links novos (um conceito, projeto, pessoa, decisão ou métrica que este conteúdo introduz) e termine a linha com " (novo)".
- Nunca deixe o bloco vazio, nunca repita o mesmo alvo e nunca use ![[ ]] (essa forma é para anexos).
- Não afirme que uma nota existe: título que não está na lista é sempre "(novo)".`;

const EXEMPLO = `${TITULO_CONEXOES_VAULT}

- [[Planejamento 2026]] — as metas citadas aqui saem desse plano
- [[Reunião de diretoria — 12/03]] — decisão que originou este conteúdo
- [[Custo de aquisição]] (novo) — métrica central deste texto, ainda sem nota própria`;

/**
 * Regra para respostas que JÁ SÃO Markdown (análise, busca, squad, ata).
 * O bloco é a última coisa da resposta.
 */
export const REGRA_CONEXOES_VAULT = `

REGRA OBRIGATÓRIA — CONEXÕES NO VAULT
Termine SEMPRE a resposta com um bloco final de conexões, exatamente com este cabeçalho:

${EXEMPLO}

Como montar o bloco:
${COMO_MONTAR}`;

/**
 * Variante para respostas em JSON cujo campo de texto é a nota inteira
 * (ata, documento): o bloco entra no fim do Markdown daquele campo.
 */
export function regraConexoesVaultJson(campo: string): string {
  return `${REGRA_CONEXOES_VAULT}

O bloco entra DENTRO do campo "${campo}" do JSON, no fim do Markdown — nunca fora do JSON.`;
}

// ---------------------------------------------------------------------------
// Variante ATA / REUNIÃO — conexões focadas em ENTIDADES.
//
// Numa ata, o grafo da Memória só fica útil quando a nota da reunião se liga às
// ENTIDADES concretas que ela cita — não a temas soltos. Por isso as conexões de
// uma ata apontam PRINCIPALMENTE (mas não só) para pessoas, sistemas, reuniões e
// notas. E, ao contrário da regra geral (teto de 2 links novos), aqui o modelo
// pode criar um "(novo)" para CADA entidade citada que ainda não tem nota — sem
// isso a ata sai quase sem conexões, porque participantes/sistemas mencionados
// raramente já existem no vault.
// ---------------------------------------------------------------------------

/** Ordem de prioridade dos alvos de conexão de uma ata. Reusável nos prompts. */
export const FOCO_ENTIDADES_ATA = `As conexões devem apontar PRINCIPALMENTE (mas não só) para as ENTIDADES concretas citadas, nesta ordem de prioridade:
1. 👤 Pessoas — cada participante e cada pessoa mencionada (ex.: [[Ana Souza]]).
2. 🧩 Sistemas e ferramentas — produtos, plataformas, integrações e áreas citadas (ex.: [[Pipedrive]], [[Slack]]).
3. 🗓️ Reuniões — encontros anteriores ou relacionados a que esta reunião faz referência.
4. 📝 Notas e temas — projetos, decisões, métricas e documentos relacionados.`;

const COMO_MONTAR_ATA = `${FOCO_ENTIDADES_ATA}
- Cubra TODAS as pessoas e os sistemas centrais da reunião; acrescente reuniões e notas relacionadas quando houver. Normalmente são de 4 a 10 links, do mais relevante para o menos.
- Uma linha por conexão, no formato: "- [[Alvo]] — por que a reunião se liga a ele (uma frase curta)". Só o alvo fica entre [[ ]]; o motivo vem depois do " — ".
- Use PREFERENCIALMENTE os títulos da lista "TÍTULOS DA MEMÓRIA (VAULT)", copiados EXATAMENTE (acentos, maiúsculas e pontuação) — no Obsidian o link só resolve com o título idêntico.
- Quando a entidade (pessoa, sistema, reunião ou nota) NÃO estiver na lista, crie o link mesmo assim e termine a linha com " (novo)". Aqui NÃO vale o teto de 2 links novos: o importante é conectar todas as entidades concretas da reunião.
- Nunca deixe o bloco vazio, nunca repita o mesmo alvo e nunca use ![[ ]] (essa forma é para anexos).`;

const EXEMPLO_ATA = `${TITULO_CONEXOES_VAULT}

- [[Ana Souza]] — conduziu a decisão sobre o roadmap
- [[Pipedrive]] — sistema central da integração discutida
- [[Reunião de diretoria — 12/03]] — reunião anterior que originou a pauta
- [[Planejamento 2026]] — plano de onde saíram as metas citadas
- [[Custo de aquisição]] (novo) — métrica central desta reunião, ainda sem nota própria`;

/** Regra de conexões para atas/reuniões (Markdown puro). Bloco final da nota. */
export const REGRA_CONEXOES_VAULT_ATA = `

REGRA OBRIGATÓRIA — CONEXÕES NO VAULT
Termine SEMPRE a nota com um bloco final de conexões, exatamente com este cabeçalho:

${EXEMPLO_ATA}

Como montar o bloco:
${COMO_MONTAR_ATA}`;

/** Variante ata para respostas em JSON cujo campo de texto é a nota inteira. */
export function regraConexoesVaultAtaJson(campo: string): string {
  return `${REGRA_CONEXOES_VAULT_ATA}

O bloco entra DENTRO do campo "${campo}" do JSON, no fim do Markdown — nunca fora do JSON.`;
}

/**
 * Variante para respostas em JSON com um campo PRÓPRIO para o bloco (artigo,
 * melhorar): o conteúdo entregue ao usuário fica limpo e o bloco é anexado à
 * nota na hora de salvar na Memória.
 */
export function regraConexoesVaultCampo(campo: string): string {
  return `

REGRA OBRIGATÓRIA — CONEXÕES NO VAULT
Além dos demais campos, preencha SEMPRE o campo "${campo}" do JSON com um bloco de conexões, exatamente neste formato (o cabeçalho faz parte do campo):

${EXEMPLO}

Como montar o bloco:
${COMO_MONTAR}`;
}

/**
 * Separa o bloco de conexões do corpo do Markdown. Usado nas ações que têm campo
 * próprio para o bloco (artigo, melhorar): mesmo instruído, o modelo às vezes
 * devolve o bloco dentro do texto — aqui ele volta para o campo certo em vez de
 * aparecer duas vezes na nota.
 */
export function separarConexoes(markdown: string): {
  corpo: string;
  conexoes: string;
} {
  const txt = (markdown || '').trim();
  const i = txt.search(/^#{1,3}\s*(?:🔗\s*)?Conex[õo]es no Vault\s*$/im);
  if (i < 0) return { corpo: txt, conexoes: '' };
  return { corpo: txt.slice(0, i).trim(), conexoes: txt.slice(i).trim() };
}

/** Normaliza o bloco: garante o cabeçalho padrão e devolve '' quando não há itens. */
export function normalizarConexoes(bloco: string): string {
  const txt = (bloco || '').trim();
  if (!txt) return '';
  const { conexoes } = separarConexoes(txt);
  const corpo = (conexoes || txt)
    .replace(/^#{1,3}\s*(?:🔗\s*)?Conex[õo]es no Vault\s*$/im, '')
    .trim();
  if (!corpo || !corpo.includes('[[')) return '';
  return `${TITULO_CONEXOES_VAULT}\n\n${corpo}`;
}

/**
 * Lista de títulos que já existem no vault, para o prompt do usuário. Sem
 * títulos (vault ainda não sincronizado), o modelo é instruído a criar apenas
 * links "(novo)" — o bloco nunca sai vazio.
 */
export function blocoTitulosVault(titulos: string[], limite = 60): string {
  const lista = [...new Set(titulos.map((t) => t.trim()).filter(Boolean))].slice(0, limite);
  if (!lista.length) {
    return `\n## TÍTULOS DA MEMÓRIA (VAULT)\n(Nenhuma nota sincronizada. Monte o bloco de Conexões apenas com os assuntos centrais deste conteúdo, marcados com "(novo)".)\n`;
  }
  return (
    `\n## TÍTULOS DA MEMÓRIA (VAULT)\n` +
    `Notas que já existem na Memória do usuário. Use estes títulos, copiados exatamente, nos [[wikilinks]] do bloco de Conexões.\n` +
    lista.map((t) => `- ${t}`).join('\n') +
    `\n`
  );
}
