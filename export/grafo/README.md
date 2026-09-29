# Grafo: componente standalone

Grafo *force-directed* em `<canvas>` 2D, extraído da tela **Repositório** do beculture
(`ts/demo/src/app/pages/ceo/MemoriaGrafo.tsx`). Este pacote traz **só o motor visual**:
física, câmera (zoom/pan/pinça), desenho, hit-test de nós e arestas, tooltip e seleção.

Ele **não** lê pastas, não chama API, não monta o grafo a partir de `.md` e não traz painel
lateral nem modais. Os dados entram prontos, e o que acontece no canvas sai por callbacks.

| | |
|---|---|
| Arquivo | [`Grafo.tsx`](./Grafo.tsx) (único arquivo, ~1100 linhas) |
| Dependências | `react` ≥ 18 (testado com 19.2). Nada mais. |
| Linguagem | TypeScript 5.x (`strict`), JSX `react-jsx` |
| Renderização | Canvas 2D + `requestAnimationFrame`, HiDPI (`devicePixelRatio`) |
| Estilo | Inline, sem Tailwind nem CSS externo |
| Navegadores | Qualquer um com Canvas 2D, Pointer Events e `ResizeObserver` |
| SSR | Seguro: todo acesso a DOM/`window` acontece dentro de `useEffect` |

---

## 1. Instalação

Não é um pacote npm. Copie o arquivo para o projeto de destino:

```bash
cp export/grafo/Grafo.tsx <seu-projeto>/src/components/Grafo.tsx
```

Garanta o React instalado (a única dependência):

```bash
npm install react react-dom
```

Para TypeScript, o `tsconfig` precisa ter `"jsx": "react-jsx"`, `"lib": ["DOM", "ESNext"]`
e `target` ≥ `ES2020`. O arquivo usa `satisfies`, então o TypeScript precisa ser **≥ 4.9**.

**Projeto em JavaScript puro:** transpile uma vez e use o `.js` gerado:

```bash
npx esbuild Grafo.tsx --outfile=Grafo.js --jsx=automatic --format=esm
```

**Fonte:** os rótulos usam `Inter, system-ui, sans-serif`. Carregue a Inter no app se
quiser o visual idêntico ao do beculture. Sem ela, cai na fonte do sistema.

---

## 2. Uso mínimo

```tsx
import { useMemo, useRef, useState } from "react";
import { Grafo, type Graph, type GrafoHandle, type Selecao } from "./Grafo";

export function MeuMapa() {
  const ref = useRef<GrafoHandle>(null);
  const [selecao, setSelecao] = useState<Selecao | null>(null);

  // IMPORTANTE: memoize. Uma referência nova de `graph` re-semeia o layout.
  const graph = useMemo<Graph>(
    () => ({
      nodes: [
        { id: "tag::produto", kind: "tag", pasta: null, titulo: "Produto", grau: 1, conteudos: ["a.md", "b.md"] },
        { id: "Pessoas/mike.md", kind: "pessoa", pasta: "Pessoas", titulo: "Mike", grau: 1, conteudos: ["a.md"] },
      ],
      links: [
        { source: "tag::produto", target: "Pessoas/mike.md", tipo: "relacao", fontes: ["a.md"] },
      ],
    }),
    [],
  );

  return (
    // O componente ocupa 100% do pai: o PAI precisa ter altura definida.
    <div style={{ height: "80vh" }}>
      <Grafo
        ref={ref}
        graph={graph}
        dark
        onSelecao={setSelecao}
        onClicarNota={(id) => abrirArquivo(id)}
      >
        {/* children = overlays por cima do canvas (painel, legenda, vazio…) */}
        {selecao && <MeuPainel selecao={selecao} onFechar={() => { setSelecao(null); ref.current?.limparSelecao(); }} />}
      </Grafo>
    </div>
  );
}
```

---

## 3. API

### 3.1 Props (`GrafoProps`)

