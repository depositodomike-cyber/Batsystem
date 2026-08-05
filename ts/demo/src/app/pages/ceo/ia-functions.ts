// ----------------------------------------------------------------------
// Catálogo das funções de IA (widget migrado do beculture/Confi).
// Fonte única de verdade compartilhada entre a tela de IA (Ia.tsx) e o bloco
// "AI Studio" da sidebar (AiStudioGroup) — assim os dois nunca ficam fora de
// sincronia.
// ----------------------------------------------------------------------

import { ElementType } from "react";
import {
  MagnifyingGlassIcon,
  PresentationChartBarIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  ClipboardDocumentIcon,
  ViewColumnsIcon,
  ScissorsIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  SparklesIcon,
  ChartBarSquareIcon,
} from "@heroicons/react/24/outline";
import i18n from "@/i18n/config";

export interface AiFunction {
  id: string;
  label: string;
  desc: string;
  Icon: ElementType;
  tint: string;
}

// Funções nativas de inteligência (criar apresentação, editar vídeo, melhorar
// texto…). Cada uma abre um modal na tela de IA.
export const FUNCTIONS: AiFunction[] = [
  { id: "analise", label: "Análise de conteúdo", desc: "Analisa um arquivo ou link em 17 seções.", Icon: MagnifyingGlassIcon, tint: "text-sky-500" },
  { id: "apresentacao", label: "Criar apresentação", desc: "Roteiro editável → .pptx, slides ou book HTML.", Icon: PresentationChartBarIcon, tint: "text-orange-500" },
  { id: "artigo", label: "Criar artigo", desc: "Artigo completo em Markdown, com refino.", Icon: DocumentTextIcon, tint: "text-blue-500" },
  { id: "ata", label: "Criar Ata", desc: "Ata executiva a partir de transcrição/arquivo.", Icon: ClipboardDocumentIcon, tint: "text-emerald-500" },
  { id: "carrossel", label: "Criar carrossel", desc: "Cards + legenda + hashtags, com prévia e refino.", Icon: ViewColumnsIcon, tint: "text-violet-500" },
  { id: "cortes", label: "Criar cortes", desc: "Editor de vídeo no navegador: recorta e exporta MP4.", Icon: ScissorsIcon, tint: "text-rose-500" },
  { id: "imagem", label: "Criar imagem", desc: "Imagem por IA (OpenAI): tamanho, qualidade, fundo…", Icon: PhotoIcon, tint: "text-amber-500" },
  { id: "video", label: "Criar vídeo", desc: "Avatar falante (HeyGen) a partir de um roteiro.", Icon: VideoCameraIcon, tint: "text-indigo-500" },
  { id: "melhorar", label: "Melhorar texto", desc: "Reescreve com mais clareza, com desfazer.", Icon: SparklesIcon, tint: "text-teal-500" },
  { id: "dashboard", label: "Criar Dashboard", desc: "Painel HTML com KPIs e gráficos a partir dos seus dados.", Icon: ChartBarSquareIcon, tint: "text-cyan-500" },
];

// Ações de upload — não aparecem na grade do AI Studio (são abertas pelos
// subitens da Memória na sidebar), mas produzem conteúdo como as demais e por
// isso entram no registro de janelas e no envio para grupos.
export const UPLOAD_FUNCTIONS: AiFunction[] = [
  { id: "transcricao", label: "Upload Transcrição", desc: "Transcrição colada → ata estratégica.", Icon: DocumentCheckIcon, tint: "text-emerald-500" },
  { id: "documento", label: "Upload Documento", desc: "Documento bruto → documento de referência.", Icon: DocumentTextIcon, tint: "text-sky-500" },
  { id: "audio", label: "Upload Áudio", desc: "Áudio/vídeo → transcrição e ata.", Icon: MicrophoneIcon, tint: "text-rose-500" },
];

/** Todas as ações do AI Studio (grade + uploads). */
export const ALL_AI_FUNCTIONS: AiFunction[] = [...FUNCTIONS, ...UPLOAD_FUNCTIONS];

/** Rótulo de uma ação do AI Studio pelo id (ex.: "artigo" → "Criar artigo"). */
export function aiFunctionLabel(id: string): string {
  const fallback = ALL_AI_FUNCTIONS.find((f) => f.id === id)?.label ?? id;
  return i18n.t(`ai.${id}`, { defaultValue: fallback });
}
