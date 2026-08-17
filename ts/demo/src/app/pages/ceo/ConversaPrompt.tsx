/**
 * Área Conversas: lista recente no sidebar, página vazia ou thread persistida
 * do Prompt (POST /ai/prompt). Não usa o stream dos squads.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Spinner } from "@/components/ui";
import { useConversasContext } from "@/app/contexts/conversas/context";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { MarkdownView } from "@/app/pages/ceo/MarkdownView";
import { PromptBar } from "@/app/pages/ceo/PromptBar";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import {
  fetchConversaApi,
  type ConversaMessage,
} from "@/services/api/conversas";
import {
  coletarReferencia,
} from "@/services/referencia";
import {
  perguntarPromptApi,
  fonteLabel,
  fonteUrl,
  type Fonte,
  type ModoBusca,
} from "@/services/api/prompt";
import {
  ArrowTopRightOnSquareIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

function fontesDe(m: ConversaMessage): Fonte[] {
  const raw = m.meta?.fontes;
  return Array.isArray(raw) ? (raw as Fonte[]) : [];
}

function Fontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {fontes.map((f, i) => {
        const url = fonteUrl(f);
        const label = fonteLabel(f);
        const base =
          "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-2 py-0.5 text-tiny";
        if (url) {
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className={clsx(
                base,
                "dark:border-dark-500 dark:text-dark-200 dark:hover:border-dark-400 border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              <ArrowTopRightOnSquareIcon className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </a>
          );
        }
        return (
          <span
            key={i}
            className={clsx(
              base,
              "border-primary-500/25 text-primary-600 dark:text-primary-400 bg-primary-500/5",
            )}
          >
            <CircleStackIcon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function ConversaPrompt() {
  const { pathname } = useLocation();
  const { conversaId } = useParams();
  const navigate = useNavigate();
  const product = getCurrentProduct(pathname);
  const { refresh } = useConversasContext();
  const repositorioId = useRepositorioAtivo()?.id ?? undefined;

  const [titulo, setTitulo] = useState("Nova pesquisa");
  const [modo, setModo] = useState<ModoBusca>("vault");
  const [messages, setMessages] = useState<ConversaMessage[]>([]);
  const [loading, setLoading] = useState(!!conversaId);
  const [pending, setPending] = useState(false);
  const [id, setId] = useState<string | null>(conversaId ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setId(conversaId ?? null);
    if (!conversaId) {
      setTitulo("Nova pesquisa");
      setMessages([]);
      setModo("vault");
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    if (!repositorioId) {
      navigate(`/${product.code}/conversas`, { replace: true });
      setLoading(false);
      return;
    }
    fetchConversaApi(conversaId, { repositorioId })
      .then((c) => {
        if (cancel) return;
        setTitulo(c.title);
        setModo(
          c.modo === "web" || c.modo === "auto" || c.modo === "vault"
            ? c.modo
            : "vault",
        );
        setMessages(c.messages);
      })
      .catch(() => {
        if (cancel) return;
        setMessages([]);
        navigate(`/${product.code}/conversas`, { replace: true });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [conversaId, repositorioId, navigate, product.code]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, loading]);

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const historico = [] as { pergunta: string; resposta: string }[];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== "user") continue;
      const next = messages[i + 1];
      historico.push({
        pergunta: m.text,
        resposta: next?.role === "assistant" ? next.text : "",
      });
    }

    const tempUser: ConversaMessage = {
      id: `tmp_u_${Date.now()}`,
      role: "user",
      text: trimmed,
      date: new Date().toISOString(),
    };
    const tempAsst: ConversaMessage = {
      id: `tmp_a_${Date.now()}`,
      role: "assistant",
      text: "",
      date: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser, tempAsst]);
    setPending(true);

    try {
      const referencia = modo !== "web" ? coletarReferencia() : undefined;
      const r = await perguntarPromptApi({
        texto: trimmed,
        modo,
        historico,
        referencia,
        conversaId: id ?? undefined,
        repositorioId,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAsst.id
            ? {
                ...m,
                text: r.resposta,
                meta: { fontes: r.fontes, origem: r.origem },
              }
            : m,
        ),
      );
      if (r.conversaId) {
        setId(r.conversaId);
        if (!conversaId) {
          navigate(`/${product.code}/conversas/${r.conversaId}`, {
            replace: true,
          });
        }
        void refresh();
        window.setTimeout(() => {
          void refresh();
          void fetchConversaApi(r.conversaId!, { repositorioId }).then((c) => {
            setTitulo(c.title);
          });
        }, 2500);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Não foi possível responder.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAsst.id ? { ...m, text: `⚠️ ${msg}` } : m,
        ),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Page title={`${titulo} · ${product.name}`}>
      <div className="flex h-[calc(100dvh-65px)] min-h-0 flex-col overflow-hidden">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="transition-content mx-auto w-full max-w-3xl px-(--margin-x) py-6">
            <PageTitle
              help={{
                description: (
                  <p>
                    Esta é a conversa completa. A Topbar continua valendo para
                    perguntas rápidas; aqui você retoma o mesmo fio, com o mesmo
                    Repositório e as mesmas fontes.
                  </p>
                ),
              }}
            >
              {titulo}
            </PageTitle>

            {loading && messages.length === 0 && (
              <div className="flex justify-center py-10">
                <Spinner color="primary" className="size-5" />
              </div>
            )}

            {!loading && messages.length === 0 && (
              <p className="dark:text-dark-300 mt-6 text-sm text-gray-500">
                Escreva a primeira mensagem para começar uma pesquisa nova.
              </p>
            )}

            <div className="mt-5 flex flex-col">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className={clsx(
                      i > 0 && "dark:border-dark-600 mt-4 border-t border-gray-100 pt-4",
                    )}
                  >
                    <p className="text-primary-600 dark:text-primary-400 text-sm font-semibold">
                      {m.text}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="mt-1.5">
                    {m.text ? (
                      <MarkdownView>{m.text}</MarkdownView>
                    ) : (
                      <p className="dark:text-dark-300 flex items-center gap-2 text-sm text-gray-400">
                        <span className="border-primary-500 size-3 animate-spin rounded-full border-2 border-t-transparent" />
                        pensando…
                      </p>
                    )}
                    <Fontes fontes={fontesDe(m)} />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <PromptBar
          placeholder={
            messages.length
              ? `Continuar “${titulo}”…`
              : "Digite sua mensagem…"
          }
          hint={
            modo === "web" ? "Web" : modo === "auto" ? "Auto" : "Repositório"
          }
          onSubmit={(t) => void handleSubmit(t)}
        />
      </div>
    </Page>
  );
}