| Prop | Tipo | Padrão | Descrição |
|---|---|---|---|
| `graph` | `Graph` | obrigatório | Nós e arestas. **Trocar a referência re-semeia o layout** (posições aleatórias + 3000 passos de pré-aquecimento). Use `useMemo`. |
| `dark` | `boolean` | `false` | Tema escuro. Muda rótulos, arestas, preenchimento de pasta, tooltip e fundo. **Também re-semeia o layout.** |
| `animando` | `boolean` | `false` | Modo "pensando": o grafo respira (±12%), os nós se agitam e pulsos amarelos correm pelas arestas. Alternar **não** re-semeia. Use durante carregamento, sync ou busca de IA. |
| `kindsOcultos` | `readonly Kind[]` | `[]` | Kinds escondidos. Alternar **não** re-semeia: só remarca visibilidade e reenquadra a câmera. Nós ocultos saem da física. |
| `corPorKind` | `Partial<Record<Kind, string \| null>>` | ver §5 | Sobrescreve a cor fixa de um kind. `null` força a cor derivada da pasta. Lida na montagem do effect. |
| `onSelecao` | `(s: Selecao) => void` | nenhum | Clique (sem arrastar) em entidade/categoria **ou** em uma aresta. |
| `onClicarNota` | `(id, titulo) => void` | nenhum | Clique em um nó `kind: "nota"`. |
| `tooltipRelacao` | `(a: GNode, b: GNode, fontes: string[]) => string` | `"A × B · N conteúdos"` | Texto do tooltip ao passar sobre uma aresta. |
| `fundo` | `string` (CSS color) | `#f8fafc` / `#0b1220` | Fundo do container. |
| `className` / `style` | | nenhum | Aplicados ao `<div>` container (`position: relative; width/height: 100%; overflow: hidden`). |
| `children` | `ReactNode` | nenhum | Renderizados **por cima** do canvas. Use para painéis e legendas (ver §6.3). |

Todas as callbacks e `tooltipRelacao` são lidas por *ref*: pode passar funções inline à
vontade, isso não remonta a simulação.

### 3.2 Ref imperativo (`GrafoHandle`)

Comandos que alteram o canvas **sem** re-semear o layout:

| Método | Efeito |
|---|---|
| `selecionar(id)` | Seleciona o nó como se fosse clicado (dispara `onSelecao`/`onClicarNota`) e acorda a física. Ignora id inexistente ou oculto. Use para navegar de um painel até um vizinho. |
| `reselecionar(id)` | Igual a `selecionar`, sem acordar a física. Use logo depois de `ligar`/`desligar` para o painel receber a lista de relações atualizada. |
| `ligar(aId, bId)` | Cria uma aresta `relacao` com `manual: true` e `fontes: []`. Não duplica. |
| `desligar(aId, bId)` | Remove a aresta **manual** entre os dois nós. Arestas não manuais ficam. |
| `limparSelecao()` | Remove o realce e a aresta selecionada. Não dispara callback. Chame quando o painel fechar por fora (X, Esc). |
| `enquadrar()` | Liga de novo o auto-enquadramento (mesmo efeito do duplo clique no vazio). |

> ⚠️ `ligar`/`desligar` mexem só no estado interno do canvas. Se `graph` ou `dark`
> mudarem depois, a simulação é reconstruída a partir de `graph` e essas mudanças
> **somem**. Grave a relação na sua fonte de verdade (no beculture, o `.md` em `Tags/`)
> e inclua-a no `graph` da próxima carga.

### 3.3 Tipos de dados

