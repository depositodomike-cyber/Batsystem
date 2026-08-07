// Import Dependencies
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  CommandLineIcon,
  SparklesIcon,
  TrashIcon,
  CheckIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button } from "@/components/ui";
import * as store from "./store";
import { contraste, nivel } from "./contrast";
import {
  CONTEXTOS,
  ESCALAS,
  FONTES,
  MODOS,
  PADRAO,
  TONS,
  escalaTipos,
  type DesignSystem,
} from "./types";

// ----------------------------------------------------------------------
// Editor completo do design system — portado do beculture/Confi
// (public/design-system.js). Todas as seções de uma marca (identidade, cores,
// tipografia, espaçamento, componentes, elementos visuais, tokens/regras e
// logos), já pré-preenchidas com sugestões, com preview ao vivo, escala
// tipográfica calculada e checagem de contraste WCAG.
// ----------------------------------------------------------------------

const inputCls =
  "form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400";
const areaCls =
  "form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400";
const labelCls =
  "dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <h4 className="dark:text-dark-200 mb-3 text-tiny-plus font-semibold uppercase tracking-wider text-gray-500">
        {titulo}
      </h4>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function CorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="dark:border-dark-500 dark:bg-dark-800 flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <span className="min-w-0 flex-1">
        <span className="dark:text-dark-100 block truncate text-xs-plus text-gray-700">{label}</span>
        <span className="dark:text-dark-300 block font-mono text-tiny uppercase text-gray-400">
          {value}
        </span>
      </span>
    </label>
  );
}

function LogoField({
  label,
  fundo,
  data,
  onChange,
}: {
  label: string;
  fundo: "claro" | "escuro";
  data: string;
  onChange: (v: string) => void;
}) {
  const ler = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      <div
        className={clsx(
          "relative grid h-20 place-items-center rounded-lg border border-dashed",
          fundo === "claro"
            ? "border-gray-300 bg-white"
            : "dark:border-dark-500 border-gray-600 bg-gray-900",
        )}
      >
        {data ? (
          <>
            <img src={data} alt="" className="max-h-14 max-w-[80%] object-contain" />
            <button
              type="button"
              onClick={() => onChange("")}
              title="Remover"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-gray-900/70 text-white"
            >
              <XMarkIcon className="size-3.5" />
            </button>
          </>
        ) : (
          <span className="text-tiny text-gray-400">sem logo</span>
        )}
      </div>
      <label className="dark:border-dark-500 dark:text-dark-200 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs-plus text-gray-600">
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          hidden
          onChange={(e) => ler(e.target.files?.[0])}
        />
        <ArrowUpTrayIcon className="size-4" /> Enviar
      </label>
    </div>
  );
}

interface Props {
  /** Marca a editar. */
  brandId: string;
  isOpen: boolean;
  close: () => void;
}

