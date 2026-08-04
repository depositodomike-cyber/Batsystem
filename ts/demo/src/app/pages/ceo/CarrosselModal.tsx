// Import Dependencies
import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { toast } from "sonner";
import {
  ViewColumnsIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Button, Checkbox, Spinner } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { WindowControls } from "@/app/contexts/ia-modals/WindowControls";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import { gerarCarrosselApi, type Carrossel, type CardItem } from "@/services/api/carrossel";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Criar Carrossel — portado do beculture/Confi. Etapa 1: a IA gera o roteiro
// (cards + legenda + hashtags). Etapa 2: roteiro editável com prévia dos cards
// (1:1), refino e exportação do carrossel em HTML autônomo.
// ----------------------------------------------------------------------

const ESTILOS: [string, string][] = [
  ["equilibrado", "Equilibrado (padrão)"],
  ["sobrio", "Sóbrio — executivo"],
  ["ousado", "Ousado — editorial"],
];
const QTDS = [0, 5, 6, 7, 8, 9, 10];

function errMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "Falha ao gerar o carrossel. Tente novamente.";
}

function escHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

// Carrossel HTML autônomo (cards 1:1 navegáveis).
function buildCarrosselHtml(titulo: string, cards: CardItem[], legenda: string, hashtags: string[]): string {
  const total = cards.length;
  const cardsHtml = cards
    .map((c, i) => {
      const eyebrow = i === 0 ? "CAPA" : i === total - 1 ? "CTA" : `${i + 1} / ${total}`;
      return (
        `<section class="card${i === 0 ? " active" : ""}">` +
        `<div class="eyebrow">${escHtml(eyebrow)}</div>` +
        `<h2>${escHtml(c.titulo)}</h2>` +
        (c.texto ? `<p>${escHtml(c.texto)}</p>` : "") +
        `<span class="pg">${i + 1}/${total}</span>` +
        `</section>`
      );
    })
    .join("");
  const tags = hashtags.map((h) => `#${escHtml(h)}`).join(" ");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(titulo)}</title>
<style>
 :root{--bg:#0b1220;--card:#111827;--ambar:#FFCA28;--titulo:#F8FAFC;--texto:#E2E8F0;--suave:#94A3B8}
 *{box-sizing:border-box}body{margin:0;background:#05070d;color:var(--texto);font-family:Inter,system-ui,Arial,sans-serif}
 .stage{min-height:100vh;display:grid;place-items:center;padding:24px}
 .deck{width:min(92vw,540px)}
 .frame{position:relative;width:100%;aspect-ratio:1/1;background:var(--card);border:1px solid #1e293b;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}
 .card{display:none;position:absolute;inset:0;padding:44px;flex-direction:column;justify-content:center}
 .card.active{display:flex}
 .card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--ambar)}
 .eyebrow{position:absolute;top:26px;left:44px;color:var(--ambar);font-size:12px;letter-spacing:.14em;font-weight:700}
 h2{font-size:clamp(24px,6vw,40px);margin:0 0 16px;color:var(--titulo);font-weight:800;line-height:1.1}
 p{font-size:clamp(15px,3.4vw,20px);line-height:1.5;margin:0;color:var(--texto)}
 .pg{position:absolute;right:24px;bottom:20px;color:var(--suave);font-size:13px}
 .nav{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:16px}
 .nav button{background:#0f172a;border:1px solid #1e293b;color:var(--texto);border-radius:999px;font-size:18px;cursor:pointer;padding:6px 14px}
 .nav button:hover{background:#1e293b}.nav .count{color:var(--suave);font-size:13px;min-width:56px;text-align:center}
 .cap{width:min(92vw,540px);margin:22px auto 0;color:var(--texto);font-size:14px;line-height:1.6}
 .cap .tags{color:var(--ambar);margin-top:8px}
</style></head><body>
<div class="stage"><div>
 <div class="deck"><div class="frame" id="frame">${cardsHtml}</div>
 <div class="nav"><button id="prev">‹</button><span class="count" id="count"></span><button id="next">›</button></div></div>
 ${legenda || tags ? `<div class="cap">${legenda ? escHtml(legenda) : ""}${tags ? `<div class="tags">${tags}</div>` : ""}</div>` : ""}
</div></div>
<script>
 var cards=[].slice.call(document.querySelectorAll('.card')),i=0,count=document.getElementById('count');
 function show(n){i=Math.max(0,Math.min(cards.length-1,n));cards.forEach(function(c,k){c.classList.toggle('active',k===i)});count.textContent=(i+1)+' / '+cards.length;}
 document.getElementById('next').onclick=function(){show(i+1)};document.getElementById('prev').onclick=function(){show(i-1)};
 document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1);});
 show(0);