```ts
type EntKind = "pessoa" | "projeto" | "tag";
type Kind = "nota" | "pasta" | "tag-hub" | "categoria" | EntKind;
type LinkTipo = "wikilink" | "tag" | "pasta" | "relacao";

interface GNode {
  id: string;            // único e estável; é o que as arestas referenciam
  kind: Kind;
  pasta: string | null;  // define a cor de nota/projeto/pasta; "Raiz" = sem pasta
  titulo: string;        // rótulo (cortado em 26 chars com "…")
  grau: number;          // nº de arestas; base do raio de nota/pasta/tag-hub
  conteudos?: string[];  // entidades/categoria: ids dos docs que as citam; base do raio
  rotulo?: string;       // repassado na seleção (ex.: "Tag")
  notaPath?: string;     // repassado na seleção (arquivo próprio da entidade)
  tipo?: string;
  // x, y, vx, vy, _peso, _fase: internos, ignorados na entrada
}

interface GLink {
  source: string;        // id de GNode
  target: string;        // id de GNode
  tipo: LinkTipo;
  fontes?: string[];     // relacao: docs que sustentam a relação
  manual?: boolean;      // relação declarada à mão
}

interface Graph { nodes: GNode[]; links: GLink[] }
```

**Regras de integridade:**
- Aresta cujo `source` ou `target` não existe em `nodes` é **descartada em silêncio**.
- Arestas são tratadas como **não direcionadas**. Não há deduplicação na entrada: se
  `A→B` e `B→A` vierem juntas, as duas são desenhadas.
- O componente **não muta** os objetos de `graph`: trabalha sobre cópias.
- `grau` não é recalculado. Informe o valor correto, porque ele define o tamanho de
  `nota`/`pasta`/`tag-hub`.

### 3.4 Seleção (`Selecao`)

Sempre um objeto plano, copiado no instante do clique (nunca o nó vivo da simulação):

```ts
type Selecao =
  | { tipo: "entidade"; id; titulo; rotulo; kind: EntKind | "categoria"; notaPath?;
      relacoes: { id; titulo; rotulo; peso; manual? }[];  // vizinhos-entidade visíveis, por peso desc.
      conteudos: string[] }
  | { tipo: "relacao"; aId; aTitulo; bId; bTitulo; fontes: string[] };
```

| Clique em… | Resultado |
|---|---|
| `pessoa`, `projeto`, `tag`, `categoria` | realça nó + vizinhos → `onSelecao({ tipo: "entidade" })` |
| aresta | realça as duas pontas → `onSelecao({ tipo: "relacao" })` |
| `nota` | realça → `onClicarNota(id, titulo)` |
| `pasta`, `tag-hub` | só realça |
| fundo vazio | nada (o realce continua até `limparSelecao()` ou outro clique) |

`peso` de uma relação = `fontes.length` (ou `1` sem `fontes`).

### 3.5 Utilitários exportados

`raio(n)`, `pesoDoKind(kind)`, `repousoDoLink(tipo)`, `montarCores(pastas)`,
`ehEntidade(kind)`, `temContexto(kind)` e as constantes `PASTA_COR`, `PALETA`, `COR_TAG`,
`COR_PESSOA`, `COR_CATEGORIA`, `COR_POR_KIND`. Servem para montar legendas com as
mesmas cores do canvas.

---

## 4. Interações

| Gesto | Ação |
|---|---|
| Arrastar nó | Move o nó; a física segue ao vivo |
| Arrastar fundo | Pan (desliga o auto-enquadramento) |
| Roda do mouse | Zoom ancorado no cursor (0,03× a 4×) |
| Pinça (2 dedos) | Zoom + pan ancorados no ponto entre os dedos |
| Clique (sem mover) | Seleção (ver §3.4) |
| Duplo clique no vazio | Volta ao auto-enquadramento |
| Hover | Tooltip com o título do nó ou "A × B · N conteúdos" na aresta; cursor `pointer` |

Mouse, toque e caneta passam pelo mesmo código (Pointer Events). No toque, realce e
tooltip somem ao levantar o dedo, já que não existe hover. `pointermove`/`pointerup`/`pointercancel`
são escutados no `window`, então soltar fora do canvas funciona.

Tolerâncias de clique são **em pixels de tela** (6 px além do raio / da linha),
independentes do zoom. Perto das pontas de uma aresta, o nó tem prioridade.

---

## 5. Visual

### Cores dos nós

