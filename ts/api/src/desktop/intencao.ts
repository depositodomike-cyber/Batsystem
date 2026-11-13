// Camada de intenção DETERMINÍSTICA: reconhece comandos de computador por
// palavras-chave e sinônimos ("abrir", "abre", "inicia", "fecha", "toca",
// "próxima música"…) sem passar pelo modelo. O que sai daqui são parâmetros
// extraídos LITERALMENTE do texto do usuário — por isso podem rodar como
// "comando direto" (SR-06d). Tudo continua passando pela política/gateway.
import { normalizar } from './vocabulario';

export type Intencao =
  | { tipo: 'app'; operacao: 'abrir_aplicativo' | 'fechar_aplicativo'; alvo: string; explicito: boolean }
  | { tipo: 'url'; url: string; rotulo: string }
  | { tipo: 'midia'; acao: 'tocar_pausar' | 'proxima' | 'anterior' | 'parar' | 'volume_mais' | 'volume_menos' | 'mudo' }
  | { tipo: 'energia'; acao: 'desligar' | 'reiniciar' | 'bloquear' | 'encerrar_sessao' }
  | { tipo: 'janelas'; layout: 'maximizar' | 'restaurar' | 'minimizar_outras' | 'lado_a_lado'; alvos: string[] }
  /** Pedido de arquivo/documento: vai para o planejador, com as ferramentas desktop. */
  | { tipo: 'arquivos' };

/** Enchimentos que não mudam o comando. */
const ENCHIMENTO = [
  'oracle', 'ei', 'oi', 'ola', 'por favor', 'porfavor', 'pra mim', 'para mim', 'pfv', 'agora', 'ai', 'rapidinho',
  'no meu computador', 'no computador', 'no meu pc', 'no pc', 'no notebook', 'aqui', 'pra eu', 'pode', 'voce pode', 'consegue',
  'voce consegue', 'quero que voce', 'eu quero', 'quero',
];
const ARTIGOS = /^(o|a|os|as|um|uma|meu|minha|meus|minhas|do|da|no|na)\s+/;
const MARCADOR_APP = /\b(app|aplicativo|programa|software|janela|a janela d[oa])\b/;

// GC-07: sem "liga"/"usar" ("liga pra Maria", "usar o excel para…" não são abrir app).
const VERBO_ABRIR = /^(abrir|abre|abra|abri|abrie|inicia|iniciar|inicie|executa|executar|execute|roda|rodar|rode|lanca|lancar|lance|carrega|carregar|carregue|entra no|entra na|entrar no|entrar na|entre no|entre na|open|launch|start|run)\s+/;
const VERBO_FECHAR = /^(fechar|fecha|feche|encerra|encerrar|encerre|sai do|sai da|sair do|sair da|saia do|saia da|tira|tirar|tire|close|quit|exit)\s+/;
const DOMINIO = /\b([a-z0-9-]+(\.[a-z0-9-]+)+)(\/\S*)?$/;

function limpar(textoBruto: string): string {
  let t = normalizar(textoBruto);
  // "oracle," no começo e enchimentos em qualquer lugar
  for (const e of ENCHIMENTO) t = t.replace(new RegExp(`(^| )${e}( |$)`, 'g'), ' ').replace(/\s+/g, ' ').trim();
  return t;
}

function semArtigos(s: string): string {
  let t = s.trim();
  for (let i = 0; i < 3; i++) t = t.replace(ARTIGOS, '');
  return t
    .replace(/^(app|aplicativo|programa|software)\s+(do|da|de)?\s*/, '')
    .replace(/^janela\s+(do|da|de)\s+/, '')
    .replace(/\s+(app|aplicativo|programa)$/, '')
    .replace(/\s+(da tela|na tela|pra mim)$/, '')
    .trim();
}

/** Pergunta ou frase longa → não é comando (vai pelo fluxo normal). */
function pareceComando(t: string): boolean {
  if (!t) return false;
  if (/^(como|quando|onde|porque|por que|qual|quais|o que|quanto|sera|e possivel|devo|posso|preciso)\b/.test(t)) return false;
  return t.split(' ').length <= 10;
}

/**
 * Interpreta UM texto. `null` = não é comando de computador (segue o fluxo
 * normal do Oracle: resposta direta ou plano).
 */
