// Monta o .xlsx a partir do plano aprovado e das linhas devolvidas pela IA.
// Determinístico (sem IA), usando exceljs — o mesmo papel que `build-pptx.ts`
// faz para a apresentação.
//
// Três decisões que explicam quase todo o arquivo:
//
// 1) FÓRMULA É CONSTRUÍDA, NÃO COPIADA. O texto que o modelo escreveu passa por
//    `formulaSegura`: charset, parênteses, nomes de aba e nomes de função são
//    conferidos, e o que não passa vira coluna vazia em vez de arquivo que o
//    Excel acusa como corrompido. Uma fórmula inválida estraga o arquivo
//    INTEIRO; uma coluna sem fórmula estraga uma coluna.
//
// 2) EXEMPLO NÃO SE DISFARÇA DE DADO REAL. Aba cujas linhas a IA declarou como
//    demonstrativas ganha uma faixa de aviso na primeira linha, antes do
//    cabeçalho, e entra na lista da aba "Observações".
//
// 3) A MARCA PINTA O CABEÇALHO, NÃO A SEMÂNTICA. A cor primária do guia de
//    marca vira o preenchimento do cabeçalho, com o texto escolhido pela
//    luminância dela. Nada que signifique positivo/negativo/alerta é repintado.
import ExcelJS from 'exceljs';
import type {
  ConteudoPlanilha,
  PlanoAba,
  PlanoColuna,
  PlanoPlanilha,
} from './prompts';
import { designTheme, type DesignSystemDto } from '../design/design';

/** Preferências vindas da configuração; o padrão é tudo ligado (§21). */
export interface RecursosPlanilha {
  formulas: boolean;
  filtros: boolean;
  validacoes: boolean;
  formatacaoCondicional: boolean;
}

export const RECURSOS_PADRAO: RecursosPlanilha = {
  formulas: true,
  filtros: true,
  validacoes: true,
  formatacaoCondicional: true,
};

// ----------------------------------------------------------------------
// Nomes de aba
// ----------------------------------------------------------------------

