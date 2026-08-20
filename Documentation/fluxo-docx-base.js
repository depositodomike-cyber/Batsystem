// Base compartilhada dos documentos Fluxo-*.docx.
//
// Junta as duas convenções que o repositório já tinha: a apresentação da marca
// beculture (capa, cabeçalho/rodapé paginado, âmbar + slate, tabelas zebradas)
// de docs/generate-menu-patterns-docx.mjs, e a estrutura de conteúdo dos
// Fluxo-*.docx (A4, seções numeradas de "1. Visão geral" a "N. Resumo do
// percurso", H2 sem número, linguagem de negócio).
//
// Especificações visuais não entram nos documentos gerados por aqui — cores,
// espaçamento e estilos são assunto do Padroes-Visuais-Menu-beculture.docx.
//
// A lib `docx` não está em nenhum package.json do repo (igual a gen-deck.js):
//   npm install -g docx
//   NODE_PATH="$(npm root -g)" node Documentation/gen-fluxo-<tema>.js
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
  PageBreak,
  PageNumber,
} = require("docx");
const fs = require("fs");

// Paleta da marca (mesma de docs/generate-menu-patterns-docx.mjs).
const PRIMARY = "FFB300";
const SLATE = "0F172B";
const GRAY = "64748B";
const BORDER = "E2E8F0";
const HEADER_BG = "0F172B";
const ALT_ROW = "F8FAFC";
const BODY = "1E293B";

// A4 (11906 x 16838) com margens de 1440, como os demais Fluxo-*.docx.
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9026

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

/** Parágrafo de corpo. */
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
        color: opts.color ?? BODY,
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
        size: level === HeadingLevel.HEADING_1 ? 30 : 24,
        color: SLATE,
      }),
    ],
  });
}

/** Seção numerada ("1. Visão geral"). */
const h1 = (t) => heading(t, HeadingLevel.HEADING_1);
/** Subtópico sem número ("Campos", "Regras", "Ao salvar"). */
const h2 = (t) => heading(t, HeadingLevel.HEADING_2);

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, font: "Calibri", size: 22, color: BODY })],
  });
}

/** Bullet com o termo em negrito antes do travessão ("Termo — explicação"). */
function bulletTermo(termo, texto, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80, line: 276 },
    children: [
      new TextRun({
        text: termo,
        font: "Calibri",
        size: 22,
        bold: true,
        color: SLATE,
      }),
      new TextRun({
        text: " — " + texto,
        font: "Calibri",
        size: 22,
        color: BODY,
      }),
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
      fill: isHeader ? HEADER_BG : opts.fill ?? "FFFFFF",
    },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text,
            font: "Calibri",
            size: opts.size ?? 18,
            bold: isHeader || opts.bold,
            color: isHeader ? "FFFFFF" : opts.color ?? BODY,
          }),
        ],
      }),
    ],
  });
}

/** Tabela com cabeçalho slate, zebrado e primeira coluna em negrito. */
function table(headers, rows, colWidths) {
  const widths =
    colWidths ?? headers.map(() => Math.floor(CONTENT_W / headers.length));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: headers.map((hd, i) =>
          cell(hd, { header: true, width: widths[i] }),
        ),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            children: row.map((c, i) =>
              cell(String(c), {
                width: widths[i],
                fill: ri % 2 === 1 ? ALT_ROW : "FFFFFF",
                bold: i === 0,
              }),
            ),
          }),
      ),
    ],
  });
}

function spacer(after = 200) {
  return new Paragraph({ spacing: { after }, children: [] });
}

/**
 * Capa: eyebrow âmbar, título, frase de escopo e tabela Campo/Valor. Termina em
 * quebra de página, então o corpo começa na página 2.
 */
function capa({ eyebrow, titulo, escopo, metadados }) {
  return [
    new Paragraph({
      spacing: { before: 400, after: 80 },
      children: [
        new TextRun({
          text: eyebrow,
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
          text: titulo,
          font: "Calibri",
          size: 52,
          bold: true,
          color: SLATE,
        }),
      ],
    }),
    p(escopo, { color: GRAY, after: 280 }),
    table(["Campo", "Valor"], metadados, [2600, 6426]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function cabecalho(nomeDoDocumento) {
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 80 },
        tabStops: [{ type: "right", position: CONTENT_W }],
        children: [
          new TextRun({
            text: "beculture  ·  Documentação de Produto",
            font: "Calibri",
            size: 16,
            color: GRAY,
          }),
          new TextRun({
            text: "\t" + nomeDoDocumento,
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
  });
}

function rodape() {
  const run = (opts) =>
    new TextRun({ font: "Calibri", size: 16, color: GRAY, ...opts });
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDER } },
        spacing: { before: 120 },
        alignment: AlignmentType.RIGHT,
        children: [
          run({ text: "Página " }),
          run({ children: [PageNumber.CURRENT] }),
          run({ text: " de " }),
          run({ children: [PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });
}

/** Linha de fecho, igual em todos os documentos da série. */
function fecho() {
  return p("Documento funcional · beculture · Agosto 2026", {
    color: GRAY,
    size: 18,
  });
}

const numbering = {
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
};

/**
 * Monta o documento e grava no caminho indicado. `children` é o corpo já
 * pronto (normalmente `[...capa({...}), ...secoes, spacer(280), fecho()]`).
 */
function gerar({ nomeDoDocumento, children, outPath }) {
  const doc = new Document({
    numbering,
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        headers: { default: cabecalho(nomeDoDocumento) },
        footers: { default: rodape() },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(outPath, buffer);
    console.log("Updated:", outPath);
  });
}

module.exports = {
  // paleta
  PRIMARY,
  SLATE,
  GRAY,
  BORDER,
  HEADER_BG,
  ALT_ROW,
  BODY,
  CONTENT_W,
  // blocos de conteúdo
  p,
  h1,
  h2,
  bullet,
  bulletTermo,
  cell,
  table,
  spacer,
  // estrutura
  capa,
  fecho,
  gerar,
};
