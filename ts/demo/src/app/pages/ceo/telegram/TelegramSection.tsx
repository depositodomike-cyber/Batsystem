// ----------------------------------------------------------------------
// Telegram no drawer de Configurações → Conectores.
//
// Conectar: gera um código de uso único (10 min) que o usuário envia ao bot
// (ou abre o link t.me, que já leva o código). Enquanto o código está
// pendente, o status é consultado a cada 5 s; quando o bot confirma, o card
// passa a "Conectado". Desconectar continua no rodapé do drawer.
// ----------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowPathIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button } from "@/components/ui";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import {
  cancelarCodigoTelegramApi,
  gerarCodigoTelegramApi,
  statusTelegramApi,
  tentarNovamenteTelegramApi,
  type CodigoTelegram,
  type StatusTelegram,
} from "@/services/api/telegram";
import { EVENTO_TELEGRAM_SINCRONIZAR } from "./CaixaTelegramSync";

function erroDe(err: unknown): string {
  const m =
    (err as { response?: { data?: { message?: unknown } }; message?: unknown })?.response?.data?.message ??
    (err as { message?: unknown })?.message;
  return typeof m === "string" ? m : Array.isArray(m) ? m.join(" ") : "Não foi possível concluir.";
}

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ROTULO_TIPO: Record<string, string> = {
  texto: "Texto",
  voz: "Mensagem de voz",
  audio: "Arquivo de áudio",
};