export function interpretarComando(textoBruto: string): Intencao | null {
  if (/[?]\s*$/.test(textoBruto.trim())) return null;
  const t = limpar(textoBruto);
  if (!pareceComando(t)) return null;

  // ---------------- mídia (frases curtas, sem alvo)
  if (/^(toca|tocar|toque|play|continua|continuar|retoma|retomar|solta|soltar)( a| o)?( musica| som| playlist| spotify)?$/.test(t)) return { tipo: 'midia', acao: 'tocar_pausar' };
  if (/^(pausa|pausar|pause|para a musica|parar a musica|pare a musica)( a musica| o som)?$/.test(t)) return { tipo: 'midia', acao: 'tocar_pausar' };
  if (/^(proxima|pula|pular|pule|avanca|avancar|avance|next)( a)?( musica| faixa)?$/.test(t) || /^(proxima|outra) musica$/.test(t)) return { tipo: 'midia', acao: 'proxima' };
  if (/^(anterior|volta|voltar|volte|previous)( musica| faixa| a musica)?$/.test(t) || /^musica anterior$/.test(t)) return { tipo: 'midia', acao: 'anterior' };
  if (/^(aumenta|aumentar|aumente|sobe|subir|suba|mais)( o)? (volume|som)$/.test(t) || t === 'volume mais alto') return { tipo: 'midia', acao: 'volume_mais' };
  if (/^(abaixa|abaixar|abaixe|diminui|diminuir|diminua|baixa|baixar|baixe|menos)( o)? (volume|som)$/.test(t) || t === 'volume mais baixo') return { tipo: 'midia', acao: 'volume_menos' };
  if (/^(mudo|silencio|silenciar|silencia|mutar|muta|tira o som|tirar o som)$/.test(t)) return { tipo: 'midia', acao: 'mudo' };

  // ---------------- energia
  if (/^(desliga|desligar|desligue)( o)? (computador|pc|notebook|maquina)$/.test(t)) return { tipo: 'energia', acao: 'desligar' };
  if (/^(reinicia|reiniciar|reinicie)( o)? (computador|pc|notebook|maquina)$/.test(t)) return { tipo: 'energia', acao: 'reiniciar' };
  if (/^(bloqueia|bloquear|bloqueie|trava|travar|trave)( a| o)? (tela|computador|pc|notebook)$/.test(t)) return { tipo: 'energia', acao: 'bloquear' };
  if (/^(encerra|encerrar|encerre|sai|sair)( a| da)? sessao$/.test(t) || /^(faz|fazer|faca) logoff$/.test(t)) return { tipo: 'energia', acao: 'encerrar_sessao' };

  // ---------------- pesquisa no navegador
  const busca = t.match(/^(pesquisa|pesquisar|pesquise|procura|procurar|procure|busca|buscar|busque|googla|googlar)\s+(.+?)\s+(no|na)\s+(google|navegador|internet|web|chrome|edge)$/);
  if (busca) {
    const q = busca[2].trim();
    return { tipo: 'url', url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, rotulo: `pesquisar "${q}" no Google` };
  }

  // ---------------- janelas
  const maximizar = t.match(/^(maximiza|maximizar|maximize|aumenta a janela d[oa]|tela cheia( n?[oa])?)\s+(.+)$/);
  if (maximizar) return { tipo: 'janelas', layout: 'maximizar', alvos: [semArtigos(maximizar[3])] };
  const so = t.match(/^(deixa|deixar|deixe|mostra|mostrar|mostre) (so|somente|apenas) (.+)$/) ?? t.match(/^(minimiza|minimizar|minimize) (tudo|as outras|as outras janelas) (menos|exceto) (.+)$/);
  if (so) return { tipo: 'janelas', layout: 'minimizar_outras', alvos: [semArtigos(so[so.length - 1])] };
  const lado = t.match(/^(coloca|colocar|coloque|poe|por|ponha|deixa|deixar|deixe|organiza|organizar|organize)\s+(.+?)\s+e\s+(.+?)\s+lado a lado$/);
  if (lado) return { tipo: 'janelas', layout: 'lado_a_lado', alvos: [semArtigos(lado[2]), semArtigos(lado[3])] };
  const restaura = t.match(/^(restaura|restaurar|restaure|traz de volta|trazer de volta)\s+(.+)$/);
  if (restaura) return { tipo: 'janelas', layout: 'restaurar', alvos: [semArtigos(restaura[2])] };
  if (/^(organiza|organizar|organize)( as| minhas)? janelas$/.test(t)) return { tipo: 'arquivos' };

  // ---------------- arquivos/documentos → planejador com desktop
  if (/^(abr\w*|procur\w*|encontr\w*|ach\w*|localiz\w*|busc\w*|mostr\w*)\s+(.*\b)?(arquivo|documento|planilha|apresentacao|pdf|proposta|pasta|ultimo documento|relatorio)s?\b/.test(t)) {
    return { tipo: 'arquivos' };
  }
  if (/^(mov\w*|organiz\w*)\s+(.*\b)?(arquivo|documento|pasta|proposta)s?\b/.test(t)) return { tipo: 'arquivos' };

  // ---------------- sites
  const site = t.match(/^(abrir o site|abre o site|abra o site|acessa|acessar|acesse|entra em|entrar em|entre em|vai para|ir para|va para|abrir|abre|abra)\s+(.+)$/);
  if (site) {
    const bruto = textoBruto.trim().split(/\s+/).pop() ?? '';
    const dom = (site[2].match(DOMINIO) ?? bruto.toLowerCase().match(DOMINIO))?.[0];
    if (dom && !dom.endsWith('.exe')) {
      const url = /^https?:\/\//.test(bruto) ? bruto : `https://${dom}`;
      return { tipo: 'url', url, rotulo: dom };
    }
  }

  // ---------------- apps
  for (const [re, operacao] of [
    [VERBO_ABRIR, 'abrir_aplicativo'],
    [VERBO_FECHAR, 'fechar_aplicativo'],
  ] as const) {
    const m = t.match(re);
    if (!m) continue;
    const resto = t.slice(m[0].length);
    const explicito = MARCADOR_APP.test(resto);
    const alvo = semArtigos(resto);
    if (!alvo || alvo.split(' ').length > 5) return null;
    return { tipo: 'app', operacao, alvo, explicito };
  }
  return null;
}