// A barra monta este componente só quando abre (com `key` na marca), então o
// estado inicial já vem do store — sem efeito de sincronização.
export function DesignSystemEditor({ brandId, isOpen, close }: Props) {
  const [ds, setDs] = useState<DesignSystem>(() => store.getById(brandId));

  const podeExcluir = store.listBrands().length > 1;
  const tipos = useMemo(() => escalaTipos(ds.tipografia), [ds.tipografia]);

  // Pares de contraste checados (texto/fundo, texto suave/fundo, primária/fundo…).
  const pares: [string, string, string][] = [
    ["Texto sobre fundo", ds.cores.texto, ds.cores.fundo],
    ["Texto suave sobre fundo", ds.cores.textoSuave, ds.cores.fundo],
    ["Primária sobre fundo", ds.cores.primaria, ds.cores.fundo],
    ["Texto sobre superfície", ds.cores.texto, ds.cores.superficie],
  ];

  // Setters por seção — mantêm o resto do design intacto.
  const set = <K extends keyof DesignSystem>(chave: K, patch: Partial<DesignSystem[K]>) =>
    setDs((d) => ({ ...d, [chave]: { ...d[chave], ...patch } }));

  const toggleContexto = (c: string) =>
    setDs((d) => {
      const atual = d.marca.contexto || [];
      const contexto = atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c];
      return { ...d, marca: { ...d.marca, contexto } };
    });

  const salvar = () => {
    store.salvar(brandId, ds);
    toast("Design system salvo", { description: store.resumo(brandId) });
    close();
  };

  const restaurar = () => {
    setDs((d) => ({ ...structuredClone(PADRAO), marca: { ...PADRAO.marca, nome: d.marca.nome } }));
    toast("Sugestões restauradas", { description: "Salve para aplicar." });
  };

  const excluir = () => {
    store.remover(brandId);
    toast("Marca excluída");
    close();
  };

  return (
    <Transition appear show={isOpen}>
      {/* z acima das janelas de IA (z-[70]) — o editor abre por cima delas. */}
      <Dialog onClose={close} className="relative z-[80]">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm dark:bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-4"
          >
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <CommandLineIcon className="size-5" />
                  Design system · {ds.marca.nome || "Sem nome"}
                </DialogTitle>
                <Button
                  onClick={close}
                  variant="flat"
                  isIcon
                  className="size-8 rounded-full"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              <div className="max-h-[76vh] overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                  {/* ---------------------------------------------- Formulário */}
                  <div className="flex flex-col gap-4">
                    <Secao titulo="Marca">
                      <Campo label="Nome">
                        <input
                          className={inputCls}
                          value={ds.marca.nome}
                          onChange={(e) => set("marca", { nome: e.target.value })}
                          placeholder="Nome da marca"
                        />
                      </Campo>
                      <Campo label="Propósito">
                        <textarea
                          className={areaCls}
                          rows={2}
                          value={ds.marca.proposito}
                          onChange={(e) => set("marca", { proposito: e.target.value })}
                        />
                      </Campo>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo label="Personalidade">
                          <input
                            className={inputCls}
                            value={ds.marca.personalidade}
                            onChange={(e) => set("marca", { personalidade: e.target.value })}
                          />
                        </Campo>
                        <Campo label="Público">
                          <input
                            className={inputCls}
                            value={ds.marca.publico}
                            onChange={(e) => set("marca", { publico: e.target.value })}
                          />
                        </Campo>
                      </div>
                      <Campo label="Tom">
                        <select
                          className={inputCls}
                          value={ds.marca.tom}
                          onChange={(e) => set("marca", { tom: e.target.value })}
                        >
                          {(TONS.includes(ds.marca.tom) ? TONS : [ds.marca.tom, ...TONS]).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Contextos de uso">
                        <div className="flex flex-wrap gap-2">
                          {CONTEXTOS.map((c) => {
                            const on = (ds.marca.contexto || []).includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleContexto(c)}
                                className={clsx(
                                  "rounded-lg border px-2.5 py-1 text-xs-plus transition-colors",
                                  on
                                    ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                                    : "dark:border-dark-500 dark:text-dark-300 border-gray-300 text-gray-500",
                                )}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </Campo>
                    </Secao>

                    <Secao titulo="Cores">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <CorField label="Primária" value={ds.cores.primaria} onChange={(v) => set("cores", { primaria: v })} />
                        <CorField label="Secundária" value={ds.cores.secundaria} onChange={(v) => set("cores", { secundaria: v })} />
                        <CorField label="Acento" value={ds.cores.acento} onChange={(v) => set("cores", { acento: v })} />
                        <CorField label="Fundo" value={ds.cores.fundo} onChange={(v) => set("cores", { fundo: v })} />
                        <CorField label="Superfície" value={ds.cores.superficie} onChange={(v) => set("cores", { superficie: v })} />
                        <CorField label="Texto" value={ds.cores.texto} onChange={(v) => set("cores", { texto: v })} />
                        <CorField label="Texto suave" value={ds.cores.textoSuave} onChange={(v) => set("cores", { textoSuave: v })} />
                        <CorField label="Sucesso" value={ds.cores.sucesso} onChange={(v) => set("cores", { sucesso: v })} />
                        <CorField label="Erro" value={ds.cores.erro} onChange={(v) => set("cores", { erro: v })} />
                        <CorField label="Alerta" value={ds.cores.alerta} onChange={(v) => set("cores", { alerta: v })} />
                        <CorField label="Info" value={ds.cores.info} onChange={(v) => set("cores", { info: v })} />
                      </div>
                    </Secao>

                    <Secao titulo="Tipografia">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Campo label="Fonte de título">
                          <select
                            className={inputCls}
                            value={ds.tipografia.fonteTitulo}
                            onChange={(e) => set("tipografia", { fonteTitulo: e.target.value })}
                          >
                            {FONTES.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo label="Fonte de corpo">
                          <select
                            className={inputCls}
                            value={ds.tipografia.fonteCorpo}
                            onChange={(e) => set("tipografia", { fonteCorpo: e.target.value })}
                          >
                            {FONTES.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo label="Tamanho base (px)">
                          <input
                            type="number"
                            min={12}
                            max={24}
                            className={inputCls}
                            value={ds.tipografia.base}
                            onChange={(e) => set("tipografia", { base: Number(e.target.value) || 16 })}
                          />
                        </Campo>
                        <Campo label="Escala">
                          <select
                            className={inputCls}
                            value={String(ds.tipografia.escala)}
                            onChange={(e) => set("tipografia", { escala: Number(e.target.value) })}
                          >
                            {ESCALAS.map(([v, lbl]) => (
                              <option key={v} value={v}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo label="Peso do título">
                          <input
                            type="number"
                            min={300}
                            max={900}
                            step={100}
                            className={inputCls}
                            value={ds.tipografia.pesoTitulo}
                            onChange={(e) => set("tipografia", { pesoTitulo: Number(e.target.value) || 700 })}
                          />
                        </Campo>
                        <Campo label="Peso do corpo">
                          <input
                            type="number"
                            min={300}
                            max={700}
                            step={100}
                            className={inputCls}
                            value={ds.tipografia.pesoCorpo}
                            onChange={(e) => set("tipografia", { pesoCorpo: Number(e.target.value) || 400 })}
                          />
                        </Campo>
                        <Campo label="Entrelinha">
                          <input
                            type="number"
                            step={0.05}
                            min={1}
                            max={2}
                            className={inputCls}
                            value={ds.tipografia.lineHeight}
                            onChange={(e) => set("tipografia", { lineHeight: Number(e.target.value) || 1.5 })}
                          />
                        </Campo>
                        <Campo label="Tracking (em)">
                          <input
                            type="number"
                            step={0.005}
                            className={inputCls}
                            value={ds.tipografia.tracking}
                            onChange={(e) => set("tipografia", { tracking: Number(e.target.value) || 0 })}
                          />
                        </Campo>
                      </div>
                    </Secao>

                    <Secao titulo="Espaçamento e forma">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Campo label="Base (px)">
                          <input
                            type="number"
                            className={inputCls}
                            value={ds.espacamento.base}
                            onChange={(e) => set("espacamento", { base: Number(e.target.value) || 8 })}
                          />
                        </Campo>
                        <Campo label="Grid (colunas)">
                          <input
                            type="number"
                            className={inputCls}
                            value={ds.espacamento.grid}
                            onChange={(e) => set("espacamento", { grid: Number(e.target.value) || 12 })}
                          />
                        </Campo>
                        <Campo label="Raio (px)">
                          <input
                            type="number"
                            className={inputCls}
                            value={ds.espacamento.raio}
                            onChange={(e) => set("espacamento", { raio: Number(e.target.value) || 0 })}
                          />
                        </Campo>
                        <Campo label="Padding (px)">
                          <input
                            type="number"
                            className={inputCls}
                            value={ds.espacamento.padding}
                            onChange={(e) => set("espacamento", { padding: Number(e.target.value) || 16 })}
                          />
                        </Campo>
                      </div>
                      <Campo label="Breakpoints">
                        <input
                          className={inputCls}
                          value={ds.espacamento.breakpoints}
                          onChange={(e) => set("espacamento", { breakpoints: e.target.value })}
                        />
                      </Campo>
                    </Secao>

                    <Secao titulo="Componentes">
                      <Campo label="Botões">
                        <textarea className={areaCls} rows={2} value={ds.componentes.botoes} onChange={(e) => set("componentes", { botoes: e.target.value })} />
                      </Campo>
                      <Campo label="Formulários">
                        <textarea className={areaCls} rows={2} value={ds.componentes.formularios} onChange={(e) => set("componentes", { formularios: e.target.value })} />
                      </Campo>
                      <Campo label="Superfícies">
                        <textarea className={areaCls} rows={2} value={ds.componentes.superficies} onChange={(e) => set("componentes", { superficies: e.target.value })} />
                      </Campo>
                      <Campo label="Navegação">
                        <textarea className={areaCls} rows={2} value={ds.componentes.navegacao} onChange={(e) => set("componentes", { navegacao: e.target.value })} />
                      </Campo>
                      <Campo label="Tabelas">
                        <textarea className={areaCls} rows={2} value={ds.componentes.tabelas} onChange={(e) => set("componentes", { tabelas: e.target.value })} />
                      </Campo>
                    </Secao>

                    <Secao titulo="Elementos visuais">
                      <Campo label="Ícones">
                        <textarea className={areaCls} rows={2} value={ds.visual.icones} onChange={(e) => set("visual", { icones: e.target.value })} />
                      </Campo>
                      <Campo label="Ilustrações e fotos">
                        <textarea className={areaCls} rows={2} value={ds.visual.ilustracoes} onChange={(e) => set("visual", { ilustracoes: e.target.value })} />
                      </Campo>
                      <Campo label="Sombras">
                        <textarea className={areaCls} rows={2} value={ds.visual.sombras} onChange={(e) => set("visual", { sombras: e.target.value })} />
                      </Campo>
                      <Campo label="Loading e feedback">
                        <textarea className={areaCls} rows={2} value={ds.visual.loading} onChange={(e) => set("visual", { loading: e.target.value })} />
                      </Campo>
                    </Secao>

                    <Secao titulo="Tokens e regras">
                      <Campo label="Modo">
                        <select className={inputCls} value={ds.tokens.modo} onChange={(e) => set("tokens", { modo: e.target.value })}>
                          {MODOS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Nomeação de tokens">
                        <textarea className={areaCls} rows={2} value={ds.tokens.nomeacao} onChange={(e) => set("tokens", { nomeacao: e.target.value })} />
                      </Campo>
                      <Campo label="Microinterações">
                        <textarea className={areaCls} rows={2} value={ds.tokens.microinteracoes} onChange={(e) => set("tokens", { microinteracoes: e.target.value })} />
                      </Campo>
                      <Campo label="Faça">
                        <textarea className={areaCls} rows={2} value={ds.tokens.dos} onChange={(e) => set("tokens", { dos: e.target.value })} />
                      </Campo>
                      <Campo label="Não faça">
                        <textarea className={areaCls} rows={2} value={ds.tokens.donts} onChange={(e) => set("tokens", { donts: e.target.value })} />
                      </Campo>
                    </Secao>

                    <Secao titulo="Logos">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <LogoField
                          label="Para fundos claros"
                          fundo="claro"
                          data={ds.logos.claro}
                          onChange={(v) => set("logos", { claro: v })}
                        />
                        <LogoField
                          label="Para fundos escuros"
                          fundo="escuro"
                          data={ds.logos.escuro}
                          onChange={(v) => set("logos", { escuro: v })}
                        />
                      </div>
                    </Secao>
                  </div>

                  {/* ------------------------------------------------ Preview */}
                  <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
                    <div
                      className="rounded-xl border border-black/10 p-4"
                      style={{ background: ds.cores.fundo, color: ds.cores.texto }}
                    >
                      <div
                        style={{
                          fontFamily: `'${ds.tipografia.fonteTitulo}', sans-serif`,
                          fontWeight: ds.tipografia.pesoTitulo,
                          fontSize: 22,
                        }}
                      >
                        {ds.marca.nome || "Sem nome"}
                      </div>
                      <div style={{ color: ds.cores.textoSuave, fontSize: 12 }}>{ds.marca.tom}</div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {[
                          ds.cores.primaria,
                          ds.cores.secundaria,
                          ds.cores.acento,
                          ds.cores.sucesso,
                          ds.cores.erro,
                          ds.cores.alerta,
                          ds.cores.info,
                        ].map((c, i) => (
                          <span
                            key={`${c}-${i}`}
                            title={c}
                            className="size-6 rounded-md border border-white/10"
                            style={{ background: c }}
                          />
                        ))}
                      </div>

                      <div className="mt-4 flex flex-col gap-1.5">
                        {tipos.map((t) => (
                          <div key={t.nome} className="flex items-baseline justify-between gap-2">
                            <span style={{ color: ds.cores.textoSuave, fontSize: 11 }}>
                              {t.nome} · {t.px}px
                            </span>
                            <span
                              style={{
                                fontSize: Math.min(t.px, 30),
                                fontFamily: `'${t.nome === "Body" || t.nome === "Caption" ? ds.tipografia.fonteCorpo : ds.tipografia.fonteTitulo}', sans-serif`,
                                fontWeight:
                                  t.nome === "Body" || t.nome === "Caption"
                                    ? ds.tipografia.pesoCorpo
                                    : ds.tipografia.pesoTitulo,
                                lineHeight: 1.1,
                              }}
                            >
                              Ag
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs-plus font-medium"
                          style={{
                            background: ds.cores.primaria,
                            color: ds.cores.fundo,
                            borderRadius: ds.espacamento.raio,
                          }}
                        >
                          Botão primário
                        </button>
                        <div
                          className="px-3 py-2 text-xs-plus"
                          style={{
                            background: ds.cores.superficie,
                            borderRadius: ds.espacamento.raio,
                            fontFamily: `'${ds.tipografia.fonteCorpo}', sans-serif`,
                          }}
                        >
                          <b>Card</b>
                          <div style={{ color: ds.cores.textoSuave }}>
                            Superfície elevada com o raio e as cores do sistema.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                      <h4 className="dark:text-dark-200 mb-2 text-tiny-plus font-semibold uppercase tracking-wider text-gray-500">
                        Contraste (WCAG)
                      </h4>
                      <div className="flex flex-col gap-1.5">
                        {pares.map(([lbl, a, b]) => {
                          const r = contraste(a, b);
                          const nv = nivel(r);
                          return (
                            <div key={lbl} className="flex items-center justify-between gap-2 text-tiny">
                              <span className="dark:text-dark-300 min-w-0 flex-1 truncate text-gray-500">{lbl}</span>
                              <b className="dark:text-dark-100 text-gray-700">{r.toFixed(2)}:1</b>
                              <span
                                className={clsx(
                                  "rounded px-1.5 py-0.5 font-medium",
                                  nv.ok
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                                )}
                              >
                                {nv.txt}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>

              <div className="dark:border-dark-600 flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
                {podeExcluir && (
                  <Button variant="flat" onClick={excluir} className="gap-1.5 text-rose-600 dark:text-rose-400">
                    <TrashIcon className="size-4" /> Excluir marca
                  </Button>
                )}
                <Button variant="outlined" onClick={restaurar} className="gap-1.5">
                  <SparklesIcon className="size-4" /> Restaurar sugestões
                </Button>
                <Button color="primary" onClick={salvar} className="gap-1.5">
                  <CheckIcon className="size-4" /> Salvar design system
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
