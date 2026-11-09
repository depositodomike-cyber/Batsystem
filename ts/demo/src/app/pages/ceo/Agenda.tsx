// ----------------------------------------------------------------------
// Agenda — eventos reais do Google Calendar (somente leitura).
//
// Lê `GET /conectores/agenda/google-calendar/eventos` (o token fica cifrado no
// servidor). Cada evento pode ir ao Repositório como nota em "Reuniões", com o
// mesmo botão das demais origens; os participantes ganham nota em "Pessoas",
// como numa ata, para o grafo ligá-los.
// ----------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  MapPinIcon,
  UsersIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";

import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Badge, Button, Spinner } from "@/components/ui";
import { getCurrentProduct, getProductCodeFromPath } from "@/app/navigation/ceoOs";
import {
  ehNaoConectado,
  listarEventosAgendaApi,
  mensagemDoErro,
  type AgendaEvento,
} from "@/services/api/googleConectores";
import { SalvarNaMemoriaButton } from "./SalvarNaMemoria";
import { PASTA_MEMORIA } from "./memoria-pastas";

type Janela = "hoje" | "7" | "30";
const JANELAS: { id: Janela; rotulo: string; dias: number }[] = [
  { id: "hoje", rotulo: "Hoje", dias: 1 },
  { id: "7", rotulo: "7 dias", dias: 7 },
  { id: "30", rotulo: "30 dias", dias: 30 },
];

