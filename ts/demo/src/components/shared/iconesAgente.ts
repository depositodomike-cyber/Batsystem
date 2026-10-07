// Avatares que o usuário pode escolher para um agente personalizado
// (Configurações de usuário → Agentes → Criar/Editar agente). Sem escolha, o
// avatar mostra as iniciais do nome.
//
// A chave gravada no banco é "agente:<nome>" — o prefixo separa estes dos
// ícones dos agentes do sistema, que vêm de `navigationIcons`. Chave que não
// está mais aqui cai nas iniciais.
import type { ElementType } from "react";

import {
  AvatarBarba,
  AvatarBlackPower,
  AvatarCabeloLongo,
  AvatarCoque,
  AvatarOculos,
} from "./avataresAgente";

export interface IconeAgente {
  chave: string;
  rotulo: string;
  /** Ilustração que ocupa o círculo inteiro (recebe só `className`). */
  Icone: ElementType<{ className?: string }>;
}

export const ICONES_AGENTE: IconeAgente[] = [
  { chave: "agente:avatar-cabelo-longo", rotulo: "Cabelo longo", Icone: AvatarCabeloLongo },
  { chave: "agente:avatar-barba", rotulo: "Barba", Icone: AvatarBarba },
  { chave: "agente:avatar-coque", rotulo: "Coque", Icone: AvatarCoque },
  { chave: "agente:avatar-oculos", rotulo: "Óculos", Icone: AvatarOculos },
  { chave: "agente:avatar-black-power", rotulo: "Black power", Icone: AvatarBlackPower },
];

/** Avatar por chave ("agente:…") — consulta direta, como `navigationIcons`. */
export const iconesAgentePorChave: Record<
  string,
  ElementType<{ className?: string }>
> = Object.fromEntries(ICONES_AGENTE.map((i) => [i.chave, i.Icone]));
