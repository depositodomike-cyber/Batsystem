// Import Dependencies
import { ComponentType, SVGProps, useMemo, useState } from "react";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckCircleIcon,
  RectangleStackIcon,
  SparklesIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Input } from "@/components/ui";
import { PLANOS, PLANOS_LIST, formatBRL, type PlanoCode } from "@/app/data/planos";
import {
  MODULOS,
  planosDoModulo,
  unidadeDoModulo,
  unidadeLabel,
  type ModuloCode,
} from "@/app/data/modulos";
import { conteudoDoModulo } from "@/app/data/modulosConteudo";
import {
  calcularPrecoPorModulo,
  type Contrato,
  type LinhaPrecoModulo,
} from "@/app/data/precificacao";

/**
 * Precificador por módulo (modelo da calculadora, Site/calculadora.html):
 * contrato global (mensal/anual), cada módulo no seu próprio plano e
 * quantidade, e resumo com âncora/pacote. Regra da IA: com o módulo IA
 * selecionado, os demais módulos ficam travados no plano Basic.
 */

// ----------------------------------------------------------------------

const MODULO_ICONS: Record<
  ModuloCode,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  ia_pessoal: SparklesIcon,
  performance: ChartBarIcon,
  learning: AcademicCapIcon,
  recrutamento: UserPlusIcon,
  projetos: RectangleStackIcon,
};

const CICLOS: Contrato[] = ["mensal", "anual"];

/** Configuração de um módulo (o ciclo é global, fora daqui). */
export interface ModuloConfig {
  plano: PlanoCode;
  quantidade: number;
}

/** Config selecionada de um módulo, com o plano EFETIVO (pós-regra da IA). */
export interface ConfigSelecionada {
  modulo: ModuloCode;
  plano: PlanoCode;
  quantidade: number;
}

function planoPermitido(code: ModuloCode, plano: PlanoCode): PlanoCode {
  const permitidos = planosDoModulo(code);
  return permitidos.includes(plano) ? plano : permitidos[0];
}