const fmtDia = (d: Date) =>
  d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function chaveDia(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Nota do evento no formato das demais origens (ata/reunião). */
function notaDoEvento(e: AgendaEvento): string {
  const quando = e.diaInteiro
    ? `${new Date(e.inicio).toLocaleDateString("pt-BR")} (dia inteiro)`
    : `${new Date(e.inicio).toLocaleString("pt-BR")} – ${fmtHora(e.fim)}`;
  const linhas = [
    `Origem: Google Calendar`,
    `Data: ${quando}`,
    e.local ? `Local: ${e.local}` : "",
    e.organizador ? `Organizador: ${e.organizador}` : "",
    e.reuniaoUrl ? `Reunião online: ${e.reuniaoUrl}` : "",
  ].filter(Boolean);
  const participantes = (e.participantes ?? []).map(
    (p) => `- [[${p.nome || p.email}]]${p.confirmacao ? ` — ${p.confirmacao}` : ""}`,
  );
  return [
    linhas.join("\n"),
    e.descricao?.trim() ? `## Descrição\n\n${e.descricao.trim()}` : "",
    participantes.length ? `## Participantes\n\n${participantes.join("\n")}` : "",
    e.link ? `[Abrir no Google Calendar](${e.link})` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function Agenda() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const conectoresPath = `/${getProductCodeFromPath(pathname)}/conectores`;

  const [janela, setJanela] = useState<Janela>("7");
  const [estado, setEstado] = useState<
    | { tipo: "carregando" }
    | { tipo: "desconectado" }
    | { tipo: "erro"; msg: string }
    | { tipo: "ok"; conta: string | null; eventos: AgendaEvento[] }
  >({ tipo: "carregando" });

  const buscar = useCallback(
    () =>
      listarEventosAgendaApi(100)
        .then((r) => setEstado({ tipo: "ok", ...r }))
        .catch((err) =>
          setEstado(
            ehNaoConectado(err)
              ? { tipo: "desconectado" }
              : { tipo: "erro", msg: mensagemDoErro(err, "Não foi possível ler a agenda.") },
          ),
        ),
    [],
  );

  const carregar = () => {
    setEstado({ tipo: "carregando" });
    void buscar();
  };

  // Primeira carga: o estado já nasce "carregando".
  useEffect(() => {
    void buscar();
  }, [buscar]);

  const grupos = useMemo(() => {
    if (estado.tipo !== "ok") return [];
    const dias = JANELAS.find((j) => j.id === janela)!.dias;
    const limite = new Date();
    limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() + dias);
    const mapa = new Map<string, { dia: Date; eventos: AgendaEvento[] }>();
    for (const e of estado.eventos) {
      if (e.cancelado || new Date(e.inicio) >= limite) continue;
      const k = chaveDia(e.inicio);
      if (!mapa.has(k)) mapa.set(k, { dia: new Date(e.inicio), eventos: [] });
      mapa.get(k)!.eventos.push(e);
    }
    return [...mapa.values()];
  }, [estado, janela]);

  return (
    <Page title={`Agenda · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <PageTitle
              help={{
                title: "Agenda",
                description: (
                  <>
                    <p>
                      Seus próximos eventos do <strong>Google Calendar</strong>,
                      lidos com permissão somente de leitura.
                    </p>
                    <p>
                      Use <strong>Salvar no Repositório</strong> para guardar um
                      evento como nota em Reuniões: a IA passa a conhecê-lo e
                      os participantes aparecem no grafo.
                    </p>
                  </>
                ),
              }}
            >
              Agenda
            </PageTitle>
            <p className="dark:text-dark-300 text-sm text-gray-500">
              {estado.tipo === "ok" && estado.conta
                ? `Google Calendar · ${estado.conta}`
                : "Seus compromissos do Google Calendar"}
            </p>
          </div>
          {estado.tipo === "ok" && (
            <div className="flex items-center gap-2">
              <div className="dark:bg-dark-700 flex rounded-lg bg-gray-100 p-1">
                {JANELAS.map((j) => (
                  <Button
                    key={j.id}
                    variant={janela === j.id ? "filled" : "flat"}
                    color={janela === j.id ? "primary" : "neutral"}
                    className="h-8 rounded-md px-3 text-xs"
                    onClick={() => setJanela(j.id)}
                  >
                    {j.rotulo}
                  </Button>
                ))}
              </div>
              <Button variant="outlined" isIcon className="size-9 rounded-lg" aria-label="Atualizar" onClick={carregar}>
                <ArrowPathIcon className="size-4.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6">
          {estado.tipo === "carregando" && (
            <div className="flex justify-center py-16">
              <Spinner color="primary" className="size-6" />
            </div>
          )}

          {(estado.tipo === "desconectado" || estado.tipo === "erro") && (
            <div className="dark:border-dark-600 dark:bg-dark-700 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <CalendarDaysIcon className="dark:text-dark-300 size-10 text-gray-400" />
              <p className="dark:text-dark-100 font-medium text-gray-800">
                {estado.tipo === "desconectado" ? "Conecte o Google Calendar" : "Não foi possível ler a agenda"}
              </p>
              <p className="dark:text-dark-300 max-w-md text-sm text-gray-500">
                {estado.tipo === "desconectado"
                  ? "Autorize o Oracle a ler sua agenda (somente leitura) em Conectores. Seus eventos aparecem aqui."
                  : estado.msg}
              </p>
              <div className="flex gap-2">
                <Button component={Link} to={conectoresPath} color="primary" className="rounded-lg">
                  Abrir Conectores
                </Button>
                {estado.tipo === "erro" && (
                  <Button variant="outlined" className="rounded-lg" onClick={carregar}>
                    Tentar de novo
                  </Button>
                )}
              </div>
            </div>
          )}

          {estado.tipo === "ok" && grupos.length === 0 && (
            <p className="dark:text-dark-300 py-12 text-center text-sm text-gray-500">
              Nenhum evento neste período.
            </p>
          )}

          {estado.tipo === "ok" && (
            <div className="space-y-6">
              {grupos.map((g) => (
                <section key={g.dia.toDateString()}>
                  <h3 className="dark:text-dark-200 mb-2 text-sm font-semibold text-gray-700 first-letter:uppercase">
                    {fmtDia(g.dia)}
                  </h3>
                  <ul className="dark:divide-dark-600 dark:border-dark-600 dark:bg-dark-700 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
                    {g.eventos.map((e) => (
                      <li key={e.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                        <div className="dark:text-dark-200 w-24 shrink-0 text-sm font-medium text-gray-700 tabular-nums">
                          {e.diaInteiro ? "Dia inteiro" : `${fmtHora(e.inicio)} – ${fmtHora(e.fim)}`}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="dark:text-dark-50 font-medium text-gray-800">{e.titulo}</p>
                          <div className="dark:text-dark-300 text-xs-plus flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
                            {e.local && (
                              <span className="flex items-center gap-1">
                                <MapPinIcon className="size-3.5" /> {e.local}
                              </span>
                            )}
                            {!!e.participantes?.length && (
                              <span className="flex items-center gap-1">
                                <UsersIcon className="size-3.5" /> {e.participantes.length} participantes
                              </span>
                            )}
                            {e.reuniaoUrl && (
                              <a href={e.reuniaoUrl} target="_blank" rel="noreferrer" className="text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
                                <VideoCameraIcon className="size-3.5" /> Entrar na reunião
                              </a>
                            )}
                            {e.link && (
                              <a href={e.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                                <ArrowTopRightOnSquareIcon className="size-3.5" /> Google Calendar
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <SalvarNaMemoriaButton
                            pasta={PASTA_MEMORIA.reunioes}
                            titulo={`${e.titulo} — ${new Date(e.inicio).toLocaleDateString("pt-BR")}`}
                            tags={["reuniao", "google-calendar"]}
                            conteudo={notaDoEvento(e)}
                            pessoas={(e.participantes ?? []).map((p) => p.nome || p.email)}
                            rotulo="Salvar no Repositório"
                            rotuloSalvo="No Repositório"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {estado.eventos.length >= 100 && (
                <Badge variant="soft" className="rounded-full">Mostrando os próximos 100 eventos</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
