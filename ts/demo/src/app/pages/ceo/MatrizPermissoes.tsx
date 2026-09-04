// Import Dependencies
import { CheckIcon, MinusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Checkbox } from "@/components/ui";
import {
  alternarPermissao,
  GRUPOS_PERMISSOES,
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
// ----------------------------------------------------------------------

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
                  marcada={marcadas.has(p.code)}
                  onToggle={(marcar) =>
                    onChange(alternarPermissao(selecionadas, p.code, marcar))
                  }
                />
              ) : (
                <LinhaLeitura
                  key={p.code}
                  permissao={p}
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
  marcada,
  onToggle,
}: {
  permissao: Permissao;
  marcada: boolean;
  onToggle: (marcar: boolean) => void;
}) {
  return (
    <label className="dark:hover:bg-dark-600 flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-gray-50">
      <Checkbox
        checked={marcada}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="dark:text-dark-100 text-xs-plus block text-gray-800">
          {permissao.rotulo}
        </span>
        {/* Dependência explicada onde ela é sentida: marcar isto traz a de
            visualizar, desmarcar aquela leva esta embora. */}
        {permissao.requer && (
          <span className="dark:text-dark-300 block text-xs text-gray-400">
            Requer visualizar este recurso
          </span>
        )}
      </span>
    </label>
  );
}

function LinhaLeitura({
  permissao,
  concedida,
}: {
  permissao: Permissao;
  concedida: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2">
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
      </span>
      <span className="sr-only">
        {concedida ? "concedida" : "não concedida"}
      </span>
    </div>
  );
}
