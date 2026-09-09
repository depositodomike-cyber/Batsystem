// Import Dependencies
import { CheckIcon, MinusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Checkbox } from "@/components/ui";
import {
  alternarPermissao,
  GRUPOS_PERMISSOES,
  rotuloPermissao,
  type Permissao,
} from "@/app/data/permissoes";

// ----------------------------------------------------------------------
// Matriz de permissões, agrupada por recurso da plataforma.
//
// Dois modos, para o texto e o agrupamento serem sempre os mesmos:
//   • editável  — no formulário da role;
//   • leitura   — no detalhe da role e nas permissões herdadas do membro.
//
// Em leitura mostramos o que NÃO foi concedido também: saber que "excluir
// documentos" está fora é tão informativo quanto saber que "enviar" está
// dentro. É o formato que o briefing pede para as permissões herdadas.
//
// As permissões dependentes aparecem RECUADAS sob a que elas exigem: dentro de
// Membros, "Visualizar membros" no primeiro nível e Adicionar / Editar /
// Desativar abaixo dela. A relação já existia no catálogo (`requer`) e na
// seleção (`alternarPermissao` marca o pai ao marcar um filho, e derruba os
// filhos ao desmarcar o pai) — o que faltava era a lista PARECER com isso, em
// vez de repetir "Requer visualizar este recurso" em doze linhas iguais.
// ----------------------------------------------------------------------

const PAI_POR_CODE = new Map(
  GRUPOS_PERMISSOES.flatMap((g) => g.permissoes).map((p) => [p.code, p.requer]),
);

/**
 * Profundidade de uma permissão na árvore de dependências: 0 = raiz.
 *
 * Sobe a cadeia de `requer` em vez de assumir "tem requer, logo é filho": hoje
 * o catálogo tem um nível só, mas `normalizarPermissoes` e `alternarPermissao`
 * já tratam qualquer profundidade, e um render que assumisse 1 seria a única
 * peça a quebrar no dia em que aparecer um neto.
 *
 * O recuo vem da ESTRUTURA, nunca da seleção: um filho concedido fica no lugar
 * dele mesmo que o pai apareça desmarcado. No modo leitura isso é o que faz uma
 * linha inconsistente (mexida por SQL à mão) aparecer em vez de sumir.
 */
function nivelDaPermissao(permissao: Permissao): number {
  let nivel = 0;
  let requer = permissao.requer;
  while (requer) {
    nivel += 1;
    requer = PAI_POR_CODE.get(requer);
  }
  return nivel;
}

/**
 * Recuo por nível. Uma classe fixa por nível em vez de estilo calculado
 * porque o Tailwind só gera as classes que existem no código.
 *
 * O `border-s` é o filete que liga o filho ao pai — só a partir do nível 1, ou
 * o grupo Grafo (que tem apenas a raiz) ganharia uma linha vertical solta.
 */
const RECUO_POR_NIVEL = [
  "",
  "ms-3.5 border-s border-gray-200 ps-3.5 dark:border-dark-500",
  "ms-7 border-s border-gray-200 ps-3.5 dark:border-dark-500",
] as const;

function classeDeRecuo(nivel: number): string {
  return RECUO_POR_NIVEL[Math.min(nivel, RECUO_POR_NIVEL.length - 1)];
}

