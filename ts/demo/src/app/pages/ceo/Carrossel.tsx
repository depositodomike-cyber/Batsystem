// Import Dependencies
import { useState } from "react";
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
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Accordion, Button, Checkbox } from "@/components/ui";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { DesignSystemBar, useActiveDesignSystem } from "./design-system";
import {
  gerarCarrosselApi,
  type Carrossel,
  type CardItem,
} from "@/services/api/carrossel";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { EnviarParaGrupoButton } from "./EnviarParaGrupo";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  AcoesEtapa,
  CAIXA_ERRO,
  CAMPO,
  CAMPO_SELECT,
  CAMPO_TEXTAREA,
  LabAjuste,
  LabCarregando,
  LabEtapa,
  LabPagina,
  LabResultado,
  PerguntaEtapa,
  ROTULO_CAMPO,
  useCriacaoLab,
  useEtapasLab,
  type PassoLab,
} from "./lab";
import { abrirEmJanelaPropria } from "@/utils/abrirPrevia";

// ----------------------------------------------------------------------
// Criar Carrossel — página do Lab (era janela). Etapas de briefing; a IA gera o
// roteiro (cards + legenda + hashtags); roteiro editável com prévia dos cards
// (1:1), refino e exportação em HTML autônomo. Salva em Minhas criações.
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
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

