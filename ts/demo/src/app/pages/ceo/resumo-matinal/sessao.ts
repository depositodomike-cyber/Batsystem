// ----------------------------------------------------------------------
// Sessão do briefing — o que o PromptBar precisa saber enquanto a página do
// Resumo Matinal está aberta: o briefing como texto (contexto das perguntas)
// e se ele está ativo. Módulo simples + eventos no window, no mesmo padrão
// de EVENTO_ESCUTA / EVENTO_REPOSITORIO_ATUALIZADO.
// ----------------------------------------------------------------------

import type { BriefingDados, Periodo } from "@/services/api/briefing";

/** Pedido de briefing vindo de fora da página (PromptBar). */
export const EVENTO_BRIEFING = "oracle:briefing";
export type PedidoBriefing = { acao: "iniciar"; periodo: Periodo; ouvir: boolean } | { acao: "continuar" };

/** O PromptBar terminou de falar uma resposta. */
export const EVENTO_RESPOSTA_FALADA = "oracle:resposta-falada";

let contexto: string | null = null;
let trechoAtual = "";

export function briefingAtivo(): boolean {
  return contexto !== null;
}

/** Contexto enviado junto com as perguntas feitas durante o briefing. */
export function contextoDoBriefing(): string | undefined {
  if (contexto === null) return undefined;
  return trechoAtual
    ? `${contexto}\n\nTRECHO QUE O ORACLE ESTAVA FALANDO QUANDO O USUÁRIO PERGUNTOU:\n${trechoAtual}`
    : contexto;
}

export function definirTrechoAtual(texto: string): void {
  trechoAtual = texto;
}

export function encerrarSessao(): void {
  contexto = null;
  trechoAtual = "";
}

export function pedirBriefing(pedido: PedidoBriefing): void {
  window.dispatchEvent(new CustomEvent<PedidoBriefing>(EVENTO_BRIEFING, { detail: pedido }));
}

/** O briefing em texto corrido, com links — o assistente responde sobre ele. */
export function iniciarSessao(b: BriefingDados): void {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(b.idioma === "en" ? "en-US" : "pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const L: string[] = [
    `RESUMO ${b.periodo === "noite" ? "NOTURNO" : "MATINAL"} DO USUÁRIO (${b.data}). Responda usando estes dados; se a pergunta for sobre um item daqui, não peça para o usuário explicar de novo.`,
  ];
  if (b.sintese) L.push(`Síntese: ${b.sintese}`);
  if (b.clima) L.push(`Clima em ${b.clima.cidade} (${b.clima.periodo}): ${b.clima.condicao}, ${b.clima.temperatura}°C.`);
  if (b.agenda.length) {
    L.push("Agenda:");
    for (const a of b.agenda)
      L.push(
        `- ${a.evento.diaInteiro ? `${a.dia} (dia inteiro)` : fmt(a.evento.inicio)} · ${a.evento.titulo}` +
          `${a.conflito ? " · conflito de horário" : ""}${a.nota ? ` · ${a.nota}` : ""}${a.preparacao ? ` · preparar: ${a.preparacao}` : ""}` +
          `${a.docs.length ? ` · documentos: ${a.docs.map((d) => d.titulo).join(", ")}` : ""}`,
      );
  }
  if (b.comunicacoes.length) {
    L.push("E-mails que merecem atenção:");
    for (const c of b.comunicacoes)
      L.push(
        `- ${c.email.assunto} · de ${c.email.remetenteNome || c.email.remetenteEmail} · ${fmt(c.email.data)} · ${c.resumo} · motivo: ${c.motivo}${c.exigeAcao ? " · exige ação" : ""}`,
      );
  }
  if (b.projetos.length) {
    L.push("Projetos, tarefas e objetivos:");
    for (const p of b.projetos)
      L.push(
        `- (${p.tipo}) ${p.titulo} · ${p.situacao}${p.proximoPasso ? ` · próximo passo: ${p.proximoPasso}` : ""}` +
          `${p.docs.length ? ` · documentos: ${p.docs.map((d) => d.titulo).join(", ")}` : ""}`,
      );
  }
  if (b.noticias.length) {
    L.push("Notícias:");
    for (const n of b.noticias)
      L.push(`- ${n.titulo} (${n.fonte}, ${fmt(n.publicadoEm)}) · ${n.resumo} · relevância: ${n.porQue} · ${n.link}`);
  }
  if (b.insights.length) {
    L.push("Insights:");
    for (const i of b.insights) L.push(`- ${i.titulo}: ${i.texto} (origem: ${i.origens.map((o) => o.rotulo).join(", ")})`);
  }
  contexto = L.join("\n").slice(0, 7000);
}