</script></body></html>`;
}

interface Props {
  isOpen: boolean;
  close: () => void;
  /** Recolhe a janela para o dock do rodapé (host global). */
  onMinimize?: () => void;
}

export function CarrosselModal({ isOpen, close, onMinimize }: Props) {
  const [step, setStep] = useState<"form" | "loading" | "editor">("form");
  const [erro, setErro] = useState("");
  const [refinando, setRefinando] = useState(false);

  // Marca/design system ativo — enviado junto com a geração.
  const design = useActiveDesignSystem();

  // Formulário
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [estilo, setEstilo] = useState("equilibrado");
  const [nPaginas, setNPaginas] = useState(0);
  const [usarMemoria, setUsarMemoria] = useState(false);

  // Roteiro
  const [titulo, setTitulo] = useState("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [legenda, setLegenda] = useState("");
  const [hashtags, setHashtags] = useState(""); // separadas por espaço, sem #
  const [ajuste, setAjuste] = useState("");
  const [idx, setIdx] = useState(0);
  // Bloco "🔗 Conexões no Vault" da última geração — não é editável no roteiro;
  // vai junto da nota ao salvar na Memória.
  const [conexoes, setConexoes] = useState("");

  const carregar = (c: Carrossel) => {
    setTitulo(c.titulo);
    setCards(c.cards);
    setLegenda(c.legenda);
    setHashtags(c.hashtags.join(" "));
    setConexoes((c.conexoes || "").trim());
    setIdx(0);
  };

  const atual = (): Carrossel => ({
    titulo: titulo.trim() || "Carrossel",
    cards: cards.map((c) => ({ titulo: c.titulo.trim(), texto: c.texto.trim() })).filter((c) => c.titulo || c.texto),
    legenda: legenda.trim(),
    hashtags: hashtags.split(/[\s,]+/).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
    conexoes,
  });

  const fechar = () => {
    if (step === "loading" || refinando) return;
    close();
  };

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o tema do carrossel.");
    setStep("loading");
    try {
      const c = await gerarCarrosselApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        estilo,
        nPaginas,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
      });
      carregar(c);
      setStep("editor");
    } catch (err) {
      setErro(errMessage(err));
      setStep("form");
    }
  };

  const refazer = async () => {
    if (!ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const c = await gerarCarrosselApi({
        tema: tema.trim(),
        contexto: contexto.trim() || undefined,
        estilo,
        nPaginas,
        fontes: usarMemoria ? ["memoria"] : undefined,
        design,
        ajuste: ajuste.trim(),
        anterior: atual(),
      });
      carregar(c);
      setAjuste("");
    } catch (err) {
      setErro(errMessage(err));
    } finally {
      setRefinando(false);
    }
  };

  const refazerForm = () => {
    setStep("form");
    setErro("");
  };

  const move = (i: number, dir: -1 | 1) =>
    setCards((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const copiarLegenda = async () => {
    const c = atual();
    const txt = `${c.legenda}\n\n${c.hashtags.map((h) => `#${h}`).join(" ")}`.trim();
    try {
      await navigator.clipboard.writeText(txt);
      toast("Copiado", { description: "Legenda + hashtags na área de transferência." });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixarHtml = () => {
    const c = atual();
    if (!c.cards.length) return;
    const html = buildCarrosselHtml(c.titulo, c.cards, c.legenda, c.hashtags);
    const nome = c.titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "carrossel";
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast("Carrossel gerado", { description: "Aberto em nova aba e baixado (.html)." });
  };

  // Nota da Memória: os cards em Markdown (para o grafo ler o texto) + o
  // carrossel HTML autônomo como anexo.
  const prepararMemoria = async () => {
    const c = atual();
    const corpo = c.cards.map((k, i) => `## ${i + 1}. ${k.titulo}\n\n${k.texto}`).join("\n\n");
    const rodape = [c.legenda, c.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");
    return {
      conteudo: [corpo, rodape, c.conexoes.trim()].filter(Boolean).join("\n\n---\n\n"),
      anexos: [
        {
          nome: "carrossel.html",
          dados: new Blob([buildCarrosselHtml(c.titulo, c.cards, c.legenda, c.hashtags)], {
            type: "text/html",
          }),
        },
      ],
    };
  };

  const card = cards[Math.min(idx, Math.max(0, cards.length - 1))];

  return (
    <Transition show={isOpen}>
      <Dialog onClose={fechar} className="relative z-[70]">
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
            <DialogPanel className="dark:bg-dark-700 my-4 flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
                <DialogTitle className="dark:text-dark-50 flex items-center gap-2 text-base font-semibold text-gray-800">
                  <ViewColumnsIcon className="size-5" />
                  IA · Criar carrossel
                </DialogTitle>
                <WindowControls
                  onMinimize={onMinimize}
                  onClose={fechar}
                  closeDisabled={step === "loading" || refinando}
                />
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                {/* Etapa 1 */}
                {step === "form" && (
                  <form onSubmit={(e) => { e.preventDefault(); gerar(); }} className="flex flex-col gap-3">
                    <DesignSystemBar />

                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Tema do carrossel <span className="text-rose-500">*</span>
                      </label>
                      <MemoriaTextarea
                        value={tema}
                        onChange={(e) => setTema(e.target.value)}
                        rows={2}
                        placeholder="Ex.: 5 erros que sabotam suas reuniões"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Estilo</label>
                        <select value={estilo} onChange={(e) => setEstilo(e.target.value)} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                          {ESTILOS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Nº de páginas</label>
                        <select value={nPaginas} onChange={(e) => setNPaginas(Number(e.target.value))} className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                          {QTDS.map((q) => <option key={q} value={q}>{q === 0 ? "A IA decide" : `${q} páginas`}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">
                        Contexto / instruções <span className="text-gray-400">(opcional)</span>
                      </label>
                      <MemoriaTextarea
                        value={contexto}
                        onChange={(e) => setContexto(e.target.value)}
                        rows={2}
                        placeholder="Público, ângulo, CTA desejado…"
                        className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
                      />
                    </div>
                    <label className="dark:text-dark-200 flex cursor-pointer items-center gap-2 text-xs-plus text-gray-600">
                      <Checkbox checked={usarMemoria} onChange={(e) => setUsarMemoria(e.target.checked)} className="size-4" />
                      Usar a Memória como referência
                    </label>
                    {erro && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs-plus text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">{erro}</div>}
                    <div className="flex justify-end pt-1">
                      <Button type="submit" color="primary" disabled={!tema.trim()} className="gap-2">
                        <ViewColumnsIcon className="size-5" /> Gerar roteiro
                      </Button>
                    </div>
                  </form>
                )}

                {step === "loading" && (
                  <div className="grid place-items-center py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Spinner className="size-6" />
                      <p className="dark:text-dark-200 text-sm text-gray-600">A IA está montando o carrossel…</p>
                    </div>
                  </div>
                )}

                {/* Etapa 2 — editor + prévia */}
                {step === "editor" && (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Coluna edição */}
                    <div className="flex flex-col gap-3">
                      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título interno" className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-50 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold placeholder:text-gray-400" />

                      {cards.map((c, i) => (
                        <div key={i} className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="dark:bg-dark-600 dark:text-dark-200 grid size-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500">{i + 1}</span>
                            <input value={c.titulo} onChange={(e) => setCards((a) => a.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))} onFocus={() => setIdx(i)} placeholder="Título do card" className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium placeholder:text-gray-400" />
                            <IconBtn label="Subir" onClick={() => move(i, -1)}><ArrowUpIcon className="size-4" /></IconBtn>
                            <IconBtn label="Descer" onClick={() => move(i, 1)}><ArrowDownIcon className="size-4" /></IconBtn>
                            <IconBtn label="Remover" danger onClick={() => setCards((a) => a.filter((_, k) => k !== i))}><TrashIcon className="size-4" /></IconBtn>
                          </div>
                          <MemoriaTextarea value={c.texto} onChange={(e) => setCards((a) => a.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))} onFocus={() => setIdx(i)} rows={2} placeholder="Corpo do card" className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs-plus placeholder:text-gray-400" />
                        </div>
                      ))}
                      <Button variant="outlined" onClick={() => setCards((a) => [...a, { titulo: "", texto: "" }])} className="gap-2 self-start">
                        <PlusIcon className="size-5" /> Adicionar card
                      </Button>

                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Legenda</label>
                        <MemoriaTextarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={3} className="form-textarea dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="dark:text-dark-200 mb-1 block text-xs-plus font-medium text-gray-600">Hashtags <span className="text-gray-400">(separadas por espaço, sem #)</span></label>
                        <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>

                    {/* Coluna prévia + ações */}
                    <div className="flex flex-col gap-3">
                      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-dark-600 bg-[#111827] p-8">
                        <div className="absolute inset-y-0 left-0 w-2 bg-[#FFCA28]" />
                        <div className="absolute left-8 top-6 text-xs font-bold tracking-widest text-[#FFCA28]">
                          {idx === 0 ? "CAPA" : idx === cards.length - 1 ? "CTA" : `${idx + 1} / ${cards.length}`}
                        </div>
                        <div className="flex h-full flex-col justify-center">
                          <h3 className="text-2xl font-extrabold leading-tight text-[#F8FAFC]">{card?.titulo || "—"}</h3>
                          {card?.texto && <p className="mt-3 text-sm leading-relaxed text-[#E2E8F0]">{card.texto}</p>}
                        </div>
                        <span className="absolute bottom-4 right-5 text-xs text-[#94A3B8]">{cards.length ? idx + 1 : 0}/{cards.length}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <IconBtn label="Anterior" onClick={() => setIdx((n) => Math.max(0, n - 1))}><ArrowLeftIcon className="size-4" /></IconBtn>
                        <span className="dark:text-dark-300 min-w-14 text-center text-xs text-gray-400">{cards.length ? idx + 1 : 0} / {cards.length}</span>
                        <IconBtn label="Próximo" onClick={() => setIdx((n) => Math.min(cards.length - 1, n + 1))}><ArrowRightIcon className="size-4" /></IconBtn>
                      </div>

                      {/* Refino */}
                      <div className="dark:border-dark-600 dark:bg-dark-800/40 rounded-xl border border-gray-200 p-3">
                        <label className="dark:text-dark-200 mb-1.5 flex items-center gap-1.5 text-xs-plus font-medium text-gray-600">
                          <SparklesIcon className="size-4" /> Peça um ajuste
                        </label>
                        <div className="flex gap-2">
                          <input value={ajuste} onChange={(e) => setAjuste(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !refinando) refazer(); }} disabled={refinando} placeholder="Ex.: mais provocativo, menos texto…" className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400" />
                          <Button onClick={refazer} color="primary" disabled={!ajuste.trim() || refinando} className="gap-1.5">
                            {refinando ? <Spinner className="size-4" /> : <ArrowPathIcon className="size-4" />} Refazer
                          </Button>
                        </div>
                      </div>

                      {erro && <p className="text-xs-plus text-rose-500">{erro}</p>}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="flat" onClick={refazerForm} className="gap-1.5">
                          <ArrowLeftIcon className="size-4" /> Refazer do zero
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outlined" onClick={copiarLegenda} className="gap-1.5">
                            <ClipboardDocumentIcon className="size-4" /> Legenda
                          </Button>
                          <Button color="primary" onClick={baixarHtml} className="gap-2">
                            <ArrowTopRightOnSquareIcon className="size-5" /> <ArrowDownTrayIcon className="size-4" /> HTML
                          </Button>
                          <SalvarNaMemoriaButton
                            pasta={PASTA_MEMORIA.carrossel}
                            titulo={titulo || "Carrossel"}
                            tags={["carrossel"]}
                            versao={cards.length + legenda.length + conexoes.length}
                            disabled={!cards.length}
                            preparar={prepararMemoria}
                            className="h-auto"
                          />
                          <EnviarParaGrupoButton
                            funcao="carrossel"
                            titulo={titulo || "Carrossel"}
                            versao={cards.length + legenda.length}
                            disabled={!cards.length}
                            preparar={prepararMemoria}
                            className="h-auto"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function IconBtn({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={clsx("dark:hover:bg-dark-600 grid size-7 shrink-0 place-items-center rounded-md text-gray-400 transition-colors hover:bg-gray-100", danger ? "hover:text-rose-500" : "hover:text-gray-700 dark:hover:text-dark-100")}>
      {children}
    </button>
  );
}