/**
 * Escolhe entre as alternativas do reconhecimento de voz: a primeira que
 * formar um comando cujo alvo é reconhecido por `reconhecido` (inventário).
 * Sem nenhuma reconhecida, fica com a interpretação do texto principal.
 */
export function melhorComando(
  principal: string,
  alternativas: string[],
  reconhecido: (alvo: string) => boolean,
): { texto: string; intencao: Intencao } | null {
  // GC-01: quem decide SE é comando (e qual) é o texto principal. As
  // alternativas do ditado só podem corrigir o ALVO de um comando do mesmo
  // tipo/operação — nunca transformar uma frase comum em comando nem trocar
  // "abrir" por "fechar".
  const base = interpretarComando(principal);
  if (!base) return null;
  const alvosDe = (i: Intencao) => (i.tipo === 'app' ? [i.alvo] : i.tipo === 'janelas' ? i.alvos : []);
  if (alvosDe(base).every(reconhecido)) return { texto: principal, intencao: base };
  for (const texto of alternativas.filter((a) => a && a !== principal).slice(0, 5)) {
    const i = interpretarComando(texto);
    if (!i || !mesmoComando(base, i)) continue;
    if (alvosDe(i).every(reconhecido)) return { texto, intencao: i };
  }
  return { texto: principal, intencao: base };
}

/** Mesmo tipo e mesma operação/ação/layout (só o alvo pode diferir). */
function mesmoComando(a: Intencao, b: Intencao): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === 'app' && b.tipo === 'app') return a.operacao === b.operacao;
  if (a.tipo === 'janelas' && b.tipo === 'janelas') return a.layout === b.layout && a.alvos.length === b.alvos.length;
  return false; // mídia, energia, url, arquivos: nada a corrigir
}

/** A chamada de ferramenta exata que um comando representa (o gateway refaz isto para conferir). */
export function chamadaDoComando(i: Intencao): { nome: string; entrada: Record<string, unknown> } | null {
  switch (i.tipo) {
    case 'app':
      return { nome: i.operacao === 'abrir_aplicativo' ? 'desktop_abrir_aplicativo' : 'desktop_fechar_aplicativo', entrada: { aplicativo: i.alvo } };
    case 'url':
      return { nome: 'desktop_abrir_url', entrada: { url: i.url } };
    case 'midia':
      return { nome: 'desktop_controlar_midia', entrada: { acao: i.acao } };
    case 'energia':
      return { nome: 'desktop_energia', entrada: { acao: i.acao } };
    case 'janelas':
      return { nome: 'desktop_organizar_janelas', entrada: { layout: i.layout, aplicativos: i.alvos } };
    default:
      return null;
  }
}