export function MatrizPermissoes({
  selecionadas,
  onChange,
}: {
  selecionadas: string[];
  /** Ausente = somente leitura. */
  onChange?: (proximas: string[]) => void;
}) {
  const marcadas = new Set(selecionadas);
  const editavel = onChange != null;

  return (
    <div className="space-y-4">
      {/* A regra que a árvore não mostra sozinha: o recuo diz QUEM depende de
          quem, não que a marcação sobe. Uma frase aqui, e não a dica repetida
          em cada linha dependente que existia antes — doze cópias do mesmo
          texto num modal estreito faziam a lista parecer o dobro do tamanho. */}
      {editavel && (
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          Marcar uma permissão recuada inclui automaticamente a permissão acima
          dela, da qual ela depende. O contrário não: conceder a de visualizar
          não concede as demais.
        </p>
      )}

      {GRUPOS_PERMISSOES.map((grupo) => (
        <section key={grupo.id}>
          <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            {grupo.titulo}
          </p>
          {editavel && (
            <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
              {grupo.descricao}
            </p>
          )}
          <div className="dark:divide-dark-600 dark:border-dark-600 mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {grupo.permissoes.map((p) =>
              editavel ? (
                <LinhaEditavel
                  key={p.code}
                  permissao={p}
                  nivel={nivelDaPermissao(p)}
                  marcada={marcadas.has(p.code)}
                  onToggle={(marcar) =>
                    onChange(alternarPermissao(selecionadas, p.code, marcar))
                  }
                />
              ) : (
                <LinhaLeitura
                  key={p.code}
                  permissao={p}
                  nivel={nivelDaPermissao(p)}
                  concedida={marcadas.has(p.code)}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------

function LinhaEditavel({
  permissao,
  nivel,
  marcada,
  onToggle,
}: {
  permissao: Permissao;
  nivel: number;
  marcada: boolean;
  onToggle: (marcar: boolean) => void;
}) {
  return (
    // O recuo vai no CONTEÚDO, não no `<label>`: a linha continua de largura
    // total, então a área clicável e o hover não encolhem com a profundidade —
    // e as divisórias do card seguem atravessando de ponta a ponta.
    <label className="dark:hover:bg-dark-600 flex cursor-pointer items-center px-3.5 py-2.5 transition-colors hover:bg-gray-50">
      <span
        className={clsx(
          "flex min-w-0 flex-1 items-center gap-3",
          classeDeRecuo(nivel),
        )}
      >
        <Checkbox
          checked={marcada}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="dark:text-dark-100 text-xs-plus min-w-0 flex-1 text-gray-800">
          {permissao.rotulo}
          <DependenciaSrOnly requer={permissao.requer} />
        </span>
      </span>
    </label>
  );
}

/**
 * A dependência para quem não vê o recuo.
 *
 * Indentação e filete não são anunciados por leitor de tela, e a dica visual
 * que dizia isso saiu. Nomeia o PAI de verdade, via `rotuloPermissao` — a dica
 * antiga era fixa em "Requer visualizar este recurso" e errava no grupo IA,
 * onde o pai é "Conversar com a IA" e não existe nenhum "visualizar".
 */
function DependenciaSrOnly({ requer }: { requer?: string }) {
  if (!requer) return null;
  return <span className="sr-only"> — requer {rotuloPermissao(requer)}</span>;
}

function LinhaLeitura({
  permissao,
  nivel,
  concedida,
}: {
  permissao: Permissao;
  nivel: number;
  concedida: boolean;
}) {
  return (
    <div className="flex items-center px-3.5 py-2">
      <span
        className={clsx(
          "flex min-w-0 flex-1 items-center gap-3",
          classeDeRecuo(nivel),
        )}
      >
        <span
          className={clsx(
            "grid size-4.5 shrink-0 place-items-center rounded-full",
            concedida
              ? "bg-success/15 text-success"
              : "dark:bg-dark-600 bg-gray-100 text-gray-400",
          )}
          aria-hidden="true"
        >
          {concedida ? (
            <CheckIcon className="size-3 stroke-[2.5]" />
          ) : (
            <MinusIcon className="size-3 stroke-[2.5]" />
          )}
        </span>
        <span
          className={clsx(
            "text-xs-plus min-w-0 flex-1",
            concedida
              ? "dark:text-dark-100 text-gray-800"
              : "dark:text-dark-300 text-gray-400",
          )}
        >
          {permissao.rotulo}
          <DependenciaSrOnly requer={permissao.requer} />
        </span>
        <span className="sr-only">
          {concedida ? "concedida" : "não concedida"}
        </span>
      </span>
    </div>
  );
}