/** O Excel recusa estes caracteres, e corta em 31 — daí a higienização. */
function nomeDeAba(nome: string, usados: Set<string>): string {
  let base = (nome || 'Planilha')
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
  if (!base) base = 'Planilha';
  let final = base;
  let n = 2;
  while (usados.has(final.toLowerCase())) {
    const sufixo = ` ${n++}`;
    final = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(final.toLowerCase());
  return final;
}

/** Uma referência a esta aba dentro de uma fórmula (com aspas quando preciso). */
function refDeAba(nome: string): string {
  return /^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*$/.test(nome) ? nome : `'${nome}'`;
}

// ----------------------------------------------------------------------
// Fórmulas
// ----------------------------------------------------------------------

/**
 * Funções que aceitamos escrever no arquivo.
 *
 * Lista de PERMITIDAS, e não de proibidas: função nova que o modelo invente
 * cai fora sozinha, em vez de entrar no arquivo e virar #NOME?.
 *
 * Os nomes vão em INGLÊS porque é assim que o formato OOXML guarda fórmula —
 * o Excel em português mostra "SOMASE" ao abrir, sem nada a fazer aqui.
 */
const FUNCOES = new Set([
  'ABS', 'AND', 'AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'CEILING', 'CONCAT',
  'CONCATENATE', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS',
  'DATE', 'DAY', 'EOMONTH', 'FLOOR', 'IF', 'IFERROR', 'IFS', 'INDEX',
  'ISBLANK', 'ISNUMBER', 'LEFT', 'LEN', 'MATCH', 'MAX', 'MEDIAN', 'MID',
  'MIN', 'MONTH', 'NOT', 'NOW', 'OR', 'PRODUCT', 'RANK', 'RIGHT', 'ROUND',
  'ROUNDDOWN', 'ROUNDUP', 'SUBTOTAL', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT',
  'TEXT', 'TODAY', 'TRIM', 'UPPER', 'LOWER', 'VLOOKUP', 'XLOOKUP', 'YEAR',
]);

/** Só estes caracteres podem chegar ao XML de uma fórmula. */
const CHARSET_FORMULA = /^[A-Za-zÀ-ÿ0-9_ =+\-*/^%().,:!$"'&<>]+$/;

function parentesesBalanceados(s: string): boolean {
  let n = 0;
  for (const c of s) {
    if (c === '(') n++;
    else if (c === ')' && --n < 0) return false;
  }
  return n === 0;
}

/**
 * Valida a fórmula e devolve o MOLDE dela — a fórmula como fica na primeira
 * linha de dados, ainda com o `2` que o modelo escreveu. `aplicarLinha` troca
 * esse `2` pela linha de destino, que é exatamente o que o Excel faz ao
 * arrastar a alça de preenchimento.
 *
 * `null` = não passou, e a coluna sai sem fórmula. Preferir a coluna vazia é
 * deliberado: fórmula inválida não dá erro numa célula, dá "arquivo precisa de
 * reparo" no arquivo inteiro.
 */
export function formulaSegura(
  bruta: string | undefined,
  abas: Map<string, string>,
): string | null {
  let f = (bruta ?? '').trim();
  if (!f.startsWith('=')) return null;
  f = f.slice(1).trim();
  if (!f || f.length > 300) return null;

  // O modelo às vezes separa argumentos com ";" (como o Excel em pt-BR mostra).
  // O formato do arquivo usa vírgula.
  f = f.replace(/;/g, ',');
  if (!CHARSET_FORMULA.test(f)) return null;
  if (!parentesesBalanceados(f)) return null;

  // Toda função citada precisa estar na lista.
  for (const m of f.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*\(/g)) {
    if (!FUNCOES.has(m[1].toUpperCase())) return null;
  }

  // Toda referência a outra aba precisa existir — e sai daqui com o nome
  // higienizado e entre aspas quando necessário.
  let erro = false;
  f = f.replace(
    /(?:'([^']+)'|([A-Za-zÀ-ÿ0-9_ ]+))!/g,
    (todo, comAspas: string | undefined, semAspas: string | undefined) => {
      const pedido = (comAspas ?? semAspas ?? '').trim();
      const alvo = abas.get(pedido.toLowerCase());
      if (!alvo) {
        erro = true;
        return todo;
      }
      return `${refDeAba(alvo)}!`;
    },
  );
  if (erro) return null;

  // Último filtro, e o mais importante: toda PALAVRA que sobra precisa ser uma
  // função conhecida ou uma referência de célula. Sem ele, algo como
  // "=DELETE FROM x" passaria — os testes anteriores só olham parênteses e
  // charset, e uma frase solta não tem nem um nem outro.
  const semTextoNemAba = f
    .replace(/"[^"]*"/g, '""')
    .replace(/(?:'[^']+'|[A-Za-zÀ-ÿ0-9_ ]+)!/g, '');
  for (const m of semTextoNemAba.matchAll(
    /([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)(\s*\()?/g,
  )) {
    const token = m[1];
    const ehChamada = Boolean(m[2]);
    if (ehChamada) {
      if (!FUNCOES.has(token.toUpperCase())) return null;
      continue;
    }
    if (/^(TRUE|FALSE)$/i.test(token)) continue;
    // Referência de célula ou de coluna inteira: A, B2, AZ, AZ100. O cifrão de
    // `$B$2` não entra no token — ele parte a palavra, e sobram "B" e "2".
    if (/^[A-Za-z]{1,3}\d{0,7}$/.test(token)) continue;
    return null;
  }

  // Intervalo bem formado: os dois lados do ":" têm de ser da MESMA espécie —
  // duas células (`C3:C10`) ou duas colunas inteiras (`C:C`).
  //
  // Isto pegou um caso real: o modelo escreveu `SUM(C3:C)`, que o Google Sheets
  // aceita e o Excel não. O resto da validação deixava passar, porque `C3` e
  // `C` são dois tokens perfeitamente válidos — o defeito está na combinação.
  const colunasNoTexto = (semTextoNemAba.match(/:/g) ?? []).length;
  let intervalos = 0;
  for (const m of semTextoNemAba.matchAll(
    /(\$?[A-Za-z]{1,3}\$?\d*)\s*:\s*(\$?[A-Za-z]{1,3}\$?\d*)/g,
  )) {
    intervalos++;
    const temLinha = (lado: string) => /\d/.test(lado);
    if (temLinha(m[1]) !== temLinha(m[2])) return null;
  }
  // Dois-pontos que não formou intervalo nenhum é lixo — fora.
  if (intervalos !== colunasNoTexto) return null;

  return f;
}

/**
 * O molde aplicado a uma linha: as referências RELATIVAS à linha 2 viram a
 * linha de destino. `B$2` e `$B$2` ficam onde estão — cifrão é o que o usuário
 * escreveria para travar, e travado deve continuar.
 */
export function aplicarLinha(molde: string, linha: number): string {
  return molde.replace(
    /(\$?[A-Za-z]{1,3})(\$?)2(?![0-9])/g,
    (_todo, coluna: string, cifrao: string) =>
      cifrao ? `${coluna}${cifrao}2` : `${coluna}${linha}`,
  );
}

// ----------------------------------------------------------------------
// Formatos e cores
// ----------------------------------------------------------------------

const FORMATO: Record<string, string | undefined> = {
  moeda: 'R$ #,##0.00',
  numero: '#,##0.##',
  percentual: '0.0%',
  data: 'dd/mm/yyyy',
  texto: undefined,
  lista: undefined,
};

/** Texto legível sobre a cor da marca — claro ou escuro, pela luminância. */
function textoSobre(hexSemCerquilha: string): string {
  const n = parseInt(hexSemCerquilha, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Luminância relativa aproximada (ITU-R BT.601), suficiente para escolher
  // entre preto e branco.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? 'FF0F172A' : 'FFFFFFFF';
}

/** "RRGGBB" → "FFRRGGBB", que é como o exceljs quer a cor. */
function argb(hexSemCerquilha: string): string {
  return `FF${hexSemCerquilha.replace(/^#/, '').toUpperCase()}`;
}

/** Célula com o tipo certo: número vira número, data vira data, resto é texto. */
function valorDaCelula(valor: string | number | null, coluna: PlanoColuna) {
  if (valor === null || valor === undefined) return null;
  if (coluna.tipo === 'data' && typeof valor === 'string') {
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if (typeof valor === 'string' && coluna.tipo !== 'texto') {
    // "1200,50" e "1200.50" viram número; o resto continua texto.
    const limpo = valor.replace(/\./g, '').replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(limpo)) return Number(limpo);
  }
  return valor;
}

/** Largura da coluna pelo nome e pelo maior valor — teto para não estourar. */
function largura(coluna: PlanoColuna, amostras: (string | number | null)[]) {
  const maior = amostras.reduce<number>(
    (n, v) => Math.max(n, v === null ? 0 : String(v).length),
    coluna.nome.length,
  );
  return Math.min(48, Math.max(12, maior + 3));
}

// ----------------------------------------------------------------------
// Construção
// ----------------------------------------------------------------------

const AVISO_EXEMPLO =
  'Dados de exemplo — servem para mostrar o preenchimento. Nenhum valor desta aba é real.';

/** Tipo provável de uma coluna calculada, pelo nome — percentual salta à vista. */
function tipoDoCalculo(nome: string): PlanoColuna['tipo'] {
  return /%|percent|taxa|margem/i.test(nome) ? 'percentual' : 'numero';
}

/**
 * As colunas que a aba REALMENTE vai ter.
 *
 * O plano descreve a mesma coisa em dois lugares: "colunas" e "calculos". Quem
 * revisou aprovou os dois — então o arquivo precisa entregar os dois. Aqui eles
 * se juntam:
 *
 * - cálculo cujo nome já é uma coluna empresta a fórmula àquela coluna;
 * - cálculo que não é coluna nenhuma vira uma coluna nova, no fim.
 *
 * Sem isto, um plano que promete "Saldo = Planejado − Realizado" sai num
 * arquivo sem coluna Saldo, e a planilha entregue não é a que foi aprovada.
 */
function colunasDaAba(aba: PlanoAba): PlanoColuna[] {
  const base: PlanoColuna[] = aba.colunas.length
    ? aba.colunas
    : [{ nome: 'Item', tipo: 'texto' }];
  const colunas: PlanoColuna[] = base.map((c) => ({ ...c }));
  const porNome = new Map(colunas.map((c) => [c.nome.trim().toLowerCase(), c]));

  for (const calc of [...aba.calculos, ...aba.indicadores]) {
    const chave = calc.nome.trim().toLowerCase();
    if (!chave) continue;
    const existente = porNome.get(chave);
    if (existente) {
      // A coluna manda no tipo (o plano a descreveu); o cálculo empresta a
      // fórmula só quando ela ainda não veio pela coluna.
      if (!existente.formula && calc.formula) existente.formula = calc.formula;
      continue;
    }
    const nova: PlanoColuna = {
      nome: calc.nome,
      tipo: tipoDoCalculo(calc.nome),
      descricao: calc.logica || undefined,
      formula: calc.formula,
    };
    colunas.push(nova);
    porNome.set(chave, nova);
  }

  return colunas;
}

export async function buildXlsx(
  plano: PlanoPlanilha,
  conteudo: ConteudoPlanilha,
  design?: DesignSystemDto | null,
  recursos: RecursosPlanilha = RECURSOS_PADRAO,
): Promise<Buffer> {
  const tema = designTheme(design);
  const corCabecalho = argb(tema.pptx.destaque);
  const corTextoCabecalho = textoSobre(tema.pptx.destaque);

  const wb = new ExcelJS.Workbook();
  wb.creator = tema.marca;
  wb.created = new Date();

  // Nome do plano → nome real da aba. É por este mapa que uma fórmula escrita
  // como `Lançamentos!B2` encontra a aba certa depois da higienização.
  const usados = new Set<string>();
  const nomes = new Map<string, string>();
  const nomeDe = new Map<string, string>();
  for (const aba of plano.abas) {
    const real = nomeDeAba(aba.nome, usados);
    nomeDe.set(aba.id, real);
    nomes.set(aba.nome.trim().toLowerCase(), real);
    nomes.set(real.toLowerCase(), real);
  }

  const porId = new Map(conteudo.abas.map((a) => [a.id, a]));
  const comExemplo: string[] = [];

  /** O que o segundo passe precisa saber de cada aba já montada. */
  interface Montada {
    ws: ExcelJS.Worksheet;
    primeiraLinha: number;
    colunas: PlanoColuna[];
    linhas: number;
  }
  const montadas = new Map<string, Montada>();

  for (const aba of plano.abas) {
    const dados = porId.get(aba.id) ?? { origem: 'vazia' as const, linhas: [] };
    const exemplo = dados.origem === 'exemplo' && dados.linhas.length > 0;
    if (exemplo) comExemplo.push(nomeDe.get(aba.id)!);

    const ws = wb.addWorksheet(nomeDe.get(aba.id)!);
    const colunas = colunasDaAba(aba);

    // A faixa de aviso empurra o cabeçalho para a linha 2 — e todo o resto do
    // arquivo se posiciona a partir daqui, inclusive as fórmulas.
    const linhaCabecalho = exemplo ? 2 : 1;
    const primeiraLinha = linhaCabecalho + 1;

    if (exemplo) {
      ws.mergeCells(1, 1, 1, colunas.length);
      const faixa = ws.getCell(1, 1);
      faixa.value = AVISO_EXEMPLO;
      faixa.font = { bold: true, color: { argb: 'FF92400E' }, size: 11 };
      faixa.alignment = { vertical: 'middle' };
      faixa.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' },
      };
      ws.getRow(1).height = 22;
    }

    const cabecalho = ws.getRow(linhaCabecalho);
    colunas.forEach((c, i) => {
      const celula = cabecalho.getCell(i + 1);
      celula.value = c.nome;
      celula.font = { bold: true, color: { argb: corTextoCabecalho } };
      celula.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: corCabecalho },
      };
      celula.alignment = { vertical: 'middle' };
      if (c.descricao) celula.note = c.descricao;
    });
    cabecalho.height = 20;

    // Moldes das colunas calculadas, uma vez por coluna.
    const moldes = colunas.map((c) =>
      recursos.formulas ? formulaSegura(c.formula, nomes) : null,
    );

    dados.linhas.forEach((linha, n) => {
      const alvo = primeiraLinha + n;
      const row = ws.getRow(alvo);
      colunas.forEach((c, i) => {
        const celula = row.getCell(i + 1);
        const molde = moldes[i];
        if (molde) {
          celula.value = { formula: aplicarLinha(molde, alvo) };
        } else {
          const v = valorDaCelula(linha[i] ?? null, c);
          if (v !== null) celula.value = v as string | number | Date;
        }
        const fmt = FORMATO[c.tipo];
        if (fmt) celula.numFmt = fmt;
      });
    });

    colunas.forEach((c, i) => {
      ws.getColumn(i + 1).width = largura(
        c,
        dados.linhas.map((l) => l[i] ?? null),
      );
      const fmt = FORMATO[c.tipo];
      // O formato vale também para o que o usuário ainda vai digitar.
      if (fmt && !dados.linhas.length) ws.getColumn(i + 1).numFmt = fmt;
    });

    // Cabeçalho sempre à vista ao rolar.
    ws.views = [{ state: 'frozen', ySplit: linhaCabecalho }];

    if (aba.filtros && recursos.filtros && colunas.length) {
      ws.autoFilter = {
        from: { row: linhaCabecalho, column: 1 },
        to: { row: linhaCabecalho, column: colunas.length },
      };
    }

    montadas.set(aba.id, {
      ws,
      primeiraLinha,
      colunas,
      linhas: dados.linhas.length,
    });
  }

  // Validações e formatação condicional dependem das outras abas já existirem,
  // então são um segundo passe.
  for (const aba of plano.abas) {
    const montada = montadas.get(aba.id);
    if (!montada) continue;
    const { ws, primeiraLinha, colunas, linhas } = montada;
    // Sem linha nenhuma a validação ainda vale: ela guia o que vai ser digitado.
    const ultima = primeiraLinha + Math.max(linhas, 50) - 1;

    colunas.forEach((c, i) => {
      const letra = ws.getColumn(i + 1).letter;

      if (recursos.validacoes && c.tipo === 'lista') {
        const origem = listaDeApoio(plano, montadas, c.nome);
        if (origem) {
          for (let r = primeiraLinha; r <= ultima; r++) {
            ws.getCell(`${letra}${r}`).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [origem],
              showErrorMessage: true,
              errorTitle: 'Valor fora da lista',
              error: `Escolha um dos valores cadastrados em ${c.nome}.`,
            };
          }
        }
      }

      // Barra de dados, e não escala de cor: barra informa a proporção sem
      // afirmar que muito é bom ou ruim. Repintar semântica é justamente o que
      // não se deve fazer com dado alheio.
      if (
        recursos.formatacaoCondicional &&
        linhas > 1 &&
        (c.tipo === 'moeda' || c.tipo === 'numero' || c.tipo === 'percentual') &&
        aba.tipo === 'resumo'
      ) {
        ws.addConditionalFormatting({
          ref: `${letra}${primeiraLinha}:${letra}${primeiraLinha + linhas - 1}`,
          rules: [
            {
              type: 'dataBar',
              priority: 1,
              minLength: 0,
              maxLength: 100,
              gradient: false,
              // Sem cor: o tipo do exceljs nao a expoe, e a barra padrao do
              // Excel ja cumpre o papel. Pintar a barra com a marca tambem
              // roubaria significado de uma coisa que e so proporcao.
              cfvo: [{ type: 'min' }, { type: 'max' }],
            },
          ],
        });
      }
    });
  }

  // Aba final só quando há o que dizer — nunca uma aba vazia de burocracia.
  if (plano.limitacoes.length || comExemplo.length) {
    const ws = wb.addWorksheet(nomeDeAba('Observações', usados));
    ws.getColumn(1).width = 110;
    let linha = 1;
    const titulo = (texto: string) => {
      const c = ws.getCell(linha++, 1);
      c.value = texto;
      c.font = { bold: true, size: 12 };
    };
    const item = (texto: string) => {
      const c = ws.getCell(linha++, 1);
      c.value = `• ${texto}`;
      c.alignment = { wrapText: true, vertical: 'top' };
    };

    titulo(plano.titulo);
    if (plano.objetivo) item(plano.objetivo);
    linha++;

    if (comExemplo.length) {
      titulo('Abas com dados de exemplo');
      item(
        `${comExemplo.join(', ')} — os valores servem para mostrar o preenchimento e não são reais.`,
      );
      linha++;
    }
    if (plano.limitacoes.length) {
      titulo('O que as fontes não cobrem');
      plano.limitacoes.forEach(item);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Intervalo de uma coluna homônima numa aba de apoio — a origem de um menu
 * suspenso. `null` quando não houver: validação inventada é pior que nenhuma.
 */
function listaDeApoio(
  plano: PlanoPlanilha,
  montadas: Map<
    string,
    { ws: ExcelJS.Worksheet; primeiraLinha: number; linhas: number }
  >,
  nomeColuna: string,
): string | null {
  const alvo = nomeColuna.trim().toLowerCase();
  for (const aba of plano.abas) {
    if (aba.tipo !== 'apoio') continue;
    const i = aba.colunas.findIndex((c) => c.nome.trim().toLowerCase() === alvo);
    if (i < 0) continue;
    const montada = montadas.get(aba.id);
    if (!montada) continue;
    const letra = montada.ws.getColumn(i + 1).letter;
    const inicio = montada.primeiraLinha;
    const fim = inicio + Math.max(montada.linhas, 50) - 1;
    return `${refDeAba(montada.ws.name)}!${letra}${inicio}:${letra}${fim}`;
  }
  return null;
}