export function usePrecificador(planoInicial: PlanoCode) {
  const [selecionados, setSelecionados] = useState<ModuloCode[]>([
    "ia_pessoal",
  ]);
  // Ciclo (mensal/anual) é único para toda a conta.
  const [ciclo, setCiclo] = useState<Contrato>("anual");
  const [configs, setConfigs] = useState<Record<ModuloCode, ModuloConfig>>(
    () =>
      MODULOS.reduce(
        (acc, m) => {
          acc[m.code] = {
            plano: planoPermitido(m.code, planoInicial),
            quantidade:
              m.code === "recrutamento" ? 2 : m.code === "ia_pessoal" ? 1 : 50,
          };
          return acc;
        },
        {} as Record<ModuloCode, ModuloConfig>,
      ),
  );

  // Multi-seleção livre; sempre fica ao menos um módulo.
  const toggleModulo = (code: ModuloCode) => {
    setSelecionados((prev) => {
      if (prev.includes(code)) {
        return prev.length > 1 ? prev.filter((c) => c !== code) : prev;
      }
      return [...prev, code];
    });
  };

  const updateConfig = (code: ModuloCode, patch: Partial<ModuloConfig>) => {
    setConfigs((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  };

  const onQuantidadeChange = (code: ModuloCode, n: number) => {
    const valor = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : NaN;
    updateConfig(code, { quantidade: valor });
  };

  const iaSelecionada = selecionados.includes("ia_pessoal");

  // Regra da IA: com IA na conta, os demais módulos ficam no Basic.
  const planoEfetivoDe = (code: ModuloCode): PlanoCode =>
    iaSelecionada && code !== "ia_pessoal"
      ? "basico"
      : planoPermitido(code, configs[code].plano);

  // Módulos selecionados em ordem canônica + cálculo por módulo.
  const ativos = useMemo(
    () => MODULOS.filter((m) => selecionados.includes(m.code)),
    [selecionados],
  );
  const configsSelecionadas: ConfigSelecionada[] = useMemo(
    () =>
      ativos.map((m) => ({
        modulo: m.code,
        plano:
          iaSelecionada && m.code !== "ia_pessoal"
            ? "basico"
            : planoPermitido(m.code, configs[m.code].plano),
        quantidade: configs[m.code].quantidade,
      })),
    [ativos, configs, iaSelecionada],
  );
  const preco = useMemo(
    () =>
      calcularPrecoPorModulo(
        configsSelecionadas.map((c) => ({ ...c, contrato: ciclo })),
      ),
    [configsSelecionadas, ciclo],
  );
  const linhaPorModulo = useMemo(
    () => new Map(preco.linhas.map((l) => [l.modulo, l])),
    [preco],
  );

  return {
    selecionados,
    ciclo,
    setCiclo,
    configs,
    toggleModulo,
    updateConfig,
    onQuantidadeChange,
    iaSelecionada,
    planoEfetivoDe,
    configsSelecionadas,
    preco,
    linhaPorModulo,
  };
}

export type Precificador = ReturnType<typeof usePrecificador>;

// ----------------------------------------------------------------------

export function SectionHeading({
  numero,
  titulo,
  subtitulo,
}: {
  numero: number;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-semibold text-white">
        {numero}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-dark-100">
          {titulo}
        </p>
        <p className="text-xs text-gray-400 dark:text-dark-300">{subtitulo}</p>
      </div>
    </div>
  );
}

/** Barra do contrato global (mensal/anual, -15% no anual). */
export function ContratoBar({
  ciclo,
  onChange,
}: {
  ciclo: Contrato;
  onChange: (c: Contrato) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-dark-500">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-dark-100">
          Contrato
        </p>
        <p className="text-xs text-gray-400 dark:text-dark-300">
          Mensal ou anual — aplica-se a todos os módulos.
        </p>
      </div>
      <div className="flex w-max rounded-lg border border-gray-200 p-0.5 dark:border-dark-500">
        {CICLOS.map((c) => {
          const ativo = ciclo === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                ativo
                  ? "bg-primary-500 text-white"
                  : "text-gray-500 dark:text-dark-300",
              )}
            >
              {c}
              {c === "anual" && (
                <span
                  className={clsx(ativo ? "text-white/80" : "text-primary-500")}
                >
                  {" "}
                  -15%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Bloco "Módulos": seleção + plano/quantidade/conteúdo/subtotal por módulo. */
export function SecaoModulos({
  numero,
  precificador,
}: {
  numero: number;
  precificador: Precificador;
}) {
  const {
    selecionados,
    configs,
    toggleModulo,
    updateConfig,
    onQuantidadeChange,
    iaSelecionada,
    planoEfetivoDe,
    linhaPorModulo,
  } = precificador;

  return (
    <div>
      <SectionHeading
        numero={numero}
        titulo="Módulos"
        subtitulo="Selecione os módulos e configure plano e quantidade de cada um."
      />

      <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {MODULOS.map((m) => {
          const Icon = MODULO_ICONS[m.code];
          const ativo = selecionados.includes(m.code);
          return (
            <div
              key={m.code}
              className={clsx(
                "flex flex-col overflow-hidden rounded-lg border transition-colors",
                ativo
                  ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-500/10"
                  : "border-gray-200 hover:border-gray-300 dark:border-dark-500 dark:hover:border-dark-400",
              )}
            >
              <button
                type="button"
                onClick={() => toggleModulo(m.code)}
                aria-pressed={ativo}
                className="flex items-center gap-3 p-3 text-left"
              >
                <span
                  className={clsx(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    ativo
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-500 dark:bg-dark-600 dark:text-dark-200",
                  )}
                >
                  <Icon className="size-5" strokeWidth="1.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-700 dark:text-dark-100">
                    {m.nome}
                  </span>
                  <span className="block text-xs text-gray-400 dark:text-dark-300">
                    {m.descricao}
                  </span>
                </span>
                <CheckCircleIcon
                  className={clsx(
                    "size-5 shrink-0 transition-colors",
                    ativo
                      ? "text-primary-500"
                      : "text-gray-300 dark:text-dark-500",
                  )}
                />
              </button>

              {ativo && (
                <ModuloConfigBody
                  modulo={m.code}
                  config={configs[m.code]}
                  planoEfetivo={planoEfetivoDe(m.code)}
                  travadoNoBasic={iaSelecionada && m.code !== "ia_pessoal"}
                  linha={linhaPorModulo.get(m.code)}
                  onPlanoChange={(plano) => updateConfig(m.code, { plano })}
                  onQuantidadeChange={(n) => onQuantidadeChange(m.code, n)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Configuração + funcionalidades + subtotal de um módulo selecionado. */
function ModuloConfigBody({
  modulo,
  config,
  planoEfetivo,
  travadoNoBasic,
  linha,
  onPlanoChange,
  onQuantidadeChange,
}: {
  modulo: ModuloCode;
  config: ModuloConfig;
  /** Plano cobrado de fato (pode divergir de config.plano pela regra da IA). */
  planoEfetivo: PlanoCode;
  /** Com IA na conta, este módulo só pode ficar no Basic. */
  travadoNoBasic: boolean;
  linha?: LinhaPrecoModulo;
  onPlanoChange: (p: PlanoCode) => void;
  onQuantidadeChange: (n: number) => void;
}) {
  const unidade = unidadeDoModulo(modulo);
  const Icon = unidade === "posicoes" ? BriefcaseIcon : UsersIcon;
  const itens = conteudoDoModulo(modulo, planoEfetivo);
  const planosDisponiveis = planosDoModulo(modulo);

  return (
    <div className="space-y-4 border-t border-primary-200 px-3 py-3 dark:border-primary-500/30">
      {/* Plano */}
      <div className="flex flex-wrap gap-1.5">
        {PLANOS_LIST.filter((pl) => planosDisponiveis.includes(pl.code)).map(
          (pl) => {
            const ativo = planoEfetivo === pl.code;
            const desabilitado = travadoNoBasic && pl.code !== "basico";
            return (
              <button
                key={pl.code}
                type="button"
                onClick={() => onPlanoChange(pl.code)}
                disabled={desabilitado}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  ativo
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-dark-500 dark:bg-dark-700 dark:text-dark-200",
                  desabilitado && "cursor-not-allowed opacity-40",
                )}
              >
                {pl.nome}
                {pl.emDestaque && (
                  <span
                    className={clsx(
                      "ml-1 text-[10px]",
                      ativo ? "text-white/80" : "text-primary-500",
                    )}
                  >
                    ★
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>
      {travadoNoBasic && (
        <p className="-mt-2.5 text-[11px] text-gray-400 dark:text-dark-300">
          Com o módulo IA selecionado, os demais módulos ficam no plano Basic.
        </p>
      )}

      {/* Quantidade */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 dark:text-dark-300">
          {unidade === "posicoes" ? "Posições" : "Usuários"}
        </span>
        <Input
          type="number"
          min={1}
          classNames={{ root: "w-32 shrink-0" }}
          prefix={
            <Icon
              className="size-5 transition-colors duration-200"
              strokeWidth="1"
            />
          }
          value={Number.isFinite(config.quantidade) ? config.quantidade : ""}
          onChange={(e) => onQuantidadeChange(parseInt(e.target.value, 10))}
        />
      </div>

      {/* Funcionalidades incluídas no plano do módulo */}
      {itens.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-dark-300">
            Incluído no plano {PLANOS[planoEfetivo].nome}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {itens.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-dark-700 dark:text-dark-100 dark:ring-dark-500"
              >
                <CheckCircleIcon className="size-3.5 shrink-0 text-primary-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Subtotal do módulo */}
      <div className="flex items-center justify-between border-t border-primary-200/70 pt-2.5 dark:border-primary-500/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-dark-300">
            Subtotal
          </span>
          {linha?.descontoPacote && (
            <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
              preço de pacote
            </span>
          )}
        </div>
        {linha?.sobConsulta ? (
          <span className="text-sm font-semibold text-gray-700 dark:text-dark-100">
            Sob consulta
          </span>
        ) : (
          <span className="text-right">
            <span className="text-sm font-semibold text-gray-800 dark:text-dark-100">
              {formatBRL(linha?.total ?? 0)}
            </span>
            <span className="ml-1 text-[11px] text-gray-400 dark:text-dark-300">
              /mês · {formatBRL(linha?.unitario ?? 0)}/
              {unidadeLabel(unidade, false)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Bloco "Resumo": uma linha por módulo + total estimado. */
export function SecaoResumo({
  numero,
  precificador,
}: {
  numero: number;
  precificador: Precificador;
}) {
  const { preco } = precificador;
  const { linhas, total, sobConsulta } = preco;

  return (
    <div>
      <SectionHeading
        numero={numero}
        titulo="Resumo"
        subtitulo="Cada módulo é cobrado pelo seu próprio plano e quantidade, no contrato escolhido acima."
      />
      <div className="mt-3 rounded-lg border border-gray-200 p-4 dark:border-dark-500 sm:p-5">
        <ul className="space-y-3">
          {linhas.map((l) => {
            const unidade = unidadeDoModulo(l.modulo);
            const nome =
              MODULOS.find((m) => m.code === l.modulo)?.nome ?? l.modulo;
            return (
              <li
                key={l.modulo}
                className="flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-dark-100">
                    {nome}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-dark-300">
                    {PLANOS[l.plano].nome} · {l.quantidade}{" "}
                    {unidadeLabel(unidade, l.quantidade !== 1)}
                    {l.ancora && linhas.length > 1 && " · âncora"}
                    {l.descontoPacote && " · pacote (Básico)"}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  {l.sobConsulta ? (
                    <span className="text-sm font-semibold text-gray-700 dark:text-dark-100">
                      Sob consulta
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-800 dark:text-dark-100">
                      {formatBRL(l.total)}
                      <span className="text-xs font-normal text-gray-400 dark:text-dark-300">
                        /mês
                      </span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Total estimado */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-150 pt-3 dark:border-dark-500">
          <span className="text-sm font-medium text-gray-700 dark:text-dark-100">
            Total estimado
          </span>
          <span className="text-right">
            {sobConsulta ? (
              <span className="text-lg font-semibold text-gray-800 dark:text-dark-100">
                Sob consulta
              </span>
            ) : (
              <>
                <span className="text-lg font-semibold text-gray-800 dark:text-dark-100">
                  {formatBRL(total)}
                </span>
                <span className="text-xs text-gray-400 dark:text-dark-300">
                  /mês após o teste
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
