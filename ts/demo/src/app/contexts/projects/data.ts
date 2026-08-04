import type { ElementType } from "react";
import {
  EnvelopeIcon,
  CalendarIcon,
  FolderOpenIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

// ----------------------------------------------------------------------
// Dados mock para o modal de criação de projeto (Agrupamentos).
//
// Em produção viriam das respectivas APIs (Conectores e Memória).
// ----------------------------------------------------------------------

export type ConnectorStatus = "connected" | "disconnected" | "error";

export interface ConnectorRow {
  code: string;
  name: string;
  icon: ElementType;
  status: ConnectorStatus;
  scope: string;
}

export const connectorsMock: ConnectorRow[] = [
  { code: "gmail", name: "Gmail", icon: EnvelopeIcon, status: "connected", scope: "gmail.readonly" },
  { code: "gcalendar", name: "Google Calendar", icon: CalendarIcon, status: "connected", scope: "calendar.readonly" },
  { code: "gdrive", name: "Google Drive", icon: FolderOpenIcon, status: "connected", scope: "drive.readonly" },
  { code: "pipedrive", name: "Pipedrive", icon: BriefcaseIcon, status: "disconnected", scope: "—" },
  { code: "slack", name: "Slack", icon: ChatBubbleLeftRightIcon, status: "disconnected", scope: "—" },
  { code: "hubspot", name: "HubSpot", icon: UsersIcon, status: "disconnected", scope: "—" },
];

export type MemoryCategory = "decision" | "preference" | "client" | "investor";

export const memoryCategoryLabels: Record<MemoryCategory, string> = {
  decision: "Decisão",
  preference: "Preferência",
  client: "Cliente",
  investor: "Investidor",
};

export interface MemoryItem {
  id: string;
  cat: MemoryCategory;
  title: string;
  body: string;
}

export const memoryMock: MemoryItem[] = [
  {
    id: "mem-decision-cro-q4",
    cat: "decision",
    title: "Adiar contratação do CRO para Q4",
    body: "Decidido em 18/abr após sessão do Conselho. Critério: pipeline + runway.",
  },
  {
    id: "mem-preference-direct",
    cat: "preference",
    title: "Comunicação direta, sem jargão",
    body: "Prefiro respostas em até 5 bullets. Cite a fonte.",
  },
  {
    id: "mem-client-xpto",
    cat: "client",
    title: "XPTO Corp — relacionamento sensível",
    body: "CTO trocou em mar. Reativar conta personalmente em mai.",
  },
  {
    id: "mem-investor-acme",
    cat: "investor",
    title: "Acme Ventures — interesse em Série A",
    body: "Conversa preliminar em 10/abr. Pedem deck atualizado.",
  },
];

// Helpers de lookup usados na página de detalhe.
export const connectorByCode = (code: string) =>
  connectorsMock.find((c) => c.code === code);
export const memoryById = (id: string) => memoryMock.find((m) => m.id === id);

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
