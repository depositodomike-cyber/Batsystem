import {
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
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRIMARY = "FFB300";
const SLATE = "0F172B";
const GRAY = "64748B";
const BORDER = "E2E8F0";
const HEADER_BG = "0F172B";
const ALT_ROW = "F8FAFC";
const AMBER_SOFT = "FFF8E1";

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

/** Short practical intro under each topic */
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
            color: isHeader ? "FFFFFF" : opts.color ?? "1E293B",
          }),
        ],
      }),
    ],
  });
}

function table(headers, rows, colWidths) {
  const widths = colWidths ?? headers.map(() => Math.floor(9360 / headers.length));
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

function spacer(after = 200) {
  return new Paragraph({ spacing: { after }, children: [] });
}

function colorSwatchRow(name, hex, usage) {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 1400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: hex.replace("#", "") },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [new Paragraph({ children: [] })],
      }),
      cell(name, { width: 2400, bold: true }),
      cell(hex, { width: 1800 }),
      cell(usage, { width: 3760 }),
    ],
  });
}

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
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
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
                  text: "Padrões Visuais do Menu",
                  font: "Calibri",
                  size: 16,
                  color: GRAY,
                }),
              ],
            }),
            new Paragraph({
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: PRIMARY,
                },
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
        // COVER
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
              text: "Padrões Visuais do Menu",
              font: "Calibri",
              size: 52,
              bold: true,
              color: SLATE,
            }),
          ],
        }),
        p(
          "Este documento descreve como o menu lateral deve parecer e se comportar na tela: cores, tipografia, tamanhos, estados (hover, ativo) e adaptação a celular/desktop. Use como referência ao criar ou ajustar itens de navegação.",
          { color: GRAY, after: 280 },
        ),
        table(
          ["Campo", "Valor"],
          [
            ["Produto", "beculture"],
            ["Layout padrão", "Menu lateral único (Sideblock)"],
            ["Layout alternativo", "Rail de ícones + painel de texto (Main Layout)"],
            ["Cor principal", "Âmbar #FFB300 (ativo) / #FFCA28 (dark)"],
            ["Cor de estrutura", "Slate #0F172B"],
            ["Fonte", "Inter"],
            ["Ícones", "Heroicons (outline)"],
            ["Versão", "v1.1 — Agosto 2026"],
          ],
          [2800, 6560],
        ),
        spacer(360),

        // 1
        heading("1. O que é o menu", HeadingLevel.HEADING_1),
        about(
          "É a barra à esquerda da tela pela qual o usuário navega entre as áreas do produto. Existem dois formatos possíveis; o padrão de produção é o menu lateral único.",
        ),
        bullet(
          "Menu lateral único (Sideblock) — uma coluna de ~224px com seções, ícone + nome do item e uma barra colorida no item ativo.",
        ),
        bullet(
          "Menu em dois painéis (Main Layout) — uma faixa estreita só com ícones e, ao lado, um painel com os nomes das subpáginas.",
        ),
        p(
          "Em telas menores, o menu sai da vista e abre como gaveta (drawer) ao tocar no botão de hambúrguer.",
          { after: 200 },
        ),

        // 2
        heading("2. Cores da marca no menu", HeadingLevel.HEADING_1),
        about(
          "São as cores que o usuário vê no menu: o âmbar marca o que está selecionado; o slate organiza texto e fundos. Não invente hex novos — use esta paleta.",
        ),
        spacer(60),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1400, 2400, 1800, 3760],
          rows: [
            new TableRow({
              children: [
                cell("Amostra", { header: true, width: 1400 }),
                cell("Nome", { header: true, width: 2400 }),
                cell("HEX", { header: true, width: 1800 }),
                cell("Onde aparece", { header: true, width: 3760 }),
              ],
            }),
            colorSwatchRow("Âmbar ativo", "#FFB300", "Texto e barra do item selecionado (tema claro)"),
            colorSwatchRow("Âmbar dark", "#FFCA28", "Texto e barra do item selecionado (tema escuro)"),
            colorSwatchRow("Âmbar suave", "#FFF8E1", "Fundos leves e badges suaves"),
            colorSwatchRow("Slate escuro", "#0F172B", "Fundos escuros / estrutura"),
            colorSwatchRow("Slate médio", "#64748B", "Títulos de seção e texto secundário"),
            colorSwatchRow("Slate claro", "#E2E8F0", "Bordas e linhas divisórias"),
            colorSwatchRow("Cinza hover", "#F8FAFC", "Fundo ao passar o mouse (tema claro)"),
          ],
        }),
        spacer(160),
        p(
          "Regra simples: item ativo = âmbar. Item em repouso = cinza/slate. Hover = fundo cinza bem claro (ou equivalente no dark).",
          { after: 200 },
        ),

        // 3
        heading("3. Tipografia", HeadingLevel.HEADING_1),
        about(
          "Define o tamanho e o peso do texto que aparece no menu — nomes dos itens, títulos de seção e badges. A fonte padrão é Inter em todo o menu.",
        ),
        table(
          ["Uso na tela", "Tamanho", "Estilo"],
          [
            ["Nome do item de menu", "13px (line-height 18px)", "Peso médio, letter-spacing um pouco aberto"],
            ["Título de seção/grupo", "12px", "Maiúsculas, peso médio, letter-spacing maior"],
            ["Badge (número/aviso no item)", "11px", "Compacto"],
            ["Seletor de produto (topo)", "15px", "Um pouco maior que o item"],
          ],
          [3200, 2400, 3760],
        ),
        spacer(),

        // 4
        heading("4. Arredondamentos e sombra", HeadingLevel.HEADING_1),
        about(
          "Controla o “cantinho” dos botões/itens e se o painel lateral tem borda fina ou sombra suave. Mantém o menu alinhado ao restante da interface.",
        ),
        table(
          ["Elemento", "Valor", "Quando usar"],
          [
            ["Item do menu lateral", "10px de raio", "Links com ícone + texto"],
            ["Botão do rail de ícones", "14px de raio", "Quadrados de 44×44 no Main Layout"],
            ["Barra do item ativo", "extremidade arredondada", "Faixa vertical de 4px à esquerda"],
            ["Bolinha do item filho ativo", "círculo pleno", "Indicador de 6px nos subitens"],
            ["Sombra do painel (skin shadow)", "sombra suave em tom slate", "Quando o tema usa skin “shadow”"],
            ["Borda do painel (skin bordered)", "1px cinza claro", "Skin padrão “bordered”"],
          ],
          [3000, 2800, 3560],
        ),
        spacer(),

        // 5
        heading("5. Menu lateral único (padrão)", HeadingLevel.HEADING_1),
        about(
          "É o menu que o produto usa por padrão: uma coluna fixa à esquerda com logo/produto no topo, seções e lista de páginas. Em notebook/celular estreito, vira uma gaveta sobre o conteúdo.",
        ),

        heading("5.1 Tamanhos do painel", HeadingLevel.HEADING_2),
        about(
          "Medidas da coluna do menu e das faixas superiores — para o conteúdo da página não “encostar” errado no menu.",
        ),
        table(
          ["Elemento", "Medida"],
          [
            ["Largura do menu", "224px (14rem)"],
            ["Altura do topo do menu (produto)", "61px"],
            ["Altura do header da aplicação", "65px"],
            ["Espaço inferior da lista", "24px (padding bottom)"],
            ["Overlay no mobile (fundo escurecido)", "preto/cinza ~50% + leve blur"],
          ],
          [4200, 5160],
        ),
        spacer(),

        heading("5.2 Título de seção (grupo)", HeadingLevel.HEADING_2),
        about(
          "É o rótulo em maiúsculas que agrupa itens parecidos (ex.: “Geral”, “Relatórios”). Fica colado no topo enquanto a lista rola, com um fade suave embaixo.",
        ),
        table(
          ["Propriedade", "Especificação"],
          [
            ["Texto", "12px, maiúsculas, peso médio, cor slate médio (#64748B)"],
            ["Ao passar o mouse", "texto mais escuro (#0F172B no claro)"],
            ["Espaçamento da seção", "12px acima; título com padding horizontal 24px"],
            ["Espaço entre itens", "2px"],
          ],
          [2800, 6560],
        ),
        spacer(),

        heading("5.3 Item de menu (nível principal)", HeadingLevel.HEADING_2),
        about(
          "É cada linha clicável com ícone + nome (ex.: “Dashboard”). Quando está ativo, o texto fica âmbar e aparece uma barrinha vertical à esquerda.",
        ),
        table(
          ["Estado", "Tema claro", "Tema escuro"],
          [
            ["Normal", "Texto cinza escuro", "Texto cinza claro"],
            ["Hover / foco", "Fundo cinza claro + texto quase preto", "Fundo escuro translúcido + texto claro"],
            ["Ativo (página atual)", "Texto âmbar #FFB300", "Texto âmbar #FFCA28"],
            ["Indicador de ativo", "Barra 4px à esquerda, âmbar", "Mesma barra, âmbar claro"],
          ],
          [2400, 3480, 3480],
        ),
        spacer(120),
        table(
          ["Detalhe", "Especificação"],
          [
            ["Padding interno", "12px horizontal · 6px vertical"],
            ["Raio", "10px"],
            ["Ícone", "20px, traço 1.5; um pouco transparente (80%) até o hover"],
            ["Espaço ícone ↔ texto", "12px"],
            ["Transição de cor", "suave (~200–300ms)"],
          ],
          [2800, 6560],
        ),
        spacer(),

        heading("5.4 Subitem (dentro de um grupo expansível)", HeadingLevel.HEADING_2),
        about(
          "São os itens filhos que aparecem quando o usuário abre um item com setinha. O ativo usa uma bolinha âmbar em vez da barra vertical.",
        ),
        table(
          ["Estado", "Especificação"],
          [
            ["Normal", "Texto cinza escuro / cinza claro no dark"],
            ["Hover", "Fundo cinza claro (ou equivalente dark)"],
            ["Ativo", "Texto âmbar + bolinha 6px com borda na cor do texto"],
            ["Padding vertical", "8px"],
            ["Seta (chevron)", "16px; gira 90° quando aberto"],
          ],
          [2800, 6560],
        ),
        spacer(),

        heading("5.5 Seletor de produto (topo do menu)", HeadingLevel.HEADING_2),
        about(
          "É o botão no topo do menu que troca o produto/contexto. Abre um pequeno painel com a lista; o item escolhido fica em âmbar e negrito.",
        ),
        bullet("Texto: 15px"),
        bullet("Cantos: 14px"),
        bullet("Foco no teclado: anel âmbar suave"),
        bullet("Setinha: 16px"),
        bullet("Abertura do painel: ~200ms, fade + leve deslocamento"),

        // 6
        heading("6. Menu em dois painéis (alternativo)", HeadingLevel.HEADING_1),
        about(
          "Formato opcional: à esquerda só ícones (como um “atalhos”); ao lado, o painel com os nomes das páginas daquela área. Útil quando há muitos módulos.",
        ),

        heading("6.1 Tamanhos", HeadingLevel.HEADING_2),
        about(
          "Larguras da faixa de ícones e do painel de texto — mudam um pouco em telas maiores.",
        ),
        table(
          ["Elemento", "Padrão", "Em telas ≥ 1024px"],
          [
            ["Faixa de ícones", "72px", "80px"],
            ["Painel de texto", "230px", "240px"],
            ["Largura total aproximada", "302px", "320px"],
            ["Topo do painel de texto", "64px de altura", "—"],
            ["Botão de ícone", "44×44px, raio 14px", "—"],
            ["Linha de item no painel", "34px de altura", "texto 13px"],
          ],
          [3000, 3180, 3180],
        ),
        spacer(),

        heading("6.2 Botão da faixa de ícones", HeadingLevel.HEADING_2),
        about(
          "Cada ícone grande na coluna estreita representa um módulo. O ativo ganha fundo âmbar bem suave; no desktop, ao pairar o mouse, aparece o nome em tooltip à direita.",
        ),
        table(
          ["Estado", "Tema claro", "Tema escuro"],
          [
            ["Normal", "Ícone cinza médio", "Ícone cinza claro"],
            ["Hover / foco", "Fundo âmbar ~20% opacidade", "Fundo escuro translúcido"],
            ["Ativo", "Fundo âmbar ~10% + ícone #FFB300", "Fundo âmbar ~15% + ícone #FFCA28"],
          ],
          [2200, 3580, 3580],
        ),
        spacer(100),
        bullet("Tamanho do ícone: 28px"),
        bullet("Espaço entre botões: 12–16px (um pouco mais apertado em telas médias)"),
        bullet("Tooltip: padding ~5×12px, cantos 8px"),

        heading("6.3 Item do painel de texto", HeadingLevel.HEADING_2),
        about(
          "São os nomes das páginas no segundo painel (sem ícone, só texto). O ativo fica âmbar e um pouco mais forte (peso médio).",
        ),
        table(
          ["Estado", "Especificação"],
          [
            ["Normal", "Texto cinza médio"],
            ["Hover", "Texto mais escuro / mais claro no dark"],
            ["Ativo", "Âmbar + peso médio"],
            ["Altura da linha", "34px"],
            ["Padding do painel", "16px nas laterais"],
          ],
          [2800, 6560],
        ),
        spacer(),

        heading("6.4 Subitem do painel de texto", HeadingLevel.HEADING_2),
        about(
          "Itens filhos no segundo painel. No hover, o texto “avança” um pouco para a direita (indentação); no ativo, aparece uma bolinha pequena âmbar.",
        ),
        table(
          ["Estado", "Especificação"],
          [
            ["Normal", "Texto cinza, padding horizontal 8px"],
            ["Hover", "Indentação extra (~16px) + mudança de cor"],
            ["Ativo", "Âmbar + peso médio + bolinha ~6px"],
            ["Transição", "~300ms (cor e padding)"],
          ],
          [2800, 6560],
        ),
        spacer(),

        heading("6.5 Linha divisória", HeadingLevel.HEADING_2),
        about(
          "Linha fina que separa grupos de itens no painel de texto, sem chamar atenção.",
        ),
        bullet("Altura: 1px · cor cinza claro (#E2E8F0) / equivalente no dark"),
        bullet("Margem vertical: ~10px"),

        // 7
        heading("7. Aparência do fundo do menu (skins)", HeadingLevel.HEADING_1),
        about(
          "Dois jeitos de “vestir” o painel: com borda fina (mais flat) ou com sombra suave (mais elevado). O padrão do produto é com borda.",
        ),
        table(
          ["Estilo", "Fundo", "Contorno"],
          [
            ["Com borda (padrão)", "Branco / slate bem escuro no dark", "Borda 1px cinza claro"],
            ["Com sombra", "Branco / slate elevado no dark (#18233A)", "Sombra suave, sem borda forte"],
          ],
          [2400, 3600, 3360],
        ),
        spacer(),

        // 8
        heading("8. Ícones", HeadingLevel.HEADING_1),
        about(
          "Tamanhos dos desenhos ao lado dos nomes (ou sozinhos no rail). Use sempre a mesma família (Heroicons outline) e o tamanho certo para cada contexto.",
        ),
        table(
          ["Onde aparece", "Tamanho"],
          [
            ["Faixa só de ícones (Main Layout)", "28px"],
            ["Item do menu lateral (Sideblock)", "20px, traço 1.5"],
            ["Setinha de abrir/fechar grupo", "16px"],
            ["Itens de configurações", "18px"],
            ["Logo no topo do rail", "40px"],
            ["Botão fechar (mobile)", "20–24px"],
          ],
          [4800, 4560],
        ),
        spacer(100),
        p(
          "Regra: no mesmo nível de menu, não misture tamanhos diferentes de ícone.",
          { after: 200 },
        ),

        // 9
        heading("9. Movimento e tempo", HeadingLevel.HEADING_1),
        about(
          "Quanto tempo o menu demora para abrir, fechar ou mudar de cor. Movimentos curtos e previsíveis — o menu não deve “dançar”.",
        ),
        table(
          ["O que acontece", "Tempo / sensação"],
          [
            ["Abrir/fechar o painel lateral", "~250ms, entrada um pouco mais suave"],
            ["Deslizar a faixa de ícones", "~200ms"],
            ["Mudança de cor no hover/ativo", "200–300ms"],
            ["Girar a setinha do grupo", "transição suave de rotação"],
            ["Abrir lista de produto / perfil", "~200ms com fade"],
            ["Botão hambúrguer virando X", "~250ms"],
          ],
          [4200, 5160],
        ),
        spacer(100),
        p(
          "Evite animações de hover com mais de 300ms — o menu precisa parecer imediato.",
          { after: 200 },
        ),

        // 10
        heading("10. Telas e breakpoints", HeadingLevel.HEADING_1),
        about(
          "Como o menu se adapta de celular a monitor grande. Os números abaixo são as larguras mínimas da tela em que o comportamento muda.",
        ),
        table(
          ["Nome", "A partir de", "O que o usuário vê"],
          [
            ["SM", "640px", "Base mobile / estreito"],
            ["MD", "768px", "No Main Layout, a faixa de ícones já pode aparecer"],
            ["LG", "1024px", "Em telas menores que isso, o menu tende a fechar ao navegar ou redimensionar"],
            ["XL", "1280px", "Menu lateral fixo na tela (Sideblock); nos dois painéis, ambos visíveis quando aberto"],
            ["2XL", "1536px", "Mais margem lateral na página"],
          ],
          [1400, 1800, 6160],
        ),
        spacer(120),
        bullet("Abaixo de 1280px (Sideblock): menu some da lateral e abre como gaveta com fundo escurecido."),
        bullet("No mobile/tablet: ao clicar em um item, o menu fecha para mostrar a página."),
        bullet("Em árabe ou outros layouts espelhados (RTL): a barra do ativo e as animações ficam do lado oposto."),

        // 11
        heading("11. Estados que o usuário precisa reconhecer", HeadingLevel.HEADING_1),
        about(
          "Checklist visual do que cada estado significa. Se o usuário não conseguir dizer “estou nesta página”, o ativo está errado.",
        ),
        table(
          ["Estado", "Como deve parecer"],
          [
            ["Normal", "Texto cinza, sem destaque de fundo"],
            ["Hover", "Fundo claro (ou translúcido no dark) + texto mais forte"],
            ["Foco (teclado)", "Mesmo feedback do hover — sem outline azul do navegador"],
            ["Ativo (página atual)", "Âmbar + barra 4px (item pai) ou bolinha (filho) ou fundo suave (rail)"],
            ["Com badge", "Pílula pequena (altura ~18px), texto 11px, estilo suave"],
          ],
          [2400, 6960],
        ),
        spacer(),

        // 12
        heading("12. Faça / Não faça", HeadingLevel.HEADING_1),
        about(
          "Regras rápidas para manter o menu consistente entre telas e pessoas do time.",
        ),
        heading("Faça", HeadingLevel.HEADING_2),
        bullet("Use âmbar só para o que está ativo ou em destaque intencional"),
        bullet("Mantenha labels em 13px e títulos de seção em 12px maiúsculas"),
        bullet("Preserve a barra ou a bolinha do item ativo"),
        bullet("Use 20px de ícone no menu lateral e 28px no rail"),
        bullet("Teste tema claro, tema escuro e tela estreita (< 1280px)"),

        heading("Não faça", HeadingLevel.HEADING_2),
        bullet("Não coloque cards, pills extras ou selos flutuantes em cima do menu"),
        bullet("Não invente cores fora do âmbar/slate da marca"),
        bullet("Não misture tamanhos de ícone no mesmo nível"),
        bullet("Não deixe o item ativo sem indicador visual claro"),
        bullet("Não use animações longas ou efeitos de brilho no hover"),

        // 13 quick ref
        heading("13. Resumo rápido — item do menu lateral", HeadingLevel.HEADING_1),
        about(
          "Tabela de bolso para conferir o item principal do Sideblock sem reler o documento inteiro.",
        ),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1800, 2520, 2520, 2520],
          rows: [
            new TableRow({
              children: [
                cell("Estado", { header: true, width: 1800 }),
                cell("Texto", { header: true, width: 2520 }),
                cell("Fundo", { header: true, width: 2520 }),
                cell("Indicador", { header: true, width: 2520 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Normal", { width: 1800 }),
                cell("Cinza escuro", { width: 2520 }),
                cell("—", { width: 2520 }),
                cell("—", { width: 2520 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Hover", { width: 1800, fill: ALT_ROW }),
                cell("Quase preto", { width: 2520, fill: ALT_ROW }),
                cell("Cinza claro", { width: 2520, fill: ALT_ROW }),
                cell("—", { width: 2520, fill: ALT_ROW }),
              ],
            }),
            new TableRow({
              children: [
                cell("Ativo", {
                  width: 1800,
                  fill: AMBER_SOFT,
                  bold: true,
                  color: "B45309",
                }),
                cell("#FFB300", {
                  width: 2520,
                  fill: AMBER_SOFT,
                  color: "B45309",
                }),
                cell("—", { width: 2520, fill: AMBER_SOFT }),
                cell("Barra 4px âmbar", {
                  width: 2520,
                  fill: AMBER_SOFT,
                  color: "B45309",
                }),
              ],
            }),
          ],
        }),
        spacer(280),
        p(
          "Documento para o time de frontend · beculture · Agosto 2026",
          { color: GRAY, size: 18 },
        ),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "Padroes-Visuais-Menu-beculture.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log("Updated:", outPath);