| Kind | Cor | Forma |
|---|---|---|
| `tag`, `tag-hub` | `#22D3EE` (ciano) | disco |
| `pessoa` | `#F472B6` (rosa) | disco |
| `categoria` | `#FB923C` (laranja) | disco |
| `nota` | cor da pasta | disco |
| `projeto`, `pasta` | cor da pasta | anel (contorno 2,2 px, miolo no fundo) |

Cor da pasta: primeiro as fixas de `PASTA_COR` (Reuniões `#FFCA28`, Insights `#C084FC`,
Documentos `#10B981`, Notas `#94A3B8`, Pessoas `#F472B6`, Áudios `#38BDF8`,
Estratégico `#FB923C`). As demais recebem tons de `PALETA` em ordem alfabética, sem repetir.
Sem pasta ou pasta `"Raiz"` fica `#94A3B8`.

### Raio

| Kind | Fórmula |
|---|---|
| `pessoa`, `projeto` | `8 + min(conteudos, 24) × 0,6` |
| `tag` | `7 + min(conteudos, 24) × 0,6` |
| `categoria` | `9 + min(conteudos, 24) × 0,6` |
| `pasta` | `10 + min(grau, 20) × 0,7` |
| `tag-hub` | `7 + min(grau, 16) × 0,6` |
| `nota` | `6 + min(grau, 8) × 1,6` |

### Arestas

| Tipo | Cor | Traço |
|---|---|---|
| `wikilink` | amarelo `rgba(255,202,40,α)` | contínuo |
| `tag` | ciano `rgba(34,211,238,α)` | tracejado 5/4 |
| `relacao` | cinza (slate) | tracejado 5/4 |
| `pasta` | cinza (slate) | pontilhado 2/4 |

Espessura constante na tela (1 px, 1,6 px quando ativa). Com o grafo em repouso, α fica entre 0,12
e 0,18, reforçado ×1,7 no tema claro. A aresta ativa sobe para 0,6.

### Rótulos

Nós que não são `nota` sempre mostram rótulo, em negrito e na cor do nó. Notas só
mostram com ≤ 40 nós visíveis ou em destaque. Com um nó selecionado, os não realçados
ficam com 35% de opacidade. Todos os nós têm um *glow* que "respira" devagar.

---

## 6. Detalhes técnicos para implementação

### 6.1 Física

Simulação própria, O(n²), sem biblioteca. A cada quadro:

- **Repulsão** entre todos os pares visíveis: `F = C / d² × peso_a × peso_b`, com
  `C = 3600 + 12 × nº de nós visíveis` (grafos maiores se espalham mais).
- **Mola** em cada aresta visível: `F = (d − repouso) × 0,013`. Repouso: `pasta` 58,
  `tag` 66, `relacao` 96, `wikilink` 110.
- **Gravidade** ao centro: `0,009 × deslocamento`.
- **Amortecimento** 0,9, **velocidade máxima** 14 px/quadro.
- **Massa** (`peso`): `categoria`/`projeto`/`pasta` 2,2 · `pessoa` 1,9 ·
  `tag`/`tag-hub` 1,7 · `nota` 1.

**Pré-aquecimento:** ao montar e a cada resize, roda até 3000 passos em rajada
(para quando o maior deslocamento fica abaixo de 0,05 px por 10 passos seguidos).
Assim o grafo já aparece assentado.

**Sono:** depois de 45 quadros parados, a física dorme e só o desenho continua (para o
glow). Ela acorda com arrasto, `animando`, troca de filtro, `ligar`/`desligar`/`selecionar`.

**Escala recomendada:** fluido até ~300–500 nós visíveis. Acima disso a repulsão
O(n²) pesa. Use `kindsOcultos` ou pode o grafo antes (o beculture limita a 25 tags
e 800 arestas, no máximo 8 por nó).

### 6.2 Câmera

O mundo é ilimitado, sem clamp nas bordas. Com auto-enquadramento ligado (o padrão), a câmera
interpola 8% por quadro até o *bounding box* dos nós visíveis com 10% de folga, escala
entre 0,03× e 1,4×. Qualquer zoom/pan manual desliga o auto-enquadramento. Duplo clique no vazio ou
`enquadrar()` religam. Trocar `kindsOcultos` também religa.