export function TelegramSection() {
  const { refletirConexao } = useConnectorsContext();
  const [status, setStatus] = useState<StatusTelegram | null>(null);
  const [codigo, setCodigo] = useState<CodigoTelegram | null>(null);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const s = await statusTelegramApi();
      setStatus(s);
      refletirConexao("telegram", s.conectado, s.conta);
      return s;
    } catch {
      return null;
    }
  }, [refletirConexao]);

  // Ao abrir e a cada 30 s (última comunicação e fila mudam sozinhas).
  useEffect(() => {
    const primeiro = setTimeout(() => void carregar(), 0);
    const t = setInterval(() => void carregar(), 30_000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(t);
    };
  }, [carregar]);

  // Código pendente: acompanha até o bot confirmar ou o código vencer.
  useEffect(() => {
    if (!codigo) return;
    const t = window.setInterval(() => {
      if (Date.parse(codigo.expiraEm) <= Date.now()) {
        setCodigo(null);
        return;
      }
      void carregar().then((s) => {
        if (s?.conectado) {
          setCodigo(null);
          toast.success("Telegram conectado.", { description: s.conta ?? undefined });
          window.dispatchEvent(new CustomEvent(EVENTO_TELEGRAM_SINCRONIZAR));
        }
      });
    }, 5_000);
    return () => window.clearInterval(t);
  }, [codigo, carregar]);

  const gerar = async () => {
    setGerando(true);
    try {
      setCodigo(await gerarCodigoTelegramApi());
    } catch (err) {
      toast.error(erroDe(err));
    } finally {
      setGerando(false);
    }
  };

  const cancelar = async () => {
    setCodigo(null);
    await cancelarCodigoTelegramApi().catch(() => undefined);
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  };

  const tentarNovamente = async (id: string) => {
    try {
      await tentarNovamenteTelegramApi(id);
      toast.success("Vou tentar transcrever de novo.");
      await carregar();
    } catch (err) {
      toast.error(erroDe(err));
    }
  };

  if (!status) return null;

  if (!status.configurado) {
    return (
      <div className="dark:border-dark-600 dark:bg-dark-800 text-xs-plus mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 dark:border-amber-500/20 dark:text-amber-300">
        O bot do Telegram não está configurado neste servidor. Crie um bot no @BotFather e defina{" "}
        <code className="font-mono">TELEGRAM_BOT_TOKEN</code> no <code className="font-mono">.env</code> da API.
      </div>
    );
  }

  const fila = status.fila;
  const pendentes = fila.processando + fila.prontas + fila.aguardandoRepositorio;

  return (
    <div className="mt-4 space-y-4">
      {status.conectado ? (
        <div className="dark:border-dark-600 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <dl className="text-xs-plus grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="dark:text-dark-300 text-gray-500">Conta</dt>
            <dd className="dark:text-dark-100 font-medium text-gray-700">{status.conta ?? "—"}</dd>
            {status.bot && (
              <>
                <dt className="dark:text-dark-300 text-gray-500">Bot</dt>
                <dd className="dark:text-dark-100 text-gray-700">
                  <a
                    href={`https://t.me/${status.bot}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    @{status.bot}
                  </a>
                </dd>
              </>
            )}
            <dt className="dark:text-dark-300 text-gray-500">Conectado em</dt>
            <dd className="dark:text-dark-100 text-gray-700">{quando(status.desde)}</dd>
            <dt className="dark:text-dark-300 text-gray-500">Última comunicação</dt>
            <dd className="dark:text-dark-100 text-gray-700">{quando(status.ultimaComunicacaoEm)}</dd>
            <dt className="dark:text-dark-300 text-gray-500">Notas</dt>
            <dd className="dark:text-dark-100 flex flex-wrap items-center gap-1.5 text-gray-700">
              <span>{fila.noRepositorio} no Repositório</span>
              {pendentes > 0 && (
                <Badge variant="soft" color="info" className="rounded-full">
                  {pendentes} a caminho
                </Badge>
              )}
              {fila.falhas > 0 && (
                <Badge variant="soft" color="warning" className="rounded-full">
                  {fila.falhas} com falha
                </Badge>
              )}
            </dd>
          </dl>
          <p className="dark:text-dark-300 mt-2 text-xs text-gray-500">
            Envie textos, mensagens de voz ou áudios ao bot no chat privado: eles viram notas em Notas → Telegram e
            são gravados no seu Repositório quando o Oracle estiver aberto.
          </p>
        </div>
      ) : (
        <div className="dark:border-dark-500 rounded-xl border border-dashed border-gray-300 p-4">
          {!codigo ? (
            <>
              <p className="dark:text-dark-200 text-xs-plus mb-3 text-gray-600">
                Gere um código e envie ao bot{status.bot ? ` @${status.bot}` : ""} no Telegram, em conversa privada.
                Só a sua conta do Telegram poderá criar notas.
              </p>
              <Button color="primary" className="h-9 gap-1.5" onClick={() => void gerar()} disabled={gerando}>
                <PaperAirplaneIcon className="size-4" />
                {gerando ? "Gerando…" : "Gerar código de conexão"}
              </Button>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="dark:text-dark-100 text-gray-700">
                Envie este código ao bot (vale até {new Date(codigo.expiraEm).toLocaleTimeString("pt-BR")}, uso
                único):
              </p>
              <div className="flex items-center gap-2">
                <code className="dark:bg-dark-800 flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest">
                  {codigo.codigo}
                </code>
                <Button
                  variant="flat"
                  isIcon
                  className="size-9"
                  title="Copiar código"
                  aria-label="Copiar código"
                  onClick={() => void copiar(codigo.codigo)}
                >
                  <ClipboardDocumentIcon className="size-4.5" />
                </Button>
              </div>
              {codigo.link && (
                <a
                  href={codigo.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-600 dark:text-primary-400 text-xs-plus inline-flex items-center gap-1.5 hover:underline"
                >
                  <PaperAirplaneIcon className="size-4" />
                  Abrir o bot no Telegram com o código
                </a>
              )}
              <p className="dark:text-dark-300 flex items-center gap-1.5 text-xs text-gray-500">
                <ArrowPathIcon className="size-3.5 animate-spin" />
                Aguardando a confirmação do bot…
              </p>
              <Button variant="flat" className="h-7 px-2 text-xs" onClick={() => void cancelar()}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      {status.falhas.length > 0 && (
        <div className="dark:border-dark-600 rounded-lg border border-gray-200 px-3 py-3">
          <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            Áudios aguardando transcrição
          </p>
          <ul className="mt-2 space-y-2">
            {status.falhas.map((f) => (
              <li key={f.id} className="text-xs-plus flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="dark:text-dark-100 truncate text-gray-700">
                    {ROTULO_TIPO[f.tipo] ?? f.tipo} · {quando(f.recebidaEm)}
                    {f.legenda ? ` · ${f.legenda}` : ""}
                  </p>
                  <p className="dark:text-dark-300 truncate text-xs text-gray-500" title={f.erro ?? undefined}>
                    {f.erro ?? "Falha na transcrição"}
                    {f.proximaTentativaEm ? ` · nova tentativa ${quando(f.proximaTentativaEm)}` : ""}
                  </p>
                </div>
                <Button
                  variant="outlined"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => void tentarNovamente(f.id)}
                >
                  Tentar novamente
                </Button>
              </li>
            ))}
          </ul>
          <p className="dark:text-dark-300 mt-2 text-xs text-gray-500">O áudio original fica guardado até virar nota.</p>
        </div>
      )}
    </div>
  );
}
