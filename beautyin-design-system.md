# Design System — Beautyin®

Construído a partir da análise do Instagram (@beautyinbr) e do site oficial beautyin.com. A Beautyin é uma marca brasileira de suplementos de colágeno e beleza com posicionamento premium, científico e aspiracional, cujo conceito-chave é "beleza e longevidade de dentro para fora".

---

## 1. Marca e Posicionamento

**Nome:** Beautyin® (sempre com a inicial minúscula no logotipo e o símbolo de registro ®)

**Tagline / Essência:** "Sua rotina de beleza e longevidade de dentro para fora" / "Beleza de dentro para fora."

**Proposta de valor:** colágeno para cada momento do dia, com suporte científico (peptídeos bioativos, Verisol®, GENU-IN® Life, HMB, BCAA, Glutamina, Melatonina).

**Arquitetura de produtos (sub-marcas):** a marca opera com uma família de produtos, cada um com identidade cromática própria mas seguindo o mesmo sistema de embalagem (lata + selo dourado de colágeno):

- **PUMP** Collagen Protein — preto/laranja (performance e treino)
- **morningbeauty** — laranja/sol (energia pela manhã)
- **sleepingbeauty** — azul/lua (recuperação e sono à noite)
- **beautydrink** — ciano (sem sabor) e rosa (cranberry)

---

## 2. Logotipo

O logotipo combina um **símbolo** e um **wordmark**.

O símbolo é um "b" estilizado e contínuo (traço fechado em forma de gota/folha) inscrito em um círculo. No avatar do Instagram aparece em dourado/champagne com acabamento 3D metálico sobre fundo bege claro. No site, aparece em versão flat (preto sobre branco, ou branco sobre fundo escuro).

O wordmark "beautyin®" usa letra minúscula, fonte sem serifa de peso médio, com o ® sobrescrito.

**Diretrizes:** preservar área de respiro mínima ao redor do logo equivalente à altura do símbolo "b"; nunca distorcer, recolorir fora da paleta oficial ou aplicar sombras não previstas.

---

## 3. Paleta de Cores

### Cores primárias
| Cor | Hex | RGB | Uso |
|---|---|---|---|
| Preto | `#010101` | rgb(1,1,1) | Texto e fundos escuros |
| Branco | `#FFFFFF` | rgb(255,255,255) | Fundo principal |
| Dourado / Champagne | `#F0C880` | rgb(240,200,128) | Cor de assinatura, selos, detalhes |

### Neutros de apoio
| Cor | Hex | Uso |
|---|---|---|
| Cinza claro | `#D5D5D5` / `#E5E5E5` | Bordas, divisórias |
| Cinza médio | `#868686` | Texto secundário |
| Cinza de fundo | `#F5F5F5` / `#F8F8F8` | Seções e cards |
| Cinza escuro | `#212529` | Texto alternativo |

### Cores funcionais / de produto
| Cor | Hex | Uso |
|---|---|---|
| Verde de ação | `#00A650` | Botões "Adicionar ao carrinho" / checkout |
| Laranja | destaque | Badges de frete, preços promocionais, PUMP/morningbeauty |
| Azul | linha | sleepingbeauty |
| Ciano | linha | beautydrink sem sabor |
| Rosa / Magenta | linha | beautydrink cranberry |

**Diretriz:** o dourado é a cor da marca (selos, detalhes e acentos premium, nunca grandes áreas de fundo). O verde é reservado à conversão. As cores de produto identificam cada SKU e não devem ser misturadas entre linhas.

---

## 4. Tipografia

**Fonte principal (toda a interface):** **Host Grotesk** — sans-serif geométrica/grotesca, usada em títulos, corpo, botões e navegação.

Hierarquia:

- **Títulos de seção (display):** Host Grotesk, peso 500, caixa alta, leve tracking — ex.: "ROTINAS COMPLETAS PARA O SEU DIA"
- **H1 (hero):** Host Grotesk, ~40px, peso 500, line-height 48px, cor preta
- **Corpo:** Host Grotesk regular, `#010101` sobre branco; secundário em `#868686`
- **Labels:** caixa alta, ~12–13px, tracking aberto

**Tipografia de expressão:** destaque serifado em itálico usado em peças de hero e títulos editoriais (ex.: "Colágeno para cada momento do seu dia"), conferindo tom sofisticado/editorial e contrastando com a Host Grotesk funcional da interface.

**Fontes de ícones:** `feather` (interface) e `JudgemeStar` (estrelas de avaliação).

---

## 5. Componentes de UI

- **Botão primário escuro:** fundo preto, texto branco em caixa alta, cantos levemente arredondados (ex.: "INSCREVER").
- **Botão de conversão:** fundo verde `#00A650`, texto branco em caixa alta ("ADICIONAR AO CARRINHO").
- **Botão secundário / outline:** transparente/translúcido, borda fina, texto preto caixa alta, `border-radius: 5px`, padding `10px 20px`, Host Grotesk 13px peso 500 ("COMPRAR", "VER TUDO").
- **Botões pill (hero):** totalmente arredondados, fundo translúcido/dourado claro, para benefícios.
- **Cards de produto:** fundo cinza claro, imagem centralizada, avaliação em estrelas, nome, preço (riscado + promocional em laranja), badge de desconto ("-5%") e "ESGOTADO".
- **Cards de benefício:** foto retrato com rótulo translúcido na base em caixa alta.
- **Campos de formulário:** borda fina cinza, cantos suaves, placeholder cinza.
- **Navegação:** header branco, logo, menu textual (Produtos, Benefícios, Sobre nós) com dropdowns, ícones de conta e carrinho.
- **Badge promocional:** círculo laranja sólido com texto branco ("frete grátis acima de R$300").

---

## 6. Iconografia e Elementos Gráficos

Ícones de interface lineares e minimalistas (feather), de traço fino. Produtos usam selo circular dourado de colágeno (com gramagem: 150/300/600), ícones de "zero açúcar/carbo/glúten/gordura/lactose" e selos de ingredientes (Verisol®, GENU-IN®). Elementos solares (morningbeauty) e lunares (sleepingbeauty) reforçam o conceito de rotina dia e noite.

---

## 7. Estilo Fotográfico e Direção de Arte

Fotografia clean, natural e aspiracional, com luz suave e dourada. Predominam tons de pele, beges e neutros, fundos minimalistas. Temas: pessoas reais em momentos de rotina (treino, descanso, manhã/noite, casal), still life elegante de produto e composições editoriais (gift guide). O feed do Instagram mantém coesão com paleta quente e neutra.

---

## 8. Tom de Voz

Comunicação acolhedora, científica e confiável, focada em bem-estar e autocuidado. Combina benefício emocional ("beleza de dentro para fora", "um ritual para o seu dia") com credibilidade técnica (ingredientes premium, peptídeos bioativos, comprovação de eficácia). Tom positivo, sem apelar a inseguranças, alinhado a longevidade e cuidado. Mensagens-chave: rotina dia/noite, ciência, premium, beleza integral.

---

## Resumo de Design Tokens

| Token | Valor |
|---|---|
| `color/primary-black` | #010101 |
| `color/white` | #FFFFFF |
| `color/brand-gold` | #F0C880 |
| `color/gray-border` | #D5D5D5 |
| `color/gray-text` | #868686 |
| `color/gray-bg` | #F5F5F5 |
| `color/action-green` | #00A650 |
| `font/primary` | Host Grotesk |
| `font/display-accent` | Serif itálico (campanhas) |
| `radius/button` | 5px / pill |
| `button/padding` | 10px 20px |
| `weight/heading` | 500 |

---

*Documento gerado a partir da análise das fontes oficiais da marca Beautyin® (Instagram @beautyinbr e beautyin.com).*
