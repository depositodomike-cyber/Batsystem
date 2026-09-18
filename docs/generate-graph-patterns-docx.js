// Gerador do docs/Padroes-Visuais-Grafo-beculture.docx
//
// Irmão de generate-menu-patterns-docx.mjs: mesma identidade visual (capa
// âmbar, cabeçalho/rodapé paginado, tabelas zebradas), outro tema — o grafo da
// Memória/Repositório.
//
// A lib `docx` é instalação GLOBAL (não está em nenhum package.json do repo) e
// NODE_PATH só resolve para CommonJS — por isso este arquivo é .js e não .mjs.
// Rodar com:
//   NODE_PATH="$(npm root -g)" node docs/generate-graph-patterns-docx.js
//
// Fontes conferidas linha a linha:
//   ts/demo/src/app/pages/ceo/MemoriaGrafo.tsx         (desenho, física, câmera)
//   ts/demo/src/app/pages/ceo/memoria-grafo-modelo.ts  (paleta, raio, massa, molas)
//   ts/demo/src/app/pages/ceo/GrafoPainelContexto.tsx  (painel lateral)
//   ts/demo/src/styles/beculture-theme.css             (tokens de marca)

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
  LevelFormat,
  Header,
  Footer,
  PageNumber,
} = require("docx");
const fs = require("fs");
const path = require("path");

const PRIMARY = "FFB300";
const SLATE = "0F172B";
const GRAY = "64748B";
const BORDER = "E2E8F0";
const HEADER_BG = "0F172B";
const ALT_ROW = "F8FAFC";

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? "1E293B",
      }),
    ],
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: {
      before: level === HeadingLevel.HEADING_1 ? 360 : 240,
      after: 120,
    },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size:
          level === HeadingLevel.HEADING_1
            ? 32
            : level === HeadingLevel.HEADING_2
              ? 26
              : 24,
        color: SLATE,
      }),
    ],
  });
}
const h1 = (t) => heading(t, HeadingLevel.HEADING_1);
const h2 = (t) => heading(t, HeadingLevel.HEADING_2);

/** Linha "Na prática:" — mesmo recurso do documento do menu. */
function about(text) {
  return new Paragraph({
    spacing: { after: 160, before: 0, line: 276 },
    children: [
      new TextRun({
        text: "Na prática: ",
        font: "Calibri",
        size: 22,
        bold: true,
        italics: true,
        color: PRIMARY,
      }),
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        italics: true,
        color: GRAY,
      }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 276 },
    children: [
      new TextRun({ text, font: "Calibri", size: 22, color: "1E293B" }),
    ],
  });
}

function cell(text, opts = {}) {
  const isHeader = opts.header;
  return new TableCell({
    borders,
    width: { size: opts.width ?? 2400, type: WidthType.DXA },
    shading: {
      type: ShadingType.CLEAR,
      fill: isHeader ? HEADER_BG : (opts.fill ?? "FFFFFF"),
    },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text,
            font: opts.mono ? "Consolas" : "Calibri",
            size: opts.size ?? 18,
            bold: isHeader || opts.bold,
            color: isHeader ? "FFFFFF" : (opts.color ?? "1E293B"),
          }),
        ],
      }),
    ],
  });
}

function table(headers, rows, colWidths) {
  const widths =
    colWidths ?? headers.map(() => Math.floor(9360 / headers.length));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: headers.map((h, i) =>
          cell(h, { header: true, width: widths[i] }),
        ),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            children: row.map((c, i) =>
              cell(String(c), {
                width: widths[i],
                fill: ri % 2 === 1 ? ALT_ROW : "FFFFFF",
              }),
            ),
          }),
      ),
    ],
  });
}

const SW = [1000, 2260, 1500, 4600];