### 6.3 Layout e overlays

- O container é `width: 100%; height: 100%`. **O pai precisa de altura explícita**,
  senão o canvas fica com 0 px.
- O canvas acompanha o container via `ResizeObserver`. **Cada resize reaquece a física**,
  e o grafo "salta". Por isso painéis devem ser **overlays** (`position: absolute` via
  `children`), nunca irmãos em flex que encolhem o canvas.
- O canvas tem `touch-action: none`, senão o navegador consome o gesto de toque.
- O tooltip é `position: fixed; z-index: 60`, dentro do container. Se algum ancestral
  tiver `transform`/`filter`, o `fixed` passa a ser relativo a ele e o tooltip desloca.

### 6.4 Ciclo de vida e desempenho

- Um único `useEffect` com deps `[graph, dark]` cria a simulação. A limpeza cancela o
  `rAF`, desconecta o `ResizeObserver` e remove todos os listeners.
- Tudo o que muda com frequência (`animando`, `kindsOcultos`, callbacks) passa por
  `useRef` e é lido a cada quadro. Assim o React não remonta o canvas.
- Ao trocar `graph`, o `onSelecao` antigo **não** é chamado com `null`. Limpe o estado de
  seleção do seu lado ao carregar dados novos.
- O loop `requestAnimationFrame` roda enquanto o componente estiver montado, mesmo com
  a física dormindo (o custo fica só no desenho). Desmonte o componente quando ele não estiver visível.

### 6.5 Acessibilidade

O canvas não tem semântica: nós não são focáveis nem lidos por leitor de tela. Se for
requisito, ofereça uma visão alternativa em lista (no beculture é a **Lista do
Repositório**) e use `ref.selecionar(id)` para sincronizar as duas.

---

## 7. De onde vêm os dados no beculture

O componente só desenha. No app original, o `graph` é montado assim (arquivos em
`ts/demo/src/app/pages/ceo/`, **não** incluídos aqui porque dependem do app):

1. `memoria-inventario.ts` › `lerArquivosMd(handle)`: lê os `.md` da pasta escolhida
   (File System Access API).
2. `memoria-grafo-modelo.ts` › `construirGrafoDoVault(files, categorias)`: devolve duas
   camadas:
   - **entidades** (`pessoa`/`projeto`/`tag`/`categoria`), com termos recorrentes
     e relações por co-ocorrência (≥ 2 documentos em comum, poda por peso);
   - **conteúdos** (`nota`/`pasta`/`tag-hub`), o grafo de arquivos com
     `[[wikilinks]]`, tags de frontmatter e pastas.
3. `unirCamadas(entidades, conteudos)`: une as duas e deduplica por id e por rótulo.
4. A tela esconde a camada de conteúdos por padrão. Com este componente, isso fica:
   `kindsOcultos={["nota", "pasta", "tag-hub"]}`.

Para usar outra fonte de dados (API, banco, JSON), basta produzir um `Graph` no formato
da §3.3.

### Mapeamento com o original

| `MemoriaGrafo.tsx` | `Grafo.tsx` |
|---|---|
| `filtros` / `CAMADA_POR_KIND` | `kindsOcultos` |
| `isDark` (`useThemeContext`) | `dark` |
| `loading \|\| syncing \|\| buscaIA` | `animando` |
| `setSelecao` via `onSelecaoRef` | `onSelecao` |
| `setNota({ path, titulo })` | `onClicarNota(id, titulo)` |
| `comandosRef.current.*` | `ref.current.*` |
| `limparRef.current += 1` | `ref.current.limparSelecao()` |
| classes Tailwind do container | estilos inline + `fundo`/`className`/`style` |
| `GrafoPainelContexto`, chips, botões | fora do componente, entram via `children` |

A física, a câmera, o desenho e as interações são **idênticos** ao original. Se o
original mudar, sincronize manualmente, porque este arquivo é uma cópia, não um import.