// Carrossel HTML autônomo (cards 1:1 navegáveis).
function buildCarrosselHtml(
  titulo: string,
  cards: CardItem[],
  legenda: string,
  hashtags: string[],
): string {
  const total = cards.length;
  const cardsHtml = cards
    .map((c, i) => {
      const eyebrow =
        i === 0 ? "CAPA" : i === total - 1 ? "CTA" : `${i + 1} / ${total}`;
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

type EtapaId = "sobre" | "estilo";
const ETAPAS = [
  { id: "sobre" as const, numero: "01", titulo: "Sobre o carrossel" },
  { id: "estilo" as const, numero: "02", titulo: "Estilo e páginas" },
];

export default function CarrosselPagina() {
  const [passo, setPasso] = useState<PassoLab>("form");
  const [erro, setErro] = useState("");
  const [refinando, setRefinando] = useState(false);

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
  // vai junto da nota ao salvar no Repositório.
  const [conexoes, setConexoes] = useState("");

  const etapas = useEtapasLab<EtapaId>(ETAPAS, {
    sobre: tema.trim().slice(0, 80) || undefined,
    estilo: `${ESTILOS.find(([id]) => id === estilo)?.[1] ?? estilo} · ${
      nPaginas ? `${nPaginas} páginas` : "a IA decide as páginas"
    }`,
  });

  const criacao = useCriacaoLab({
    tipo: "carrossel",
    passo,
    erro: Boolean(erro) && cards.length === 0,
    relevante: tema.trim().length >= 20 || cards.length > 0,
    titulo: titulo || tema.trim().slice(0, 80),
    dados: {
      tema,
      contexto,
      estilo,
      nPaginas,
      usarMemoria,
      titulo,
      cards,
      legenda,
      hashtags,
      conexoes,
    },
    restaurar: (d) => {
      setTema(d.tema ?? "");
      setContexto(d.contexto ?? "");
      if (d.estilo) setEstilo(d.estilo);
      if (typeof d.nPaginas === "number") setNPaginas(d.nPaginas);
      setUsarMemoria(Boolean(d.usarMemoria));
      setTitulo(d.titulo ?? "");
      setLegenda(d.legenda ?? "");
      setHashtags(d.hashtags ?? "");
      setConexoes(d.conexoes ?? "");
      if (d.cards?.length) {
        setCards(d.cards);
        setPasso("pronta");
      }
    },
  });

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
    cards: cards
      .map((c) => ({ titulo: c.titulo.trim(), texto: c.texto.trim() }))
      .filter((c) => c.titulo || c.texto),
    legenda: legenda.trim(),
    hashtags: hashtags
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#/, "").trim())
      .filter(Boolean),
    conexoes,
  });

  const pedido = () => ({
    tema: tema.trim(),
    contexto: contexto.trim() || undefined,
    estilo,
    nPaginas,
    fontes: usarMemoria ? ["memoria"] : undefined,
    design,
  });

  const gerar = async () => {
    setErro("");
    if (!tema.trim()) return setErro("Descreva o tema do carrossel.");
    setPasso("gerando");
    try {
      carregar(await gerarCarrosselApi(pedido()));
      setPasso("pronta");
    } catch (err) {
      setErro(errMessage(err));
      setPasso("form");
    }
  };

  const refazer = async () => {
    if (!ajuste.trim()) return;
    setErro("");
    setRefinando(true);
    try {
      const c = await gerarCarrosselApi({
        ...pedido(),
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

  /** Volta ao formulário mantendo o briefing (o roteiro é refeito do zero). */
  const refazerForm = () => {
    setPasso("form");
    setErro("");
  };

  const novo = () => {
    criacao.reiniciar();
    setTema("");
    setContexto("");
    setTitulo("");
    setCards([]);
    setLegenda("");
    setHashtags("");
    setConexoes("");
    setAjuste("");
    setErro("");
    setPasso("form");
    etapas.reiniciar();
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
    const txt =
      `${c.legenda}\n\n${c.hashtags.map((h) => `#${h}`).join(" ")}`.trim();
    try {
      await navigator.clipboard.writeText(txt);
      toast("Copiado", {
        description: "Legenda + hashtags na área de transferência.",
      });
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const baixarHtml = () => {
    const c = atual();
    if (!c.cards.length) return;
    const html = buildCarrosselHtml(c.titulo, c.cards, c.legenda, c.hashtags);
    const nome =
      c.titulo.replace(/[^\p{L}\p{N}\-_ ]/gu, "").slice(0, 60) || "carrossel";
    const blob = new Blob([html], { type: "text/html" });
    // Web: nova aba (blob). Desktop: janela de prévia isolada (HTML gerado por IA).
    void abrirEmJanelaPropria(blob, { titulo: `${c.titulo} — Oracle` }).catch(() => undefined);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast("Carrossel gerado", {
      description: "Aberto em nova aba e baixado (.html).",
    });
  };

  // Nota do Repositório: os cards em Markdown (para o grafo ler o texto) + o
  // carrossel HTML autônomo como anexo.
  const prepararMemoria = async () => {
    const c = atual();
    const corpo = c.cards
      .map((k, i) => `## ${i + 1}. ${k.titulo}\n\n${k.texto}`)
      .join("\n\n");
    const rodape = [c.legenda, c.hashtags.map((h) => `#${h}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    return {
      conteudo: [corpo, rodape, c.conexoes.trim()]
        .filter(Boolean)
        .join("\n\n---\n\n"),
      anexos: [
        {
          nome: "carrossel.html",
          dados: new Blob(
            [buildCarrosselHtml(c.titulo, c.cards, c.legenda, c.hashtags)],
            { type: "text/html" },
          ),
        },
      ],
    };
  };

  const card = cards[Math.min(idx, Math.max(0, cards.length - 1))];

  return (
    <LabPagina
      titulo="Criar carrossel"
      subtitulo="A IA escreve o roteiro dos cards, você edita e exporta."
      Icone={ViewColumnsIcon}
      tint="bg-violet-500/10 text-violet-500"
      selo={passo === "pronta" ? "Revisar o roteiro" : null}
      ajuda={
        <>
          <p>
            Descreva o <strong>tema</strong> e o estilo. A IA gera o roteiro:
            cards, legenda e hashtags.
          </p>
          <p>
            No roteiro, edite cada card, reordene, remova ou adicione, e veja a
            prévia 1:1. Use <strong>Peça um ajuste</strong> para a IA refazer, e
            exporte o carrossel em HTML.
          </p>
        </>
      }
    >
      {criacao.erroAoCarregar && (
        <div className={`${CAIXA_ERRO} mb-4`}>{criacao.erroAoCarregar}</div>
      )}

      {passo === "form" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void gerar();
          }}
        >
          <Accordion {...etapas.accordion} className="flex flex-col gap-3">
            <LabEtapa {...etapas.etapa("sobre")}>
              <PerguntaEtapa>Sobre o que é o carrossel?</PerguntaEtapa>
              <MemoriaTextarea
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                rows={3}
                placeholder="Ex.: 5 hábitos para organizar a semana"
                className={`${CAMPO_TEXTAREA} rounded-lg`}
              />

              <div className="mt-5">
                <label className={ROTULO_CAMPO}>
                  Contexto e instruções{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (opcional)
                  </span>
                </label>
                <MemoriaTextarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  rows={3}
                  placeholder="Público, tom, chamada final, o que não pode faltar…"
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
              </div>

              <label className="dark:text-dark-100 mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={usarMemoria}
                  onChange={(e) => setUsarMemoria(e.target.checked)}
                  className="size-4"
                />
                Usar o Repositório como referência
              </label>
              <AcoesEtapa
                onContinuar={() => etapas.concluirEtapa("sobre")}
                desabilitado={!tema.trim()}
              />
            </LabEtapa>

            <LabEtapa {...etapas.etapa("estilo")}>
              <PerguntaEtapa>Qual o estilo e o tamanho?</PerguntaEtapa>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={ROTULO_CAMPO}>Estilo</label>
                  <select
                    value={estilo}
                    onChange={(e) => setEstilo(e.target.value)}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    {ESTILOS.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={ROTULO_CAMPO}>Nº de páginas</label>
                  <select
                    value={nPaginas}
                    onChange={(e) => setNPaginas(Number(e.target.value))}
                    className={`${CAMPO_SELECT} rounded-lg`}
                  >
                    {QTDS.map((q) => (
                      <option key={q} value={q}>
                        {q === 0 ? "A IA decide" : q}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dark:border-dark-600 mt-5 border-t border-gray-100 pt-5">
                <DesignSystemBar plain />
              </div>
              <AcoesEtapa
                onDecidirPorMim={() => {
                  setEstilo("equilibrado");
                  setNPaginas(0);
                  etapas.concluirEtapa("estilo");
                }}
                onContinuar={() => etapas.concluirEtapa("estilo")}
              />
            </LabEtapa>
          </Accordion>

          {erro && <div className={`${CAIXA_ERRO} mt-4`}>{erro}</div>}

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              color="primary"
              disabled={!tema.trim()}
              className="h-10 gap-2 px-5"
            >
              <ViewColumnsIcon className="size-5" />
              Gerar roteiro
            </Button>
          </div>
        </form>
      )}

      {passo === "gerando" && (
        <LabCarregando
          titulo="Escrevendo o roteiro…"
          descricao="A IA está montando os cards, a legenda e as hashtags."
        />
      )}

      {passo === "pronta" && (
        <LabResultado
          titulo="Roteiro pronto"
          descricao="Edite os cards, confira a prévia e exporte."
          detalhe={`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}
          erro={erro}
          acoesSecundarias={
            <>
              <Button variant="flat" onClick={refazerForm} className="gap-1.5">
                <ArrowLeftIcon className="size-4" /> Voltar ao briefing
              </Button>
              <Button variant="flat" onClick={novo} className="gap-1.5">
                <ArrowPathIcon className="size-4" /> Novo carrossel
              </Button>
            </>
          }
          acoesPrincipais={
            <>
              <Button
                variant="outlined"
                onClick={() => void copiarLegenda()}
                className="h-10 gap-2 px-5"
              >
                <ClipboardDocumentIcon className="size-5" /> Legenda
              </Button>
              <SalvarNaMemoriaButton
                pasta={PASTA_MEMORIA.carrossel}
                titulo={titulo || "Carrossel"}
                tags={["carrossel"]}
                versao={cards.length + legenda.length + conexoes.length}
                disabled={!cards.length}
                preparar={prepararMemoria}
                rotulo="Salvar no Repositório"
                rotuloSalvo="Salvo no Repositório"
                semSeletorDePasta
                className="h-10 px-5"
              />
              <EnviarParaGrupoButton
                funcao="carrossel"
                titulo={titulo || "Carrossel"}
                versao={cards.length + legenda.length}
                disabled={!cards.length}
                preparar={prepararMemoria}
                className="h-10 px-5"
              />
              <Button
                color="primary"
                onClick={baixarHtml}
                disabled={!cards.length}
                className="h-10 gap-2 px-5"
              >
                <ArrowDownTrayIcon className="size-5" /> Baixar HTML
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Coluna edição */}
            <div className="flex flex-col gap-3">
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título interno"
                className={`${CAMPO} rounded-lg font-semibold`}
              />

              {cards.map((c, i) => (
                <div
                  key={i}
                  className={clsx(
                    "rounded-xl border p-4 transition-colors",
                    i === idx
                      ? "border-primary-500/60 dark:bg-dark-800/40"
                      : "dark:border-dark-600 dark:bg-dark-800/40 border-gray-200",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="dark:bg-dark-600 dark:text-dark-200 grid size-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500">
                      {i + 1}
                    </span>
                    <input
                      value={c.titulo}
                      onChange={(e) =>
                        setCards((a) =>
                          a.map((x, k) =>
                            k === i ? { ...x, titulo: e.target.value } : x,
                          ),
                        )
                      }
                      onFocus={() => setIdx(i)}
                      placeholder="Título do card"
                      className={`${CAMPO} min-w-0 flex-1 rounded-lg font-medium`}
                    />
                    <IconBtn label="Subir" onClick={() => move(i, -1)}>
                      <ArrowUpIcon className="size-4" />
                    </IconBtn>
                    <IconBtn label="Descer" onClick={() => move(i, 1)}>
                      <ArrowDownIcon className="size-4" />
                    </IconBtn>
                    <IconBtn
                      label="Remover"
                      danger
                      onClick={() =>
                        setCards((a) => a.filter((_, k) => k !== i))
                      }
                    >
                      <TrashIcon className="size-4" />
                    </IconBtn>
                  </div>
                  <MemoriaTextarea
                    value={c.texto}
                    onChange={(e) =>
                      setCards((a) =>
                        a.map((x, k) =>
                          k === i ? { ...x, texto: e.target.value } : x,
                        ),
                      )
                    }
                    onFocus={() => setIdx(i)}
                    rows={2}
                    placeholder="Corpo do card"
                    className={`${CAMPO_TEXTAREA} text-xs-plus rounded-lg`}
                  />
                </div>
              ))}
              <Button
                variant="outlined"
                onClick={() =>
                  setCards((a) => [...a, { titulo: "", texto: "" }])
                }
                className="gap-2 self-start"
              >
                <PlusIcon className="size-5" /> Adicionar card
              </Button>

              <div>
                <label className={ROTULO_CAMPO}>Legenda</label>
                <MemoriaTextarea
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  rows={3}
                  className={`${CAMPO_TEXTAREA} rounded-lg`}
                />
              </div>
              <div>
                <label className={ROTULO_CAMPO}>
                  Hashtags{" "}
                  <span className="dark:text-dark-300 font-normal text-gray-400">
                    (separadas por espaço, sem #)
                  </span>
                </label>
                <input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className={`${CAMPO} rounded-lg`}
                />
              </div>
            </div>

            {/* Coluna prévia */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
              <div className="border-dark-600 relative aspect-square w-full overflow-hidden rounded-2xl border bg-[#111827] p-8">
                <div className="bg-primary-500 absolute inset-y-0 left-0 w-2" />
                <div className="text-primary-400 absolute top-6 left-8 text-xs font-bold tracking-widest">
                  {idx === 0
                    ? "CAPA"
                    : idx === cards.length - 1
                      ? "CTA"
                      : `${idx + 1} / ${cards.length}`}
                </div>
                <div className="flex h-full flex-col justify-center">
                  <h3 className="text-2xl leading-tight font-extrabold text-[#F8FAFC]">
                    {card?.titulo || "—"}
                  </h3>
                  {card?.texto && (
                    <p className="mt-3 text-sm leading-relaxed text-[#E2E8F0]">
                      {card.texto}
                    </p>
                  )}
                </div>
                <span className="absolute right-5 bottom-4 text-xs text-[#94A3B8]">
                  {cards.length ? idx + 1 : 0}/{cards.length}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <IconBtn
                  label="Anterior"
                  onClick={() => setIdx((n) => Math.max(0, n - 1))}
                >
                  <ArrowLeftIcon className="size-4" />
                </IconBtn>
                <span className="dark:text-dark-300 min-w-14 text-center text-xs text-gray-400">
                  {cards.length ? idx + 1 : 0} / {cards.length}
                </span>
                <IconBtn
                  label="Próximo"
                  onClick={() =>
                    setIdx((n) => Math.min(cards.length - 1, n + 1))
                  }
                >
                  <ArrowRightIcon className="size-4" />
                </IconBtn>
              </div>

              <LabAjuste
                valor={ajuste}
                onChange={setAjuste}
                onRefazer={() => void refazer()}
                refinando={refinando}
                placeholder="Ex.: mais provocativo, menos texto…"
              />
            </div>
          </div>
        </LabResultado>
      )}
    </LabPagina>
  );
}

function IconBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        "dark:hover:bg-dark-600 grid size-7 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100",
        danger
          ? "hover:text-rose-500"
          : "dark:hover:text-dark-100 hover:text-gray-700",
      )}
    >
      {children}
    </button>
  );
}