/** Tabela de cores com a amostra pintada na 1ª coluna. */
function swatchTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: SW,
    rows: [
      new TableRow({
        children: ["Cor", "Onde", "Hex", "Observação"].map((h, i) =>
          cell(h, { header: true, width: SW[i] }),
        ),
      }),
      ...rows.map(
        ([hex, onde, obs], ri) =>
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: SW[0], type: WidthType.DXA },
                shading: {
                  type: ShadingType.CLEAR,
                  fill: hex.replace("#", ""),
                },
                margins: { top: 80, bottom: 80, left: 80, right: 80 },
                children: [new Paragraph({ children: [] })],
              }),
              cell(onde, {
                width: SW[1],
                bold: true,
                fill: ri % 2 === 1 ? ALT_ROW : "FFFFFF",
              }),
              cell(hex, {
                width: SW[2],
                mono: true,
                fill: ri % 2 === 1 ? ALT_ROW : "FFFFFF",
              }),
              cell(obs, {
                width: SW[3],
                fill: ri % 2 === 1 ? ALT_ROW : "FFFFFF",
              }),
            ],
          }),
      ),
    ],
  });
}

function spacer(after = 200) {
  return new Paragraph({ spacing: { after }, children: [] });
}

const W2 = [3120, 6240];
const W3 = [2600, 3380, 3380];
const W4 = [2200, 2480, 2200, 2480];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "○",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: "beculture  ·  Design System",
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  text: "                                                                 ",
                  font: "Calibri",
                  size: 16,
                }),
                new TextRun({
                  text: "Padrões Visuais do Grafo",
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
              ],
            }),
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 12, color: PRIMARY },
              },
              spacing: { after: 200 },
              children: [],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: { style: BorderStyle.SINGLE, size: 6, color: BORDER },
              },
              spacing: { before: 120 },
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Página ",
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  text: " de ",
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ---------------------------- CAPA ----------------------------
        new Paragraph({
          spacing: { before: 400, after: 80 },
          children: [
            new TextRun({
              text: "GUIA VISUAL PARA FRONTEND",
              font: "Calibri",
              size: 18,
              bold: true,
              color: PRIMARY,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: "Padrões Visuais do Grafo",
              font: "Calibri",
              size: 52,
              bold: true,
              color: SLATE,
            }),
          ],
        }),
        p(
          "Especificação completa do grafo da Memória / Repositório: a cor das bolinhas (nós) no modo claro e no escuro, o cinza das linhas (arestas), tamanhos, brilho, rótulos, física, câmera e todos os elementos de interface que ficam por cima do canvas.",
          { color: GRAY, after: 280 },
        ),
        table(
          ["Campo", "Valor"],
          [
            ["Tela", "Memória · Repositório (grafo em tela cheia)"],
            ["Desenho", "Canvas 2D, force-directed, 100% no navegador"],
            ["Código do desenho", "MemoriaGrafo.tsx"],
            ["Código do modelo e da paleta", "memoria-grafo-modelo.ts"],
            ["Painel lateral", "GrafoPainelContexto.tsx"],
            ["Cor principal", "Âmbar #FFCA28 / #FFB300"],
            ["Cor de estrutura", "Slate #0F172B"],
            ["Fonte dos rótulos", "Inter, system-ui, sans-serif"],
            ["Versão", "v1.0 — Setembro 2026"],
          ],
          W2,
        ),
        spacer(240),

        // ------------------- 1. RESPOSTA RÁPIDA -------------------
        h1("1. Resposta rápida"),
        about(
          "As três informações mais pedidas, antes do detalhamento. O resto do documento explica de onde sai cada número.",
        ),
        h2("As bolinhas (nós)"),
        p(
          "A cor das bolinhas É A MESMA no modo claro e no modo escuro. A cor identifica o TIPO do nó (tag, pessoa, categoria, pasta), não o tema — trocar o tema não pode trocar o significado de uma cor. O que muda com o tema é o fundo da tela, o miolo dos nós vazados (pasta e projeto) e a cor dos rótulos.",
        ),
        swatchTable([
          ["#22D3EE", "Tag (e hub de tag)", "Ciano. Igual nos dois modos."],
          [
            "#F472B6",
            "Pessoa",
            "Rosa — reusa a cor fixa da pasta “Pessoas”. Igual nos dois modos.",
          ],
          [
            "#FB923C",
            "Categoria",
            "Laranja — reusa a cor da pasta “Estratégico”. Igual nos dois modos.",
          ],
          [
            "#94A3B8",
            "Nota sem pasta",
            "Cinza de fallback. Igual nos dois modos.",
          ],
        ]),
        spacer(160),
        p(
          "Projeto, pasta e nota não têm cor fixa: herdam a cor da pasta a que pertencem (tabela completa na seção 4.2).",
          { color: GRAY, size: 20 },
        ),
        spacer(160),
        h2("O cinza da linha"),
        p(
          "As arestas de tipo “pasta” e “relação” — as linhas cinza do grafo — usam DOIS cinzas diferentes, um por tema. É o único par de cores do grafo que realmente troca com o modo claro/escuro:",
        ),
        swatchTable([
          [
            "#64748B",
            "Linha — modo claro",
            "Slate 500. Mais escuro, para não sumir no fundo claro.",
          ],
          [
            "#94A3B8",
            "Linha — modo escuro",
            "Slate 400. Mais claro, para aparecer no fundo escuro.",
          ],
        ]),
        spacer(160),
        p(
          "Os dois entram com opacidade variável (seção 5.2), nunca sólidos: rgba(100,116,139,α) no claro e rgba(148,163,184,α) no escuro.",
          { color: GRAY, size: 20 },
        ),
        spacer(240),

        // ------------------- 2. TELA E FUNDO -------------------
        h1("2. Tela e fundo"),
        about(
          "O grafo ocupa a página inteira abaixo do cabeçalho. É o único lugar do produto com um fundo escuro próprio, fora da rampa padrão.",
        ),
        table(
          ["Item", "Modo claro", "Modo escuro"],
          [
            [
              "Fundo do canvas",
              "#F8FAFC (slate-50)",
              "#0B1220 (literal — mais escuro que o dark-900)",
            ],
            [
              "Altura",
              "100dvh − altura do cabeçalho (65px)",
              "igual",
            ],
            ["Largura", "100% da área de conteúdo", "igual"],
            ["Véu de “Lendo a pasta…”", "#F8FAFC a 60%", "#0B1220 a 60%"],
            [
              "Gestos",
              "touch-none no canvas (o navegador não rouba o gesto)",
              "igual",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 3. FORMA E TAMANHO -------------------
        h1("3. As bolinhas — forma e tamanho"),
        about(
          "Todo nó é um círculo. O que varia é o raio (pelo acervo ou pelo grau), se ele é pintado ou vazado, e a intensidade do brilho.",
        ),
        h2("3.1 Pintado ou vazado"),
        table(
          ["Tipo de nó", "Desenho", "Detalhe"],
          [
            [
              "Tag, hub de tag, pessoa, categoria, nota",
              "Círculo PINTADO",
              "Preenchido com a cor do tipo ou da pasta",
            ],
            [
              "Pasta, projeto",
              "Círculo VAZADO (anel)",
              "Anel de 2,2px na cor + miolo na cor do fundo",
            ],
          ],
          W3,
        ),
        spacer(140),
        p("Cor do miolo dos nós vazados (é o “furo” do anel):"),
        swatchTable([
          [
            "#F8FAFC",
            "Miolo — modo claro",
            "rgba(248,250,252, 0.92) — slate-50 a 92%.",
          ],
          [
            "#0F172A",
            "Miolo — modo escuro",
            "rgba(15,23,42, 0.85) — slate-900 a 85%.",
          ],
        ]),
        spacer(160),
        p(
          "A espessura do anel (2,2px) e todos os traços são divididos pela escala da câmera, para ficarem constantes na tela em qualquer zoom.",
          { color: GRAY, size: 20 },
        ),
        h2("3.2 Raio do nó"),
        p(
          "Entidades dimensionam pelo ACERVO que carregam (quantos conteúdos citam aquela tag ou pessoa), saturado em 24 itens. Pastas e notas dimensionam pelo GRAU (quantas conexões têm).",
        ),
        table(
          ["Tipo de nó", "Fórmula do raio (px)", "Faixa prática"],
          [
            ["Categoria", "9 + acervo × 0,6", "9 → 23,4 px"],
            ["Pasta", "10 + mín(grau, 20) × 0,7", "10 → 24 px"],
            ["Pessoa", "8 + acervo × 0,6", "8 → 22,4 px"],
            ["Projeto", "8 + acervo × 0,6", "8 → 22,4 px"],
            ["Tag", "7 + acervo × 0,6", "7 → 21,4 px"],
            ["Hub de tag", "7 + mín(grau, 16) × 0,6", "7 → 16,6 px"],
            ["Nota", "6 + mín(grau, 8) × 1,6", "6 → 18,8 px"],
          ],
          W3,
        ),
        spacer(140),
        p("Acervo = mín(número de conteúdos do nó, 24).", {
          color: GRAY,
          size: 20,
        }),
        h2("3.3 Brilho (glow) e opacidade"),
        p(
          "Todo nó tem um halo da SUA PRÓPRIA cor. É o que dá ao grafo a aparência de constelação, e vale igualmente nos dois temas.",
        ),
        table(
          ["Situação", "Desfoque do halo", "Opacidade do nó"],
          [
            ["Repouso (nada selecionado)", "12 px × escala", "100%"],
            ["Em destaque (clicado ou sob o cursor)", "22 px × escala", "100%"],
            ["Há realce, mas este nó ficou de fora", "4 px × escala", "35%"],
            ["Respiração em repouso", "± 2,2 px, senoidal, fase por nó", "—"],
            [
              "Respiração durante a busca da IA",
              "+9 px, oscilando ± 7 px",
              "—",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 4. CORES DOS NÓS -------------------
        h1("4. Cores das bolinhas"),
        about(
          "A paleta inteira do grafo. Nenhuma destas cores muda entre o modo claro e o escuro — elas identificam tipo e pasta, e precisam significar a mesma coisa nos dois temas.",
        ),
        h2("4.1 Cor fixa por tipo de nó"),
        swatchTable([
          ["#22D3EE", "Tag", "Ciano fixo. Mesma cor das arestas de tag."],
          ["#22D3EE", "Hub de tag", "Mesmo ciano da tag."],
          ["#F472B6", "Pessoa", "Rosa da pasta “Pessoas” — nenhuma cor nova."],
          [
            "#FB923C",
            "Categoria",
            "Laranja da pasta “Estratégico” — nenhuma cor nova.",
          ],
        ]),
        spacer(160),
        p(
          "Projeto, pasta e nota não têm cor fixa — recebem a cor da pasta (4.2 e 4.3).",
        ),
        h2("4.2 Cores fixas de pasta"),
        p(
          "Sete pastas conhecidas têm cor reservada. São sempre estas, em qualquer repositório:",
        ),
        swatchTable([
          ["#FFCA28", "Reuniões", "Âmbar da marca (Primary)."],
          ["#C084FC", "Insights", "Roxo claro."],
          ["#10B981", "Documentos", "Verde — o mesmo verde do Sucesso."],
          ["#94A3B8", "Notas", "Cinza slate-400."],
          ["#F472B6", "Pessoas", "Rosa — também a cor do nó Pessoa."],
          ["#38BDF8", "Áudios", "Azul céu."],
          ["#FB923C", "Estratégico", "Laranja — também a cor do nó Categoria."],
        ]),
        h2("4.3 Paleta rotativa (pastas sem cor reservada)"),
        p(
          "Qualquer outra pasta recebe, em ordem alfabética, a próxima cor livre desta lista. A mesma paleta colore os cargos no organograma — de propósito, para a plataforma não ter duas paletas categóricas.",
        ),
        swatchTable([
          ["#A3E635", "Rotativa 1", "Lima."],
          ["#FACC15", "Rotativa 2", "Amarelo."],
          ["#818CF8", "Rotativa 3", "Índigo claro."],
          ["#2DD4BF", "Rotativa 4", "Turquesa."],
          ["#FB7185", "Rotativa 5", "Coral."],
          ["#C4B5FD", "Rotativa 6", "Lavanda."],
          ["#FDBA74", "Rotativa 7", "Pêssego."],
          ["#F87171", "Rotativa 8", "Vermelho claro."],
          ["#5EEAD4", "Rotativa 9", "Água."],
          ["#D8B4FE", "Rotativa 10", "Lilás."],
        ]),
        spacer(160),
        p(
          "Esgotada a lista, ela recomeça do início. Sem pasta (ou na raiz), o nó fica #94A3B8.",
          { color: GRAY, size: 20 },
        ),
        spacer(240),

        // ------------------- 5. LINHAS -------------------
        h1("5. As linhas (arestas)"),
        about(
          "Quatro tipos de ligação, três cores. A cor diz o que sustenta a ligação; a opacidade e o tracejado dizem o quanto ela importa agora.",
        ),
        h2("5.1 Cor por tipo de ligação"),
        swatchTable([
          [
            "#FFCA28",
            "Wikilink — citação direta",
            "Âmbar. Igual nos dois modos. rgba(255,202,40,α).",
          ],
          [
            "#22D3EE",
            "Tag — nota ↔ assunto",
            "Ciano, igual ao nó de tag. Igual nos dois modos. rgba(34,211,238,α).",
          ],
          [
            "#64748B",
            "Pasta e Relação — MODO CLARO",
            "O cinza da linha no tema claro. rgba(100,116,139,α).",
          ],
          [
            "#94A3B8",
            "Pasta e Relação — MODO ESCURO",
            "O cinza da linha no tema escuro. rgba(148,163,184,α).",
          ],
        ]),
        spacer(160),
        p(
          "A relação entre duas tags usa o MESMO cinza neutro da aresta de pasta, de propósito: o peso da relação aparece no tooltip e na tolerância de clique, não numa cor nova.",
          { color: GRAY, size: 20 },
        ),
        h2("5.2 Opacidade"),
        table(
          ["Estado da linha", "Modo claro", "Modo escuro"],
          [
            ["Inativa — wikilink", "0,306 (0,18 × 1,7)", "0,18"],
            ["Inativa — tag, pasta, relação", "0,204 (0,12 × 1,7)", "0,12"],
            [
              "Ativa (sob o cursor, clicada ou ligada ao nó em destaque)",
              "0,60",
              "0,60",
            ],
            [
              "Pulso durante a busca da IA",
              "soma de 0,14 a 0,40 ao valor base",
              "igual",
            ],
            ["Teto absoluto", "0,85", "0,85"],
          ],
          W3,
        ),
        spacer(140),
        p(
          "O reforço de 1,7× no modo claro existe porque, no fundo #F8FAFC, as arestas com a opacidade do tema escuro simplesmente sumiam.",
          { color: GRAY, size: 20 },
        ),
        h2("5.3 Espessura e tracejado"),
        table(
          ["Propriedade", "Valor", "Observação"],
          [
            [
              "Espessura inativa",
              "1 px",
              "Dividida pela escala — constante na tela",
            ],
            ["Espessura ativa", "1,6 px", "Idem"],
            ["Wikilink", "Linha contínua", "Sem tracejado"],
            [
              "Pasta",
              "Tracejado 2 / 4",
              "Traço curto, intervalo maior — o mais discreto",
            ],
            ["Tag", "Tracejado 5 / 4", "—"],
            ["Relação", "Tracejado 5 / 4", "Mesmo padrão da tag"],
          ],
          W3,
        ),
        spacer(140),
        p(
          "A espessura NÃO varia com o peso da relação: aplicá-lo engrossava todas as linhas de 1,25× a 3× e mudava a cara do grafo. O peso entra só na tolerância de clique.",
          { color: GRAY, size: 20 },
        ),
        h2("5.4 Comprimento de repouso da mola"),
        table(
          ["Tipo de ligação", "Repouso (px)", "Leitura"],
          [
            [
              "Pasta",
              "58",
              "A mais curta — mantém a pasta colada no que ela contém",
            ],
            ["Tag", "66", "—"],
            ["Relação", "96", "—"],
            [
              "Wikilink (e demais)",
              "110",
              "A mais longa — citações podem ficar distantes",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 6. RÓTULOS -------------------
        h1("6. Rótulos dos nós"),
        about(
          "O texto sob cada bolinha. É aqui — e só aqui, fora das linhas cinza — que o tema muda a cor do que se desenha no canvas.",
        ),
        swatchTable([
          [
            "#334155",
            "Rótulo comum — modo claro",
            "rgba(51,65,85, 0.85) — slate-700 a 85%.",
          ],
          [
            "#E2E8F0",
            "Rótulo comum — modo escuro",
            "rgba(226,232,240, 0.70) — slate-200 a 70%.",
          ],
          [
            "#0F172A",
            "Rótulo em destaque — claro",
            "Sólido, sem transparência.",
          ],
          ["#FFFFFF", "Rótulo em destaque — escuro", "Branco puro."],
        ]),
        spacer(160),
        p(
          "Rótulo de hub (tudo que não é nota) não usa nenhuma das quatro: sai na COR DO PRÓPRIO NÓ, em peso 600.",
        ),
        spacer(140),
        table(
          ["Propriedade", "Valor"],
          [
            ["Família", "Inter, system-ui, sans-serif"],
            ["Tamanho", "11 px (constante na tela — dividido pela escala)"],
            ["Peso", "600 para hubs; normal para notas"],
            ["Alinhamento", "Centralizado no nó"],
            ["Posição", "13 px abaixo da borda inferior da bolinha"],
            ["Corte", "Acima de 26 caracteres: 25 + reticências (…)"],
            [
              "Quem é rotulado",
              "Sempre os hubs; notas só com ≤ 40 nós visíveis ou em destaque",
            ],
          ],
          W2,
        ),
        spacer(240),

        // ------------------- 7. ANIMAÇÃO -------------------
        h1("7. Animação de “pensando”"),
        about(
          "Enquanto a IA busca na memória ou o repositório sincroniza, o grafo inteiro respira e pulsos percorrem as conexões.",
        ),
        table(
          ["Elemento", "Especificação"],
          [
            [
              "Respiração do grafo",
              "Escala de ±12% em torno do centro da viewport, senoidal",
            ],
            [
              "Pulso nas arestas",
              "Soma de 0,14 a 0,40 à opacidade de todas as linhas",
            ],
            [
              "Partículas de dados",
              "Círculos de 2,2 px correndo da origem ao destino",
            ],
            ["Cor da partícula", "#FFD54F a 95% — rgba(255,213,79, 0.95)"],
            ["Halo da partícula", "#FFCA28, desfoque de 10 px × escala"],
            [
              "Agitação da física",
              "± 0,45 de velocidade aleatória por eixo, a cada passo",
            ],
            [
              "Respiração dos nós",
              "Halo + 9 px oscilando ± 7 px, com fase distinta por nó",
            ],
          ],
          W2,
        ),
        spacer(240),

        // ------------------- 8. FÍSICA -------------------
        h1("8. Física do layout"),
        about(
          "O grafo se organiza sozinho: nós se repelem, ligações puxam como molas e uma gravidade fraca segura tudo no centro.",
        ),
        table(
          ["Constante", "Valor", "Papel"],
          [
            [
              "Repulsão (C)",
              "3600 + nós visíveis × 12",
              "Grafos maiores espalham mais",
            ],
            ["Mola (K)", "0,013", "Força das ligações"],
            ["Gravidade (G)", "0,009", "Atração ao centro da viewport"],
            ["Amortecimento", "0,90", "Freia o movimento a cada quadro"],
            [
              "Velocidade máxima",
              "14 px por quadro",
              "Evita nós “disparando”",
            ],
            [
              "Limiar de repouso",
              "0,05 px de movimento máximo",
              "Abaixo disso começa a contar para dormir",
            ],
            [
              "Quadros até dormir",
              "45",
              "Depois disso a física para até nova interação",
            ],
            [
              "Pré-aquecimento",
              "até 3000 passos antes do 1º quadro",
              "Entrega o grafo já assentado",
            ],
          ],
          W3,
        ),
        spacer(160),
        p("Massa na repulsão — hubs empurram mais que folhas:"),
        table(
          ["Tipo de nó", "Massa", "Tipo de nó", "Massa"],
          [
            ["Categoria", "2,2", "Tag", "1,7"],
            ["Projeto", "2,2", "Hub de tag", "1,7"],
            ["Pasta", "2,2", "Nota", "1,0"],
            ["Pessoa", "1,9", "—", "—"],
          ],
          W4,
        ),
        spacer(140),
        p(
          "Não há limite de área: o grafo cresce à vontade e quem se ajusta é a câmera. Prender os nós nas bordas os enfileirava numa reta.",
          { color: GRAY, size: 20 },
        ),
        spacer(240),

        // ------------------- 9. CÂMERA E INTERAÇÃO -------------------
        h1("9. Câmera e interação"),
        about(
          "Zoom, arrasto e clique. O enquadramento é automático até o usuário assumir o controle; um duplo clique no vazio devolve o automático.",
        ),
        table(
          ["Item", "Especificação"],
          [
            ["Escala mínima", "0,03×"],
            ["Escala máxima", "4×"],
            [
              "Zoom pela roda",
              "Exponencial, ancorado no cursor (o ponto sob o cursor não se move)",
            ],
            [
              "Pinça (toque)",
              "Mesma faixa 0,03–4×, ancorada no ponto entre os dois dedos",
            ],
            [
              "Enquadramento automático",
              "Caixa de todos os nós + 24 px, com 10% de folga; escala limitada a 1,4×",
            ],
            [
              "Suavização do enquadramento",
              "8% de aproximação por quadro",
            ],
            ["Voltar ao automático", "Duplo clique numa área vazia"],
            ["Tolerância de clique", "6 px na tela, em nós e em linhas"],
            ["Prioridade de clique", "Perto das pontas, o nó ganha da linha"],
            ["Cursor — fundo vazio", "grab / grabbing ao arrastar"],
            ["Cursor — sobre nó ou linha", "pointer"],
          ],
          W2,
        ),
        spacer(140),
        p(
          "Clicar num nó realça ele e todos os vizinhos diretos; os demais caem para 35% de opacidade.",
          { color: GRAY, size: 20 },
        ),
        spacer(240),

        // ------------------- 10. OVERLAY -------------------
        h1("10. Controles sobre o canvas"),
        about(
          "Tudo o que flutua por cima do grafo: os chips de camada (que também são a legenda), o status de sincronização, a dica e o tooltip.",
        ),
        h2("10.1 Chip de camada"),
        p(
          "Canto superior direito. Botão e legenda na mesma peça: a bolinha do chip usa a cor da camada.",
        ),
        table(
          ["Propriedade", "Modo claro", "Modo escuro"],
          [
            ["Fundo — ligado", "#FFFFFF", "#1E2A48 (dark-700)"],
            ["Borda — ligado", "#CBD5E1 (gray-300)", "#334155 (dark-500)"],
            ["Texto — ligado", "#334155 (gray-700)", "#CBD5E1 (dark-100)"],
            ["Fundo — desligado", "#FFFFFF a 70%", "#16203A a 70% (dark-800)"],
            ["Borda — desligado", "#E2E8F0 (gray-200)", "#273458 (dark-600)"],
            ["Texto — desligado", "#94A3B8 (gray-400)", "#64748B (dark-300)"],
            ["Bolinha da legenda", "8 px, cor da camada (#22D3EE)", "igual"],
            ["Opacidade da bolinha", "100% ligado / 35% desligado", "igual"],
            ["Tipografia", "10 px (text-tiny)", "igual"],
            [
              "Forma",
              "Cantos de 6 px, 8 × 4 px de padding, sombra leve",
              "igual",
            ],
          ],
          W3,
        ),
        h2("10.2 Status de sincronização"),
        table(
          ["Estado", "Modo claro", "Modo escuro"],
          [
            [
              "Sincronizando",
              "Fundo branco, texto #475569 (gray-600), spinner de 12 px",
              "Fundo #1E2A48, texto #94A3B8",
            ],
            [
              "Concluído",
              "Bolinha #10B981 (emerald-500) de 8 px + contagem",
              "igual",
            ],
            [
              "Falha",
              "Fundo #FEF2F2 (red-50), texto #DC2626 (red-600)",
              "Fundo vermelho a 10%, texto #F87171",
            ],
          ],
          W3,
        ),
        h2("10.3 Dica inferior"),
        table(
          ["Propriedade", "Modo claro", "Modo escuro"],
          [
            ["Posição", "16 px da borda inferior e do início", "igual"],
            ["Fundo", "#FFFFFF a 70%, com desfoque", "#1E2A48 a 70%, com desfoque"],
            ["Texto", "#64748B (gray-500), 10 px", "#64748B (dark-300), 10 px"],
            [
              "Interação",
              "Sem eventos de ponteiro — não rouba o clique",
              "igual",
            ],
          ],
          W3,
        ),
        h2("10.4 Tooltip do nó e da linha"),
        table(
          ["Propriedade", "Modo claro", "Modo escuro"],
          [
            ["Fundo", "#0F172B (gray-900)", "#E2E8F0 (dark-50)"],
            ["Texto", "#FFFFFF", "#0F172B (dark-900)"],
            ["Tamanho do texto", "12 px", "igual"],
            [
              "Forma",
              "Cantos de 6 px, 8 × 4 px de padding, sombra forte",
              "igual",
            ],
            ["Posição", "12 px à direita e abaixo do cursor", "igual"],
            ["Conteúdo — nó", "Título do nó", "igual"],
            ["Conteúdo — linha", "“A × B · N conteúdos”", "igual"],
            [
              "No toque",
              "Some ao soltar o dedo (não existe hover)",
              "igual",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 11. PAINEL -------------------
        h1("11. Painel de contexto"),
        about(
          "Abre à direita ao clicar num nó de tag, pessoa ou categoria, ou numa linha. É sobreposto ao canvas — se encolhesse o grafo, a física reaqueceria e tudo daria um salto.",
        ),
        table(
          ["Propriedade", "Modo claro", "Modo escuro"],
          [
            ["Largura", "100% até o máximo de 320 px", "igual"],
            ["Fundo", "#FFFFFF", "#1E2A48 (dark-700)"],
            [
              "Borda de início",
              "1 px #E2E8F0 (gray-200)",
              "1 px #273458 (dark-600)",
            ],
            ["Sombra", "shadow-xl", "igual"],
            ["Divisórias entre seções", "1 px #E2E8F0", "1 px #273458"],
            [
              "Título do painel",
              "14 px, semibold, #1E293B (gray-800)",
              "#E2E8F0 (dark-50)",
            ],
            [
              "Rótulo de seção",
              "11 px, caixa alta, espaçada, #94A3B8",
              "#64748B (dark-300)",
            ],
            [
              "Ícone do item",
              "28 px, cantos 6 px, fundo #F1F5F9, ícone #64748B",
              "fundo #273458, ícone #94A3B8",
            ],
            ["Título do item", "13 px, medium, #1E293B", "#CBD5E1 (dark-100)"],
            ["Hover do item", "Fundo #F8FAFC, cantos de 8 px", "Fundo #273458"],
            ["Contador de peso", "11 px, #94A3B8", "#64748B"],
            [
              "Espaçamento das seções",
              "16 px na horizontal, 12 px na vertical",
              "igual",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 12. ESTADOS -------------------
        h1("12. Estados da tela"),
        about(
          "O que aparece antes de existir um grafo, e enquanto a pasta está sendo lida.",
        ),
        table(
          ["Estado", "Modo claro", "Modo escuro"],
          [
            [
              "Lendo a pasta",
              "Véu #F8FAFC a 60%, spinner de 20 px, texto 14 px #475569",
              "Véu #0B1220 a 60%, texto #CBD5E1",
            ],
            [
              "Vazio — moldura do ícone",
              "56 px, cantos 16 px, fundo #0F172B a 5%",
              "Fundo branco a 5%",
            ],
            ["Vazio — ícone", "Pasta, 28 px, traço 1,5, #64748B", "#CBD5E1"],
            [
              "Vazio — texto",
              "14 px, #64748B, largura máx. 384 px, centralizado",
              "#CBD5E1",
            ],
            [
              "Vazio — botão",
              "Primário: slate #0F172B sobre âmbar #FFCA28",
              "igual",
            ],
          ],
          W3,
        ),
        spacer(240),

        // ------------------- 13. REGRAS -------------------
        h1("13. Regras ao mexer no grafo"),
        bullet(
          "Não troque a cor de uma bolinha por causa do tema: a cor significa o tipo do nó, e o significado não pode mudar quando o usuário alterna claro/escuro.",
        ),
        bullet(
          "Só três coisas mudam com o tema dentro do canvas: o fundo, o cinza das linhas e a cor dos rótulos — mais o miolo dos nós vazados.",
        ),
        bullet(
          "Não introduza cor nova: pessoa e categoria reusam cores de pasta justamente para a paleta não crescer.",
        ),
        bullet(
          "Traços e rótulos devem ser sempre divididos pela escala da câmera — sem isso somem no zoom de saída.",
        ),
        bullet(
          "A opacidade das linhas no modo claro tem reforço de 1,7×. Remover isso faz o grafo parecer vazio no tema claro.",
        ),
        bullet(
          "Espessura de linha não carrega peso de relação — esse dado vive no tooltip e na tolerância de clique.",
        ),
        bullet("O painel é sempre sobreposto, nunca empurra o canvas."),
        spacer(280),
        p("Documento para o time de frontend · beculture · Setembro 2026", {
          color: GRAY,
          size: 18,
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "Padroes-Visuais-Grafo-beculture.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("Gerado:", outPath);
});
